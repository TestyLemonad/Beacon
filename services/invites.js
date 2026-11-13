/**
 * Beacon — инвайт-коды.
 *
 * Регистрация в Beacon закрыта: без инвайт-кода нельзя создать ни аккаунт
 * по почте, ни аккаунт через Google (см. проверку в services/auth.js).
 *
 * В Realtime Database не хранится открытый код:
 *  - /invite_codes/$codeKey — соль и хэш кода, кто и когда создал;
 *  - /invite_redemptions/$codeKey — кто и когда использовал код (одноразовый);
 *  - /user_invites/$uid — подтверждение, что аккаунт пришёл по инвайту.
 *
 * $codeKey = SHA-256 от нормализованного кода (нужен для поиска: RTDB не умеет
 * искать по значению). Сам код дополнительно хэшируется с солью, поэтому
 * открытый текст нельзя восстановить даже при утечке базы. Код можно
 * использовать один раз; в базе лежит только его хэш, поэтому ссылку на код
 * показываем сразу после создания и больше восстановить не сможем.
 *
 * Права: создавать и отзывать коды могут только root-админы (это же
 * продублировано в RTDB-rules.json), читать запись по конкретному $codeKey
 * может любой — иначе регистрация не смогла бы проверить код до входа.
 */
import { ref, get, set, update } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
import { db } from '../firebase-config.js?v=47';

/** Алфавит без похожих символов: нет I, L, O, U, 0, 1. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 16;
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 64;
const MAX_BATCH = 20;
const NOTE_MAX_LENGTH = 80;

const KEY_PREFIX = 'beacon:invite:key:v1:';
const HASH_PREFIX = 'beacon:invite:hash:v1:';

const textEncoder = new TextEncoder();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function inviteError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireCrypto() {
  if (!globalThis.crypto?.subtle || typeof textEncoder.encode !== 'function') {
    throw inviteError('Браузер не поддерживает безопасное хэширование — обновите браузер', 'beacon/invite-crypto');
  }
}

/** SHA-256 в нижнем регистре hex. */
async function sha256Hex(value) {
  requireCrypto();
  const digest = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(String(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Случайные байты в hex (для соли и служебных значений). */
function randomHex(size = 16) {
  requireCrypto();
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Сгенерировать код: 16 символов из алфавита без неоднозначных букв (80 бит). */
function randomCode() {
  requireCrypto();
  const bytes = new Uint8Array(CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  // 32 символа в алфавите ровно делят 256, поэтому смещение не возникает.
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

/**
 * Привести код к канону: верхний регистр, без пробелов, дефисов и прочего.
 * Если вставили ссылку вида /?invite_code=… — достаём параметр.
 */
export function normalizeInviteCode(value) {
  let raw = String(value || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw) || /invite_code=/i.test(raw)) {
    try {
      const url = new URL(raw, window.location.origin);
      raw = url.searchParams.get('invite_code') || raw;
    } catch {
      // Не похоже на URL — обработаем как обычную строку ниже.
    }
  }

  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Красивый вид для показа: ABCD-EFGH-JKLM-NPQR. */
export function formatInviteCode(value) {
  const normalized = normalizeInviteCode(value);
  return (normalized.match(/.{1,4}/g) || []).join('-');
}

/** Ссылка-приглашение с автоподстановкой кода на экране регистрации. */
export function buildInviteLink(code) {
  const normalized = normalizeInviteCode(code);
  try {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('invite_code', normalized);
    return url.toString();
  } catch {
    return `?invite_code=${encodeURIComponent(normalized)}`;
  }
}

/** Стабильный ключ поиска кода (в базе нет открытого текста). */
async function codeKeyFor(normalized) {
  return sha256Hex(KEY_PREFIX + normalized);
}

/** Соль + код → хэш, который лежит в /invite_codes/$codeKey/hash. */
async function hashCodeFor(normalized, salt) {
  return sha256Hex(`${HASH_PREFIX}${salt}:${normalized}`);
}

/** Сравнение hex-строк без раннего выхода. */
function safeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/** Проверка формата после нормализации (короткие коды тоже допустимы). */
function isValidCodeFormat(normalized) {
  return normalized.length >= MIN_CODE_LENGTH
    && normalized.length <= MAX_CODE_LENGTH
    && /^[A-Z0-9]+$/.test(normalized);
}

function mapDatabaseError(error, fallback) {
  if (error?.code === 'database/permission-denied' || /permission/i.test(String(error?.message || ''))) {
    return inviteError('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.', 'beacon/invite-permission');
  }
  if (fallback) return inviteError(fallback, 'beacon/invite-network');
  return error;
}

/**
 * Создать пачку одноразовых кодов. Вызывается только из интерфейса
 * root-админа; сами права проверяют RTDB-правила.
 *
 * @param {{ uid: string, count?: number, note?: string }} options
 * @returns {Promise<Array<{code: string, rawCode: string, codeKey: string, link: string}>>}
 */
export async function createInviteCodes({ uid, count = 1, note = '' } = {}) {
  if (!uid) throw inviteError('Сначала войдите в аккаунт', 'beacon/invite-no-user');
  const total = Math.max(1, Math.min(MAX_BATCH, Math.floor(Number(count) || 1)));
  const cleanNote = String(note || '').trim().slice(0, NOTE_MAX_LENGTH);
  const createdAt = nowSeconds();
  const created = [];

  for (let index = 0; index < total; index += 1) {
    const rawCode = randomCode();
    const salt = randomHex(16);
    const [codeKey, hash] = await Promise.all([
      codeKeyFor(rawCode),
      hashCodeFor(rawCode, salt),
    ]);

    const record = {
      salt,
      hash,
      createdAt,
      createdBy: uid,
    };
    if (cleanNote) record.note = cleanNote;

    try {
      await set(ref(db, `invite_codes/${codeKey}`), record);
    } catch (error) {
      console.error('Не удалось сохранить инвайт-код:', error);
      throw mapDatabaseError(error, 'Не удалось создать инвайт-код. Попробуйте позже.');
    }

    created.push({
      code: formatInviteCode(rawCode),
      rawCode,
      codeKey,
      link: buildInviteLink(rawCode),
    });
  }

  return created;
}

/**
 * Проверить код без его использования.
 * @param {string} value — код или ссылка с ?invite_code=
 * @param {{ checkUsage?: boolean }} options
 * @returns {Promise<{codeKey: string, normalized: string, formatted: string, record: object}>}
 */
export async function validateInviteCode(value, { checkUsage = true } = {}) {
  const normalized = normalizeInviteCode(value);
  if (!normalized) {
    throw inviteError('Введите инвайт-код', 'beacon/invite-empty');
  }
  if (!isValidCodeFormat(normalized)) {
    throw inviteError('Инвайт-код недействителен', 'beacon/invite-invalid');
  }

  const codeKey = await codeKeyFor(normalized);
  let snapshot;
  try {
    snapshot = await get(ref(db, `invite_codes/${codeKey}`));
  } catch (error) {
    console.error('Не удалось прочитать инвайт-код:', error);
    throw mapDatabaseError(error, 'Не удалось проверить инвайт-код. Попробуйте позже.');
  }

  if (!snapshot.exists()) {
    throw inviteError('Инвайт-код недействителен', 'beacon/invite-invalid');
  }

  const record = snapshot.val() || {};
  const salt = String(record.salt || '');
  const storedHash = String(record.hash || '');
  if (!salt || !storedHash) {
    throw inviteError('Инвайт-код недействителен', 'beacon/invite-invalid');
  }

  const computedHash = await hashCodeFor(normalized, salt);
  if (!safeEqual(computedHash, storedHash)) {
    throw inviteError('Инвайт-код недействителен', 'beacon/invite-invalid');
  }

  if (record.revoked === true) {
    throw inviteError('Инвайт-код отозван', 'beacon/invite-revoked');
  }

  const expiresAt = Number(record.expiresAt) || 0;
  if (expiresAt > 0 && Date.now() >= expiresAt * 1000) {
    throw inviteError('Срок действия инвайт-кода истёк', 'beacon/invite-expired');
  }

  if (checkUsage) {
    let usedSnapshot;
    try {
      usedSnapshot = await get(ref(db, `invite_redemptions/${codeKey}`));
    } catch (error) {
      console.error('Не удалось проверить использование кода:', error);
      throw mapDatabaseError(error, 'Не удалось проверить инвайт-код. Попробуйте позже.');
    }
    if (usedSnapshot.exists()) {
      throw inviteError('Инвайт-код уже использован', 'beacon/invite-used');
    }
  }

  return {
    codeKey,
    normalized,
    formatted: formatInviteCode(normalized),
    record,
  };
}

/**
 * Использовать код: отметить его в /invite_redemptions и выдать аккаунту
 * подтверждение /user_invites/$uid. Повторный вызов для того же uid
 * считается успешным (например, после обрыва сети).
 *
 * @param {{ uid: string, code: string }} options
 */
export async function redeemInviteCode({ uid, code } = {}) {
  if (!uid) throw inviteError('Сначала войдите в аккаунт', 'beacon/invite-no-user');

  // Проверяем хэш и статус; использование проверим отдельно, чтобы повтор
  // тем же пользователем не считался ошибкой.
  const validated = await validateInviteCode(code, { checkUsage: false });
  const redemptionRef = ref(db, `invite_redemptions/${validated.codeKey}`);

  let alreadyMine = false;
  let existing = null;
  try {
    existing = await get(redemptionRef);
  } catch (error) {
    console.error('Не удалось прочитать использование кода:', error);
    throw mapDatabaseError(error, 'Не удалось применить инвайт-код. Попробуйте позже.');
  }

  if (existing.exists()) {
    const usedBy = String(existing.val()?.uid || '');
    if (usedBy && usedBy !== String(uid)) {
      throw inviteError('Инвайт-код уже использован', 'beacon/invite-used');
    }
    alreadyMine = usedBy === String(uid);
  }

  if (!alreadyMine) {
    try {
      await set(redemptionRef, { uid, at: nowSeconds() });
    } catch (error) {
      // Гонка двух вкладок: возможно, код только что использовал этот же uid.
      const after = await get(redemptionRef).catch(() => null);
      if (after?.exists() && String(after.val()?.uid || '') === String(uid)) {
        alreadyMine = true;
      } else {
        console.error('Не удалось использовать инвайт-код:', error);
        throw mapDatabaseError(error, 'Не удалось применить инвайт-код. Попробуйте позже.');
      }
    }
  }

  try {
    await set(ref(db, `user_invites/${uid}`), {
      codeKey: validated.codeKey,
      at: nowSeconds(),
    });
  } catch (error) {
    console.error('Не удалось закрепить инвайт за аккаунтом:', error);
    throw mapDatabaseError(error, 'Не удалось применить инвайт-код. Попробуйте позже.');
  }

  return { codeKey: validated.codeKey, formatted: validated.formatted };
}

/** Есть ли у аккаунта подтверждение инвайта (/user_invites/$uid). */
export async function hasInviteGrant(uid) {
  if (!uid) return false;
  try {
    const snapshot = await get(ref(db, `user_invites/${uid}`));
    return snapshot.exists();
  } catch (error) {
    console.warn('Не удалось проверить инвайт аккаунта:', error);
    return false;
  }
}

/** Статус кода для списка в интерфейсе. */
function codeStatus(record, redemption) {
  if (record?.revoked === true) return 'revoked';
  if (redemption) return 'used';
  const expiresAt = Number(record?.expiresAt) || 0;
  if (expiresAt > 0 && Date.now() >= expiresAt * 1000) return 'expired';
  return 'active';
}

/**
 * Все коды для окна root-админа. Возвращает и использование, чтобы показать
 * статус «использован». Читать весь узел могут только root-админы.
 */
export async function listInviteCodes() {
  let codesSnapshot;
  let redemptionsSnapshot;
  try {
    [codesSnapshot, redemptionsSnapshot] = await Promise.all([
      get(ref(db, 'invite_codes')),
      get(ref(db, 'invite_redemptions')),
    ]);
  } catch (error) {
    console.error('Не удалось загрузить инвайт-коды:', error);
    throw mapDatabaseError(error, 'Не удалось загрузить инвайт-коды.');
  }

  const codes = codesSnapshot.val() || {};
  const redemptions = redemptionsSnapshot.val() || {};

  return Object.entries(codes)
    .map(([codeKey, record]) => {
      const safeRecord = record && typeof record === 'object' ? record : {};
      const redemption = redemptions[codeKey] || null;
      return {
        codeKey,
        ...safeRecord,
        redemption,
        status: codeStatus(safeRecord, redemption),
      };
    })
    .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0));
}

/** Отозвать код (погасить ссылку). Доступно только root-админам. */
export async function revokeInviteCode(codeKey, uid) {
  if (!codeKey) throw inviteError('Код не найден', 'beacon/invite-invalid');
  try {
    await update(ref(db, `invite_codes/${codeKey}`), {
      revoked: true,
      revokedAt: nowSeconds(),
      revokedBy: uid || null,
    });
  } catch (error) {
    console.error('Не удалось отозвать инвайт-код:', error);
    throw mapDatabaseError(error, 'Не удалось отозвать инвайт-код.');
  }
}
