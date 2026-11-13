/**
 * Beacon — сервис чатов, профилей и сообщений.
 *
 * Все пути и названия полей соответствуют structure-template.json:
 *
 *   /users/$uid              { username, firstName, lastName?, bio?, avatar?, email, createdAt }
 *   /usernames/$username     $uid                       — индекс поиска людей
 *   /login_index/$username   { uid, email }             — вход по @username
 *   /reserved_usernames/$username  { at, by }           — имена, зарезервированные root-админами
 *   /username_aliases/$username   { type, target, at, by } — дополнительные имена
 *                              (type: user|channel|group), выданные root-админами;
 *                              ведут на основной профиль цели
 *   /chats/$chat_id          { type, groupType?, username?, title?, description?, owner?, users?,
 *                              admins?, subscribersCount?, subscribers?, auto_subscribed?,
 *                              requiresSubscription?, avatar?, createdAt, lastMessage?, pinned? }
 *                              subscribers / auto_subscribed — карта $uid: подписчики канала
 *                              и те, кого подписали автоматически при выдаче админки
 *                              (снимаешь админа — откатываем такую подписку)
 *   /channel_usernames/$username  $chat_id              — индекс поиска каналов
 *   /group_usernames/$username    $chat_id              — индекс поиска публичных групп
 *   /messages/$chat_id       { $msg_id: { sender, text, timestamp, editedAt?,
 *                              replyTo?, forwardedFrom?, reactions? } }
 *   /chats/$chat_id/pinned   { $msg_id: { ts, text, sender } }  — закреплённые
 *   /user_chats/$uid         { $chat_id: true }
 *   /user_blocks/$uid        { $blocked_uid: true }     — чёрный список
 *   /user_message_deletes/$uid/$chat_id/$msg_id  true   — «удалено у меня»
 *   /presence/$uid           { online: bool, lastSeen }  — онлайн-статусы
 *   /user_settings/$uid      { lastSeenPrivacy: 'all' | 'nobody', adminMode?: bool, hideDevPromo?: true }
 *   /user_reads/$uid/$chat_id   ts (unix-секунды)       — докуда дочитано
 *   /typing/$chat_id/$uid    { name, ts }               — «печатает…»
 *   /poll_votes/$chat_id/$msg_id/$uid  { $option_id: true } — голоса в опросах
 *   /comments/$chat_id/$post_id/$comment_id  { sender, text, timestamp }
 *   /views/$chat_id/$msg_id/$uid  ts                    — уникальные просмотры поста
 *   /user_chat_meta/$uid/$chat_id  { archived?, pinnedAt?, folders?: { $folder_id: true } }
 *   /user_folders/$uid/$folder_id  { name, createdAt }  — папки чатов
 *   /chats/saved_$uid        { type: 'saved', owner, users } — «Избранное»
 *   /root_admins/$uid        true                       — супер-администраторы (тестовые права)
 *   /banned_users/$uid       { by, at }                 — забаненные пользователи
 *   /deleted_users/$uid      true                       — удалённые аккаунты (вход закрыт)
 *
 * Поля сообщения (дополнительно): poll? { question, multiple, options: [{ id, text }] },
 * savedFrom? { chatId, chatTitle, msgId, sender, text } — закладка из «Избранного».
 *
 * Юзернеймы уникальны: они захватываются транзакцией в узлах-индексах
 * /usernames, /channel_usernames и /group_usernames.
 */
import {
  ref,
  get,
  set,
  update,
  push,
  onValue,
  onDisconnect,
  serverTimestamp,
  query,
  limitToLast,
  limitToFirst,
  orderByKey,
  startAt,
  endAt,
  runTransaction,
  increment,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
import { auth, db } from '../firebase-config.js?v=47';

/** Сколько сообщений подгружать в историю чата (пагинация). */
export const MESSAGES_PAGE_SIZE = 50;

/** Юзернейм: 3–32 символа, латиница в нижнем регистре, цифры и «_». */
const USERNAME_REGEX = /^[a-z0-9_]{3,32}$/;

/** Верхняя граница префиксного поиска в RTDB (все символы после префикса). */
const PREFIX_END = '\uf8ff';

/** Текущее время в unix-секундах (формат timestamp из шаблона). */
const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Кэш профилей /users/$uid: uid -> профиль | null (если не найден). */
const usersCache = new Map();

/** Живые подписки на профили: uid -> { unsubscribe, listeners: Set<{onChange, onError}> }. */
const userProfileSubscriptions = new Map();

/* ============================================================
 *  Юзернеймы
 * ============================================================ */

/** Привести юзернейм к каноническому виду: без «@», в нижнем регистре. */
export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/^@+/, '');
}

/** Проверить корректность юзернейма (после нормализации). */
export function isValidUsername(username) {
  return USERNAME_REGEX.test(username);
}

const USERNAME_ERROR = 'Юзернейм: 3–32 символа (a–z, 0–9, «_»)';

/** Правила базы отклонили запись (например, имя зарезервировано). */
function isPermissionDenied(error) {
  return error?.code === 'database/permission-denied'
    || /permission/i.test(String(error?.message || ''));
}

/**
 * Разобрать ввод со списком юзернеймов: запятые, точки с запятой, пробелы
 * и переводы строк. Возвращает корректные имена без повторов и ошибочные.
 * @param {string|string[]} values
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function parseUsernameList(values) {
  const rawList = Array.isArray(values) ? values : [values];
  const valid = [];
  const invalid = [];

  rawList.forEach((value) => {
    String(value || '').split(/[\s,;]+/).forEach((part) => {
      const name = normalizeUsername(part);
      if (!name) return;
      if (!isValidUsername(name)) {
        if (!invalid.includes(name)) invalid.push(name);
        return;
      }
      if (!valid.includes(name)) valid.push(name);
    });
  });

  return { valid, invalid };
}

/**
 * Проверить, не зарезервирован ли юзернейм. Читать список могут все
 * вошедшие, поэтому проверка нужна для понятного сообщения: окончательно
 * запрет обеспечивают правила базы.
 * @returns {Promise<boolean>}
 */
export async function isUsernameReserved(username) {
  const name = normalizeUsername(username);
  if (!isValidUsername(name)) return false;
  try {
    const snapshot = await get(ref(db, `reserved_usernames/${name}`));
    return snapshot.exists();
  } catch (error) {
    console.warn('Не удалось проверить резерв юзернейма:', error);
    return false;
  }
}

/** Не дать занять зарезервированное имя (супер-админам можно). */
async function assertUsernameNotReserved(username) {
  if (!(await isUsernameReserved(username))) return;

  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const snapshot = await get(ref(db, `root_admins/${uid}`));
      if (snapshot.val() === true) return;
    } catch (error) {
      console.warn('Не удалось проверить права супер-администратора:', error);
    }
  }

  const error = new Error(`Юзернейм @${username} зарезервирован`);
  error.code = 'beacon/username-reserved';
  throw error;
}

/**
 * Не дать занять имя, которое уже выдано как дополнительный юзернейм:
 * такие имена остаются привязанными к своему основному профилю.
 */
async function assertUsernameNotAlias(username) {
  try {
    const snapshot = await get(ref(db, `username_aliases/${username}`));
    if (!snapshot.exists()) return;
  } catch (error) {
    console.warn('Не удалось проверить дополнительные юзернеймы:', error);
    return;
  }

  const error = new Error(`Юзернейм @${username} уже выдан как дополнительный`);
  error.code = 'beacon/username-alias';
  throw error;
}

/**
 * Занять юзернейм для пользователя (атомарно, через транзакцию).
 * Если юзернейм свободен или уже принадлежит этому пользователю — успех.
 */
async function claimUsername(uid, username) {
  await assertUsernameNotReserved(username);
  await assertUsernameNotAlias(username);

  let result;
  try {
    result = await runTransaction(ref(db, `usernames/${username}`), (current) => {
      if (current === null || current === uid) return uid;
      return undefined; // занято другим — прерываем транзакцию
    });
  } catch (error) {
    if (isPermissionDenied(error)) throw new Error(`Юзернейм @${username} недоступен`);
    throw error;
  }
  if (!result.committed) throw new Error(`Юзернейм @${username} уже занят`);
}

/**
 * Занять юзернейм канала (по нему канал находят и подписываются).
 * @returns {Promise<string>} chatId канала-владельца
 */
async function claimChannelUsername(chatId, username) {
  await assertUsernameNotReserved(username);
  await assertUsernameNotAlias(username);

  let result;
  try {
    result = await runTransaction(ref(db, `channel_usernames/${username}`), (current) => {
      if (current === null || current === chatId) return chatId;
      return undefined; // занято другим каналом — прерываем транзакцию
    });
  } catch (error) {
    if (isPermissionDenied(error)) throw new Error(`Юзернейм канала @${username} недоступен`);
    throw error;
  }
  if (!result.committed) throw new Error(`Юзернейм канала @${username} уже занят`);
}

/**
 * Занять юзернейм публичной группы (по нему группу находят и присоединяются).
 * @returns {Promise<string>} chatId группы-владельца
 */
async function claimGroupUsername(chatId, username) {
  await assertUsernameNotReserved(username);
  await assertUsernameNotAlias(username);

  let result;
  try {
    result = await runTransaction(ref(db, `group_usernames/${username}`), (current) => {
      if (current === null || current === chatId) return chatId;
      return undefined; // занято другой группой — прерываем транзакцию
    });
  } catch (error) {
    if (isPermissionDenied(error)) throw new Error(`Юзернейм группы @${username} недоступен`);
    throw error;
  }
  if (!result.committed) throw new Error(`Юзернейм группы @${username} уже занят`);
}

/* ============================================================
 *  Резерв юзернеймов (только root-админы)
 * ============================================================ */

/**
 * Все зарезервированные юзернеймы с текущим статусом занятости.
 * @returns {Promise<Array<{name: string, at: number, by: string,
 *           status: 'free'|'user'|'channel'|'group', occupant: string}>>}
 */
export async function listReservedUsernames() {
  let snapshots;
  try {
    snapshots = await Promise.all([
      get(ref(db, 'reserved_usernames')),
      get(ref(db, 'usernames')),
      get(ref(db, 'channel_usernames')),
      get(ref(db, 'group_usernames')),
      get(ref(db, 'username_aliases')),
    ]);
  } catch (error) {
    console.error('Не удалось загрузить зарезервированные юзернеймы:', error);
    if (isPermissionDenied(error)) {
      throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
    }
    throw new Error('Не удалось загрузить зарезервированные юзернеймы');
  }

  const reserved = snapshots[0].val() || {};
  const users = snapshots[1].val() || {};
  const channels = snapshots[2].val() || {};
  const groups = snapshots[3].val() || {};
  const aliases = snapshots[4].val() || {};

  return Object.entries(reserved)
    .map(([name, value]) => {
      const record = value && typeof value === 'object' ? value : {};
      let status = 'free';
      let occupant = '';

      if (users[name]) {
        status = 'user';
        occupant = String(users[name]);
      } else if (channels[name]) {
        status = 'channel';
        occupant = String(channels[name]);
      } else if (groups[name]) {
        status = 'group';
        occupant = String(groups[name]);
      } else if (aliases[name]?.target) {
        status = 'alias';
        occupant = String(aliases[name].target);
      }

      return {
        name,
        at: Number(record.at) || 0,
        by: String(record.by || ''),
        status,
        occupant,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Зарезервировать список имён. Уже занятые (пользователем, каналом или
 * группой) и уже зарезервированные имена пропускаются.
 *
 * @param {{ names: string|string[], uid: string }} options
 * @returns {Promise<{ added: string[], skipped: Array<{name: string, reason: string}> }>}
 */
export async function reserveUsernames({ names = [], uid } = {}) {
  if (!uid) throw new Error('Сначала войдите в аккаунт');

  const { valid, invalid } = parseUsernameList(names);
  if (!valid.length && !invalid.length) throw new Error('Введите один или несколько юзернеймов');

  let snapshots;
  try {
    snapshots = await Promise.all([
      get(ref(db, 'reserved_usernames')),
      get(ref(db, 'usernames')),
      get(ref(db, 'channel_usernames')),
      get(ref(db, 'group_usernames')),
      get(ref(db, 'username_aliases')),
    ]);
  } catch (error) {
    console.error('Не удалось проверить юзернеймы:', error);
    if (isPermissionDenied(error)) {
      throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
    }
    throw new Error('Не удалось проверить юзернеймы');
  }

  const reserved = snapshots[0].val() || {};
  const users = snapshots[1].val() || {};
  const channels = snapshots[2].val() || {};
  const groups = snapshots[3].val() || {};
  const aliases = snapshots[4].val() || {};

  const added = [];
  const skipped = invalid.map((name) => ({ name, reason: 'invalid' }));
  const updates = {};
  const createdAt = nowSeconds();

  valid.forEach((name) => {
    if (reserved[name]) {
      skipped.push({ name, reason: 'reserved' });
      return;
    }
    if (users[name]) {
      skipped.push({ name, reason: 'user' });
      return;
    }
    if (channels[name]) {
      skipped.push({ name, reason: 'channel' });
      return;
    }
    if (groups[name]) {
      skipped.push({ name, reason: 'group' });
      return;
    }
    if (aliases[name]) {
      skipped.push({ name, reason: 'alias' });
      return;
    }

    updates[`reserved_usernames/${name}`] = { at: createdAt, by: uid };
    added.push(name);
  });

  if (added.length) {
    try {
      await update(ref(db), updates);
    } catch (error) {
      console.error('Не удалось зарезервировать юзернеймы:', error);
      if (isPermissionDenied(error)) {
        throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
      }
      throw new Error('Не удалось зарезервировать юзернеймы');
    }
  }

  return { added, skipped };
}

/**
 * Снять резерв со списка имён. Незарезервированные имена пропускаются.
 * @param {string|string[]} names
 * @returns {Promise<{ removed: string[], skipped: Array<{name: string, reason: string}> }>}
 */
export async function releaseReservedUsernames(names = []) {
  const { valid, invalid } = parseUsernameList(names);
  if (!valid.length && !invalid.length) throw new Error('Введите один или несколько юзернеймов');

  let snapshot;
  try {
    snapshot = await get(ref(db, 'reserved_usernames'));
  } catch (error) {
    console.error('Не удалось прочитать зарезервированные юзернеймы:', error);
    if (isPermissionDenied(error)) {
      throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
    }
    throw new Error('Не удалось прочитать список резерва');
  }

  const reserved = snapshot.val() || {};
  const removed = [];
  const skipped = invalid.map((name) => ({ name, reason: 'invalid' }));
  const updates = {};

  valid.forEach((name) => {
    if (!reserved[name]) {
      skipped.push({ name, reason: 'missing' });
      return;
    }
    updates[`reserved_usernames/${name}`] = null;
    removed.push(name);
  });

  if (removed.length) {
    try {
      await update(ref(db), updates);
    } catch (error) {
      console.error('Не удалось снять резерв юзернеймов:', error);
      if (isPermissionDenied(error)) {
        throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
      }
      throw new Error('Не удалось снять резерв');
    }
  }

  return { removed, skipped };
}

/* ============================================================
 *  Дополнительные юзернеймы (выдаёт root-админ)
 *
 *  /username_aliases/$name  { type: 'user'|'channel'|'group',
 *                             target: uid | chat_id, at, by }
 *  Дополнительное имя не создаёт отдельную сущность: поиск, ссылки,
 *  упоминания и вход по @username ведут на основной профиль цели.
 * ============================================================ */

export const ALIAS_TYPE_LABELS = {
  user: 'Пользователь',
  channel: 'Канал',
  group: 'Группа',
};

/** Тип цели дополнительного юзернейма. */
function cleanAliasType(type) {
  return ['user', 'channel', 'group'].includes(type) ? type : 'user';
}

/** Подписка на /username_aliases: { $name: { type, target, at, by } }. */
export function subscribeToUsernameAliases(onChange, onError = null) {
  return onValue(
    ref(db, 'username_aliases'),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на дополнительные юзернеймы:', error);
      if (onError) onError(error);
    },
  );
}

/**
 * Прочитать дополнительный юзернейм.
 * @returns {Promise<{name: string, type: 'user'|'channel'|'group',
 *           target: string, at: number, by: string}|null>}
 */
export async function getUsernameAlias(rawName) {
  const name = normalizeUsername(rawName);
  if (!isValidUsername(name)) return null;

  try {
    const snapshot = await get(ref(db, `username_aliases/${name}`));
    const value = snapshot.val();
    if (!value || typeof value !== 'object') return null;

    const type = ['user', 'channel', 'group'].includes(value.type) ? value.type : null;
    const target = String(value.target || '');
    if (!type || !target) return null;

    return {
      name,
      type,
      target,
      at: Number(value.at) || 0,
      by: String(value.by || ''),
    };
  } catch (error) {
    console.warn('Не удалось прочитать дополнительный юзернейм:', error);
    return null;
  }
}

/** Человекочитаемые данные цели для списка и подписи. */
async function describeAliasTarget(type, target) {
  if (type === 'user') {
    const profile = await getUserProfile(target);
    if (!profile) {
      return { target, targetUsername: '', targetTitle: '', targetMissing: true };
    }
    return {
      target,
      targetUsername: String(profile.username || ''),
      targetTitle: [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim(),
      targetMissing: false,
    };
  }

  const chat = await getChat(target);
  if (!chat) {
    return { target, targetUsername: '', targetTitle: '', targetMissing: true };
  }
  return {
    target,
    targetUsername: String(chat.username || ''),
    targetTitle: String(chat.title || ''),
    targetMissing: false,
  };
}

/**
 * Все дополнительные юзернеймы с данными их целей.
 * @returns {Promise<Array<{name: string, type: string, target: string,
 *           at: number, by: string, targetUsername: string,
 *           targetTitle: string, targetMissing: boolean}>>}
 */
export async function listUsernameAliases() {
  let snapshot;
  try {
    snapshot = await get(ref(db, 'username_aliases'));
  } catch (error) {
    console.error('Не удалось загрузить дополнительные юзернеймы:', error);
    if (isPermissionDenied(error)) {
      throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
    }
    throw new Error('Не удалось загрузить дополнительные юзернеймы');
  }

  const value = snapshot.val() || {};
  const entries = Object.entries(value)
    .filter(([, record]) => record && typeof record === 'object' && record.target)
    .map(([name, record]) => ({
      name,
      type: cleanAliasType(record.type),
      target: String(record.target),
      at: Number(record.at) || 0,
      by: String(record.by || ''),
    }));

  const described = await Promise.all(
    entries.map((entry) => describeAliasTarget(entry.type, entry.target)),
  );

  return entries
    .map((entry, index) => ({ ...entry, ...described[index] }))
    .sort((left, right) => (right.at - left.at) || left.name.localeCompare(right.name));
}

/**
 * Найти цель для выдачи дополнительных юзернеймов.
 * Принимает основной @username, уже выданный дополнительный @username или ID.
 * @returns {Promise<{type: string, target: string, username: string,
 *           title: string, email: string}>}
 */
export async function resolveAliasTarget(rawType, rawTarget) {
  const type = cleanAliasType(rawType);
  const raw = String(rawTarget || '').trim();
  if (!raw) throw new Error('Укажите @username или ID');

  const normalized = normalizeUsername(raw);
  const alias = normalized ? await getUsernameAlias(normalized) : null;
  let target = '';
  let chat = null;
  let profile = null;

  if (alias && alias.type === type) {
    target = alias.target;
  } else if (type === 'user') {
    if (normalized && isValidUsername(normalized)) {
      profile = await getUserByUsername(normalized);
      if (profile) target = profile.uid;
    }
    if (!target) {
      profile = await getUserProfile(raw);
      if (profile) target = raw;
    }
  } else {
    chat = await getChat(raw);
    if (chat) {
      target = raw;
    } else if (normalized && isValidUsername(normalized)) {
      const found = type === 'channel'
        ? await searchChannelsByPrefix(normalized, 10)
        : await searchGroupsByPrefix(normalized, 10);
      const exact = found.find((item) => (
        item.chatId === normalized || normalizeUsername(item.username) === normalized
      ));
      if (exact) {
        target = exact.chatId;
        chat = exact;
      }
    }
  }

  if (!target) throw new Error('Цель не найдена — проверьте @username или ID');

  if (type === 'user') {
    if (!profile) profile = await getUserProfile(target);
    if (!profile) throw new Error('Пользователь не найден');
    if (profile.deleted) throw new Error('Нельзя выдать юзернейм удалённому аккаунту');
    return {
      type,
      target,
      username: String(profile.username || ''),
      title: [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim(),
      email: String(profile.email || '').trim().toLowerCase(),
    };
  }

  if (!chat) chat = await getChat(target);
  if (!chat) throw new Error('Чат не найден');
  if (chat.type !== type) {
    throw new Error(type === 'channel' ? 'Это не канал' : 'Это не группа');
  }
  if (type === 'group' && chat.groupType !== 'public') {
    throw new Error('Приватной группе нельзя выдать юзернейм — сначала сделайте её публичной');
  }

  return {
    type,
    target,
    username: String(chat.username || ''),
    title: String(chat.title || ''),
    email: '',
  };
}

/** uid из записи /login_index (поддерживает старый строковый формат). */
function loginIndexUid(record) {
  if (!record || typeof record !== 'object') return '';
  return String(record.uid || '');
}

/**
 * Выдать дополнительные юзернеймы пользователю, каналу или группе.
 * Занятые имена, уже выданные и совпадающие с основным пропускаются.
 *
 * @param {{ names: string|string[], type: 'user'|'channel'|'group',
 *           target: string, uid: string }} options
 * @returns {Promise<{added: string[], skipped: Array<{name: string, reason: string}>,
 *           target: object}>}
 */
export async function assignUsernameAliases({ names = [], type = 'user', target = '', uid } = {}) {
  if (!uid) throw new Error('Сначала войдите в аккаунт');

  const resolved = await resolveAliasTarget(type, target);
  const { valid, invalid } = parseUsernameList(names);
  if (!valid.length && !invalid.length) throw new Error('Введите один или несколько юзернеймов');

  // /login_index читается только по конкретному имени: общего правила на
  // узел нет, запрос всего узла база отклоняет. Берём записи по каждому
  // введённому имени и на ошибку отдельного чтения не натыкаемся.
  const loginEntries = await Promise.all(valid.map((name) => (
    get(ref(db, `login_index/${name}`)).then((snapshot) => snapshot.val(), () => null)
  )));

  let snapshots;
  try {
    snapshots = await Promise.all([
      get(ref(db, 'username_aliases')),
      get(ref(db, 'usernames')),
      get(ref(db, 'channel_usernames')),
      get(ref(db, 'group_usernames')),
      get(ref(db, 'reserved_usernames')),
    ]);
  } catch (error) {
    console.error('Не удалось проверить дополнительные юзернеймы:', error);
    if (isPermissionDenied(error)) {
      throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
    }
    throw new Error('Не удалось проверить дополнительные юзернеймы');
  }

  const aliases = snapshots[0].val() || {};
  const users = snapshots[1].val() || {};
  const channels = snapshots[2].val() || {};
  const groups = snapshots[3].val() || {};
  const reserved = snapshots[4].val() || {};
  const loginIndex = {};
  valid.forEach((name, index) => {
    if (loginEntries[index]) loginIndex[name] = loginEntries[index];
  });

  const added = [];
  const skipped = invalid.map((name) => ({ name, reason: 'invalid' }));
  const updates = {};
  const createdAt = nowSeconds();
  const ownUsername = normalizeUsername(resolved.username);

  valid.forEach((name) => {
    if (name === ownUsername) {
      skipped.push({ name, reason: 'own' });
      return;
    }
    if (users[name] || channels[name] || groups[name]) {
      skipped.push({ name, reason: 'taken' });
      return;
    }
    // Зарезервированные имена остаются за владельцем: их нельзя занять
    // обычным путём, значит и в обход, через выдачу, тоже.
    if (reserved[name]) {
      skipped.push({ name, reason: 'reserved' });
      return;
    }
    if (aliases[name]) {
      skipped.push({ name, reason: 'alias' });
      return;
    }
    if (loginIndex[name] && loginIndexUid(loginIndex[name]) !== resolved.target) {
      skipped.push({ name, reason: 'taken' });
      return;
    }

    updates[`username_aliases/${name}`] = {
      type: resolved.type,
      target: resolved.target,
      at: createdAt,
      by: uid,
    };
    // Вход по основному @username работает через /login_index. Для
    // дополнительного имени храним тот же публичный индекс, чтобы
    // «все вести на основной» работало и на экране входа.
    if (resolved.type === 'user' && resolved.email) {
      updates[`login_index/${name}`] = { uid: resolved.target, email: resolved.email };
    }
    added.push(name);
  });

  if (added.length) {
    try {
      await update(ref(db), updates);
    } catch (error) {
      console.error('Не удалось выдать дополнительные юзернеймы:', error);
      if (isPermissionDenied(error)) {
        throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
      }
      throw new Error('Не удалось выдать дополнительные юзернеймы');
    }
  }

  return { added, skipped, target: resolved };
}

/**
 * Забрать дополнительные юзернеймы. Вместе с ними убирается запись
 * /login_index, если она вела на цель, а не на основной юзернейм.
 *
 * @param {string|string[]} names
 * @returns {Promise<{removed: string[], skipped: Array<{name: string, reason: string}>}>}
 */
export async function removeUsernameAliases(names = []) {
  const { valid, invalid } = parseUsernameList(names);
  if (!valid.length && !invalid.length) throw new Error('Введите один или несколько юзернеймов');

  // /login_index читается по одному имени: общего правила на узел нет.
  const loginEntries = await Promise.all(valid.map((name) => (
    get(ref(db, `login_index/${name}`)).then((snapshot) => snapshot.val(), () => null)
  )));

  let snapshots;
  try {
    snapshots = await Promise.all([
      get(ref(db, 'username_aliases')),
      get(ref(db, 'usernames')),
    ]);
  } catch (error) {
    console.error('Не удалось прочитать дополнительные юзернеймы:', error);
    if (isPermissionDenied(error)) {
      throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
    }
    throw new Error('Не удалось прочитать дополнительные юзернеймы');
  }

  const aliases = snapshots[0].val() || {};
  const users = snapshots[1].val() || {};
  const loginIndex = {};
  valid.forEach((name, index) => {
    if (loginEntries[index]) loginIndex[name] = loginEntries[index];
  });

  const removed = [];
  const skipped = invalid.map((name) => ({ name, reason: 'invalid' }));
  const updates = {};

  valid.forEach((name) => {
    const record = aliases[name];
    if (!record || typeof record !== 'object') {
      skipped.push({ name, reason: 'missing' });
      return;
    }

    updates[`username_aliases/${name}`] = null;
    removed.push(name);

    if (record.type === 'user' && !users[name]) {
      const loginUid = loginIndexUid(loginIndex[name]);
      if (loginUid && loginUid === String(record.target || '')) {
        updates[`login_index/${name}`] = null;
      }
    }
  });

  if (removed.length) {
    try {
      await update(ref(db), updates);
    } catch (error) {
      console.error('Не удалось забрать дополнительные юзернеймы:', error);
      if (isPermissionDenied(error)) {
        throw new Error('Нет доступа. Проверьте, что обновлённые правила базы опубликованы.');
      }
      throw new Error('Не удалось забрать дополнительные юзернеймы');
    }
  }

  return { removed, skipped };
}

/**
 * Дополнительные имена по префиксу для поиска. Ошибка чтения не должна
 * ломать обычный поиск по основным индексам.
 */
async function searchAliasEntries(prefix, type, limit) {
  const normalized = normalizeUsername(prefix);
  if (!normalized) return [];

  try {
    const aliasQuery = query(
      ref(db, 'username_aliases'),
      orderByKey(),
      startAt(normalized),
      endAt(normalized + PREFIX_END),
      limitToFirst(limit),
    );
    const snapshot = await get(aliasQuery);
    const entries = [];
    snapshot.forEach((child) => {
      const value = child.val() || {};
      if (value.type === type && value.target) {
        entries.push({ name: child.key, target: String(value.target) });
      }
    });
    return entries;
  } catch (error) {
    console.warn('Не удалось найти дополнительные юзернеймы:', error);
    return [];
  }
}

/* ============================================================
 *  Профили пользователей
 * ============================================================ */

/** Заполнен ли обязательный профиль (юзернейм и имя; фамилия необязательна). */
export function isProfileComplete(profile) {
  return Boolean(profile && profile.username && profile.firstName);
}

/** Разрешённый формат цвета фона аватарки: #rrggbb. */
const AVATAR_COLOR_REGEX = /^#[0-9a-f]{6}$/;

/**
 * Проверить и нормализовать аватарку пользователя:
 * буква или эмодзи на сплошном цвете либо на градиенте.
 *
 * @param {object|null} raw
 * @returns {{kind: 'letter'|'emoji', value: string, bgType: 'solid'|'gradient',
 *            bg1: string, bg2?: string, size: number}|null} null — аватарка по умолчанию (инициалы)
 */
function cleanAvatar(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const kind = raw.kind === 'emoji' ? 'emoji' : 'letter';
  let value = String(raw.value || '').trim();
  if (kind === 'emoji') {
    value = [...value].slice(0, 4).join(''); // эмодзи бывают составными
  } else {
    value = value.replace(/[^0-9A-Za-zА-Яа-яЁё]/g, '').charAt(0).toUpperCase();
  }
  if (!value) return null;

  const bg1 = String(raw.bg1 || '').toLowerCase();
  const bg2 = String(raw.bg2 || '').toLowerCase();
  if (!AVATAR_COLOR_REGEX.test(bg1)) return null;

  // Размер буквы/эмодзи: проценты от базового (50–200, шаг 5, по умолчанию 100).
  const sizeRaw = Number(raw.size);
  const size = Number.isFinite(sizeRaw)
    ? Math.min(200, Math.max(50, Math.round(sizeRaw / 5) * 5))
    : 100;

  const gradient = raw.bgType === 'gradient' && AVATAR_COLOR_REGEX.test(bg2);
  return gradient
    ? { kind, value, bgType: 'gradient', bg1, bg2, size }
    : { kind, value, bgType: 'solid', bg1, size };
}

/**
 * Профиль из кэша.
 * @returns {object|null|undefined} undefined — ещё не загружался.
 */
export function getCachedUserProfile(uid) {
  return usersCache.has(uid) ? usersCache.get(uid) : undefined;
}

/**
 * Загрузить профиль /users/$uid с кэшированием.
 * @param {string} uid
 * @param {{ force?: boolean }} options — force: перечитать из базы
 */
export async function getUserProfile(uid, { force = false } = {}) {
  if (!uid) return null;
  if (!force && usersCache.has(uid)) return usersCache.get(uid);

  try {
    const snapshot = await get(ref(db, `users/${uid}`));
    usersCache.set(uid, snapshot.val() || null);
  } catch (error) {
    console.error(`Не удалось загрузить профиль ${uid}:`, error);
    usersCache.set(uid, null);
  }
  return usersCache.get(uid);
}

/**
 * Подписка на профиль /users/$uid в реальном времени.
 * Кэш обновляется до вызова обработчика, поэтому все следующие
 * getCachedUserProfile() сразу видят свежие имя, био и аватарку.
 *
 * @param {string} uid
 * @param {(profile: object|null) => void} onChange — вызывается при каждом изменении
 * @param {((error: Error) => void)|null} onError
 * @returns {() => void} функция отписки
 */
export function subscribeToUserProfile(uid, onChange, onError = null) {
  if (!uid || typeof onChange !== 'function') return () => {};

  let entry = userProfileSubscriptions.get(uid);
  if (!entry) {
    const listeners = new Set();
    const unsubscribe = onValue(
      ref(db, `users/${uid}`),
      (snapshot) => {
        const profile = snapshot.val() || null;
        usersCache.set(uid, profile);
        for (const listener of [...listeners]) {
          try {
            listener.onChange(profile);
          } catch (error) {
            console.error(`Ошибка обработчика профиля ${uid}:`, error);
          }
        }
      },
      (error) => {
        console.error(`Ошибка подписки на профиль ${uid}:`, error);
        for (const listener of [...listeners]) {
          if (!listener.onError) continue;
          try {
            listener.onError(error);
          } catch (listenerError) {
            console.error(`Ошибка обработчика профиля ${uid}:`, listenerError);
          }
        }
      },
    );
    entry = { unsubscribe, listeners };
    userProfileSubscriptions.set(uid, entry);
  }

  const registration = { onChange, onError };
  entry.listeners.add(registration);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const current = userProfileSubscriptions.get(uid);
    if (!current) return;
    current.listeners.delete(registration);
    if (current.listeners.size) return;
    current.unsubscribe();
    userProfileSubscriptions.delete(uid);
  };
}

/**
 * Найти пользователя по юзернейму (через индекс /usernames).
 * @param {string} rawUsername — можно передавать с «@»
 * @returns {Promise<({uid: string} & Record<string, unknown>) | null>}
 */
export async function getUserByUsername(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) return null;

  const snapshot = await get(ref(db, `usernames/${username}`));
  let uid = snapshot.val();

  // Дополнительный юзернейм ведёт на основной профиль владельца.
  if (!uid) {
    const alias = await getUsernameAlias(username);
    if (!alias || alias.type !== 'user') return null;
    uid = alias.target;
  }
  if (!uid) return null;

  const profile = await getUserProfile(uid);
  if (!profile) return null;
  return {
    uid,
    ...profile,
    username: String(profile.username || username),
  };
}

/**
 * Создать/обновить профиль пользователя. Юзернейм уникален:
 * новый захватывается транзакцией, старый освобождается.
 *
 * @param {string} uid
 * @param {{ username: string, firstName: string, lastName?: string, bio?: string,
 *           avatar?: object }} data
 * @param {string|null} previousUsername — текущий юзернейм (null при первом заполнении)
 * @returns {Promise<object>} обновлённый профиль
 */
export async function updateUserProfile(uid, data, previousUsername = null) {
  const username = normalizeUsername(data.username);
  const firstName = String(data.firstName || '').trim();
  const lastName = String(data.lastName || '').trim();
  const bio = String(data.bio || '').trim();
  const avatar = cleanAvatar(data.avatar);

  if (!isValidUsername(username)) throw new Error(USERNAME_ERROR);
  if (!firstName) throw new Error('Укажите имя');

  const prev = previousUsername ? normalizeUsername(previousUsername) : null;
  const claimedNew = username !== prev;

  if (claimedNew) await claimUsername(uid, username);

  const updates = {
    [`users/${uid}/username`]: username,
    [`users/${uid}/firstName`]: firstName,
    [`users/${uid}/lastName`]: lastName || null,
    [`users/${uid}/avatar`]: avatar,
    [`users/${uid}/bio`]: bio || null,
  };
  if (claimedNew && prev) updates[`usernames/${prev}`] = null;

  try {
    await update(ref(db), updates);
  } catch (error) {
    // Не оставляем «висячий» захваченный юзернейм.
    if (claimedNew) await set(ref(db, `usernames/${username}`), null).catch(() => {});
    throw error;
  }

  // Публичный индекс входа @username -> { uid, email }. Пишем отдельным
  // шагом и best-effort: сбой индекса не должен ломать сохранение профиля.
  const accountEmail = auth.currentUser?.uid === uid
    ? String(auth.currentUser.email || '').trim().toLowerCase()
    : '';
  const indexUpdates = {};
  if (accountEmail) indexUpdates[`login_index/${username}`] = { uid, email: accountEmail };
  if (prev && prev !== username) indexUpdates[`login_index/${prev}`] = null;
  if (Object.keys(indexUpdates).length) {
    await update(ref(db), indexUpdates).catch((error) => {
      console.warn('Не удалось обновить индекс входа:', error);
    });
  }

  usersCache.delete(uid);
  return getUserProfile(uid, { force: true });
}

/**
 * Дозаполнить публичный индекс входа для существующих аккаунтов.
 * Доступно супер-админам; операция идемпотентна.
 * @returns {Promise<number>} сколько записей записано
 */
export async function backfillLoginIndex() {
  const [usernamesSnap, usersSnap] = await Promise.all([
    get(ref(db, 'usernames')),
    get(ref(db, 'users')),
  ]);
  const usernames = usernamesSnap.val() || {};
  const users = usersSnap.val() || {};
  const updates = {};

  // Канонический источник — /usernames: старые/отвязанные имена из
  // /users/$uid/username не должны становиться дополнительным входом.
  for (const [name, uid] of Object.entries(usernames)) {
    const email = String(users[uid]?.email || '').trim().toLowerCase();
    if (name && email) updates[`login_index/${name}`] = { uid, email };
  }

  const count = Object.keys(updates).length;
  if (count) await update(ref(db), updates);
  return count;
}

/**
 * Префиксный поиск пользователей по юзернейму.
 * @param {string} prefix — минимум 1 символ (без «@»)
 * @param {number} limit
 * @returns {Promise<Array<{uid: string, username: string} & Record<string, unknown>>>}
 */
export async function searchUsersByPrefix(prefix, limit = 10) {
  const normalized = normalizeUsername(prefix);
  if (!normalized) return [];

  const usersQuery = query(
    ref(db, 'usernames'),
    orderByKey(),
    startAt(normalized),
    endAt(normalized + PREFIX_END),
    limitToFirst(limit),
  );
  const [snapshot, aliasEntries] = await Promise.all([
    get(usersQuery),
    searchAliasEntries(normalized, 'user', limit),
  ]);

  // Внимание: колбэк forEach обязан возвращать undefined (тело в блоках).
  // SDK прекращает перебор, если колбэк вернёт истинное значение, а
  // Array.push возвращает число — выражение-стрелка здесь «съело» бы всех детей кроме первого.
  const found = [];
  snapshot.forEach((child) => {
    found.push({ username: child.key, uid: child.val() });
  });

  const users = [];
  const seen = new Set();
  for (const entry of found) {
    const profile = await getUserProfile(entry.uid);
    if (!profile || seen.has(entry.uid)) continue;
    seen.add(entry.uid);
    users.push({ uid: entry.uid, ...profile, username: profile.username || entry.username });
  }

  // Дополнительные имена показываются как основной профиль цели.
  for (const entry of aliasEntries) {
    if (seen.has(entry.target)) continue;
    const profile = await getUserProfile(entry.target);
    if (!profile) continue;
    seen.add(entry.target);
    users.push({ uid: entry.target, ...profile, username: profile.username || entry.name });
  }
  return users.slice(0, limit);
}

/* ============================================================
 *  Чаты: чтение и создание
 * ============================================================ */

/** Загрузить узел одного чата (например, для предпросмотра канала). */
export async function getChat(chatId) {
  const snapshot = await get(ref(db, `chats/${chatId}`));
  return snapshot.val() || null;
}

/** Детерминированный id личного чата — дубликаты невозможны. */
function buildPrivateChatId(uidA, uidB) {
  return `private_${[uidA, uidB].sort().join('_')}`;
}

/**
 * Создать (или открыть уже существующий) личный чат двух пользователей.
 * @returns {Promise<string>} id чата
 */
export async function createPrivateChat(myUid, peerUid) {
  if (!myUid || !peerUid) throw new Error('Не указаны участники личного чата');
  if (myUid === peerUid) throw new Error('Нельзя создать чат с самим собой');

  const chatId = buildPrivateChatId(myUid, peerUid);
  const snapshot = await get(ref(db, `chats/${chatId}`));

  if (!snapshot.exists()) {
    await update(ref(db), {
      [`chats/${chatId}`]: {
        type: 'private',
        createdAt: nowSeconds(),
        users: { [myUid]: true, [peerUid]: true },
      },
    });
  }

  // Идемпотентно добавляем чат в списки обоих участников — после создания
  // узла чата, чтобы правила БД уже видели обоих участников.
  await update(ref(db), {
    [`user_chats/${myUid}/${chatId}`]: true,
    [`user_chats/${peerUid}/${chatId}`]: true,
  });
  return chatId;
}

/**
 * Создать группу. Владелец автоматически становится участником.
 * Тип «private» — участники добавляются по юзернеймам;
 * тип «public» — обязателен юзернейм группы, по которому её находят
 * и присоединяются (индекс /group_usernames).
 *
 * @param {string} ownerUid
 * @param {{ title: string, description?: string, type?: 'private'|'public',
 *           username?: string, memberUids?: string[] }} data
 * @returns {Promise<string>} id чата
 */
export async function createGroupChat(ownerUid, {
  title,
  description = '',
  type = 'private',
  username = '',
  memberUids = [],
} = {}) {
  const cleanTitle = String(title || '').trim();
  const cleanDescription = String(description || '').trim();
  if (!cleanTitle) throw new Error('Укажите название группы');

  const isPublic = type === 'public';
  let cleanUsername = '';
  if (isPublic) {
    cleanUsername = normalizeUsername(username);
    if (!isValidUsername(cleanUsername)) throw new Error('Юзернейм группы: 3–32 символа (a–z, 0–9, «_»)');
  }

  const chatId = push(ref(db, 'chats')).key;

  const users = { [ownerUid]: true };
  if (!isPublic) {
    memberUids.filter(Boolean).forEach((uid) => {
      if (uid !== ownerUid) users[uid] = true;
    });
  }

  // 1. Узел группы — до захвата юзернейма и списков: правила БД проверяют
  //    владельца уже существующего чата.
  await update(ref(db), {
    [`chats/${chatId}`]: {
      type: 'group',
      groupType: isPublic ? 'public' : 'private',
      title: cleanTitle,
      owner: ownerUid,
      createdAt: nowSeconds(),
      users,
      ...(cleanDescription ? { description: cleanDescription } : {}),
      ...(isPublic ? { username: cleanUsername } : {}),
    },
  });

  // 2. Захват юзернейма публичной группы (атомарно).
  if (isPublic) {
    try {
      await claimGroupUsername(chatId, cleanUsername);
    } catch (error) {
      await set(ref(db, `chats/${chatId}`), null).catch(() => {});
      throw error;
    }
  }

  // 3. Списки участников — группа к этому моменту уже существует.
  const updates = {};
  Object.keys(users).forEach((uid) => {
    updates[`user_chats/${uid}/${chatId}`] = true;
  });
  try {
    await update(ref(db), updates);
  } catch (error) {
    // Не оставляем «висячий» юзернейм и пустую группу.
    if (isPublic) await set(ref(db, `group_usernames/${cleanUsername}`), null).catch(() => {});
    await set(ref(db, `chats/${chatId}`), null).catch(() => {});
    throw error;
  }

  return chatId;
}

/**
 * Создать канал. Обязательны юзернейм (по нему находят и подписываются)
 * и название. Создатель — владелец, админ и первый подписчик.
 *
 * @param {string} ownerUid
 * @param {{ username: string, title: string, description?: string }} data
 * @returns {Promise<string>} id канала
 */
export async function createChannel(ownerUid, { username, title, description = '' }) {
  const cleanUsername = normalizeUsername(username);
  const cleanTitle = String(title || '').trim();
  const cleanDescription = String(description || '').trim();

  if (!isValidUsername(cleanUsername)) throw new Error(USERNAME_ERROR);
  if (!cleanTitle) throw new Error('Укажите название канала');

  const chatId = push(ref(db, 'chats')).key;

  // 1. Узел канала — до захвата юзернейма: правила БД проверяют владельца.
  await update(ref(db), {
    [`chats/${chatId}`]: {
      type: 'channel',
      username: cleanUsername,
      title: cleanTitle,
      description: cleanDescription,
      owner: ownerUid,
      createdAt: nowSeconds(),
      subscribersCount: 1,
      // По умолчанию канал читают только подписчики: так было и раньше.
      requiresSubscription: true,
      admins: { [ownerUid]: true },
      subscribers: { [ownerUid]: true },
    },
  });

  // 2. Захват юзернейма канала (атомарно).
  try {
    await claimChannelUsername(chatId, cleanUsername);
  } catch (error) {
    await set(ref(db, `chats/${chatId}`), null).catch(() => {});
    throw error;
  }

  // 3. Подписка владельца.
  try {
    await update(ref(db), { [`user_chats/${ownerUid}/${chatId}`]: true });
  } catch (error) {
    // Не оставляем «висячий» юзернейм и пустой канал.
    await set(ref(db, `channel_usernames/${cleanUsername}`), null).catch(() => {});
    await set(ref(db, `chats/${chatId}`), null).catch(() => {});
    throw error;
  }

  return chatId;
}

/**
 * Подписаться на канал: запись в /user_chats, список подписчиков и счётчик.
 * Повторный вызов для уже подписанного пользователя ничего не меняет.
 * @returns {Promise<void>}
 */
export async function subscribeToChannel(uid, chatId) {
  const already = (await get(ref(db, `user_chats/${uid}/${chatId}`))).val();
  if (already) return;

  const updates = {
    [`user_chats/${uid}/${chatId}`]: true,
    [`chats/${chatId}/subscribers/${uid}`]: true,
    // Пользователь подписался сам — авто-подписка администратора не нужна.
    [`chats/${chatId}/auto_subscribed/${uid}`]: null,
    [`chats/${chatId}/subscribersCount`]: increment(1),
  };
  await update(ref(db), updates);
}

/**
 * Отписаться от канала / покинуть его. Администратор при выходе теряет
 * права администратора; владелец выйти не может.
 * @returns {Promise<void>}
 */
export async function unsubscribeFromChannel(uid, chatId) {
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Чат не найден');
  if (chat.owner === uid) {
    throw new Error(chat.type === 'channel'
      ? 'Владелец не может отписаться от своего канала'
      : 'Владелец не может покинуть свой чат');
  }

  const subscribed = Boolean((await get(ref(db, `user_chats/${uid}/${chatId}`))).val());
  const updates = {
    [`user_chats/${uid}/${chatId}`]: null,
    [`user_chat_meta/${uid}/${chatId}`]: null,
    [`chats/${chatId}/auto_subscribed/${uid}`]: null,
  };
  // Покидая канал, администратор снимает с себя права администратора.
  if (chat.admins?.[uid]) updates[`chats/${chatId}/admins/${uid}`] = null;
  if (chat.subscribers?.[uid]) updates[`chats/${chatId}/subscribers/${uid}`] = null;
  if (subscribed) updates[`chats/${chatId}/subscribersCount`] = increment(-1);

  await update(ref(db), updates);
}

/**
 * Префиксный поиск каналов по юзернейму канала.
 * @param {string} prefix — минимум 1 символ (без «@»)
 * @param {number} limit
 * @returns {Promise<Array<object>>} узлы каналов с полем chatId
 */
export async function searchChannelsByPrefix(prefix, limit = 10) {
  const normalized = normalizeUsername(prefix);
  if (!normalized) return [];

  const channelsQuery = query(
    ref(db, 'channel_usernames'),
    orderByKey(),
    startAt(normalized),
    endAt(normalized + PREFIX_END),
    limitToFirst(limit),
  );
  const [snapshot, aliasEntries] = await Promise.all([
    get(channelsQuery),
    searchAliasEntries(normalized, 'channel', limit),
  ]);

  const results = [];
  const entries = [];
  // Тело в блоках: возврат истинного значения из колбэка останавливает перебор (см. комментарий в searchUsersByPrefix).
  snapshot.forEach((child) => {
    entries.push({ username: child.key, chatId: child.val() });
  });
  aliasEntries.forEach((entry) => {
    entries.push({ username: entry.name, chatId: entry.target });
  });

  const seen = new Set();
  for (const entry of entries) {
    if (!entry.chatId || seen.has(entry.chatId)) continue;
    seen.add(entry.chatId);
    const chat = await getChat(entry.chatId);
    if (chat && chat.type === 'channel') {
      results.push({ chatId: entry.chatId, ...chat, username: chat.username || entry.username });
    }
  }
  return results.slice(0, limit);
}

/**
 * Вступить в публичную группу (из поиска): стать участником + добавить
 * чат в список своих. Приватные группы так не работают — в них
 * добавляет владелец.
 *
 * @param {string} uid
 * @param {string} chatId
 * @returns {Promise<void>}
 */
export async function joinGroup(uid, chatId) {
  const chat = await getChat(chatId);
  if (!chat || chat.type !== 'group') throw new Error('Группа не найдена');
  if (chat.groupType !== 'public') throw new Error('Это приватная группа — в неё добавляет владелец');

  const updates = {
    [`chats/${chatId}/users/${uid}`]: true,
    [`user_chats/${uid}/${chatId}`]: true,
  };
  await update(ref(db), updates);
}

/**
 * Префиксный поиск публичных групп по юзернейму группы.
 * @param {string} prefix — минимум 1 символ (без «@»)
 * @param {number} limit
 * @returns {Promise<Array<object>>} узлы групп с полями chatId и memberCount
 */
export async function searchGroupsByPrefix(prefix, limit = 10) {
  const normalized = normalizeUsername(prefix);
  if (!normalized) return [];

  const groupsQuery = query(
    ref(db, 'group_usernames'),
    orderByKey(),
    startAt(normalized),
    endAt(normalized + PREFIX_END),
    limitToFirst(limit),
  );
  const [snapshot, aliasEntries] = await Promise.all([
    get(groupsQuery),
    searchAliasEntries(normalized, 'group', limit),
  ]);

  const entries = [];
  // Тело в блоках: возврат истинного значения из колбэка останавливает перебор (см. комментарий в searchUsersByPrefix).
  snapshot.forEach((child) => {
    entries.push({ username: child.key, chatId: child.val() });
  });
  aliasEntries.forEach((entry) => {
    entries.push({ username: entry.name, chatId: entry.target });
  });

  const results = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.chatId || seen.has(entry.chatId)) continue;
    seen.add(entry.chatId);
    const chat = await getChat(entry.chatId);
    if (chat && chat.type === 'group') {
      results.push({
        chatId: entry.chatId,
        ...chat,
        username: chat.username || entry.username,
        memberCount: Object.keys(chat.users || {}).length,
      });
    }
  }
  return results.slice(0, limit);
}

/**
 * Обновить настройки группы или канала (доступно только владельцу).
 * Группа: название, описание, тип (приватная/публичная), юзернейм публичной
 * группы — с захватом/освобождением индекса /group_usernames.
 * Канал: название, описание и признак «требуется подписка для чтения».
 *
 * @param {string} chatId
 * @param {string} requesterUid
 * @param {{ title: string, description?: string, groupType?: 'private'|'public',
 *           username?: string, requiresSubscription?: boolean }} data
 * @returns {Promise<object>} обновлённый узел чата
 */
export async function updateChatSettings(chatId, requesterUid, data) {
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Чат не найден');
  if (chat.type !== 'group' && chat.type !== 'channel') {
    throw new Error('Настройки доступны только для групп и каналов');
  }
  const isOwner = chat.owner === requesterUid;
  const isRoot = await isRootAdmin(requesterUid);
  const isGroupAdmin = chat.type === 'group' && Boolean(chat.admins?.[requesterUid]);
  if (!isOwner && !isRoot && !isGroupAdmin) {
    throw new Error(chat.type === 'group'
      ? 'Изменять настройки может владелец или администратор группы'
      : 'Изменять настройки может только владелец');
  }

  const cleanTitle = String(data.title || '').trim();
  const cleanDescription = String(data.description || '').trim();
  if (!cleanTitle) throw new Error(chat.type === 'group' ? 'Укажите название группы' : 'Укажите название канала');

  const updates = {
    [`chats/${chatId}/title`]: cleanTitle,
    [`chats/${chatId}/description`]: cleanDescription || null,
  };

  // Канал: читать можно без подписки, если владелец выключил требование.
  // Пишем поле, только когда оно реально изменилось: старые каналы без него
  // ведут себя как «подписка требуется».
  if (chat.type === 'channel' && (isOwner || isRoot) && typeof data.requiresSubscription === 'boolean') {
    const current = chat.requiresSubscription !== false;
    if (current !== data.requiresSubscription) {
      updates[`chats/${chatId}/requiresSubscription`] = data.requiresSubscription;
    }
  }

  let claimed = null;
  // Тип и юзернейм группы меняет только владелец (или супер-админ).
  if (chat.type === 'group' && (isOwner || isRoot)) {
    const oldUsername = chat.username || null;
    const wantPublic = data.groupType === 'public';

    if (wantPublic) {
      const cleanUsername = normalizeUsername(data.username);
      if (!isValidUsername(cleanUsername)) {
        throw new Error('Юзернейм группы: 3–32 символа (a–z, 0–9, «_»)');
      }
      if (cleanUsername !== oldUsername) {
        await claimGroupUsername(chatId, cleanUsername);
        claimed = cleanUsername;
        if (oldUsername) updates[`group_usernames/${oldUsername}`] = null;
      }
      updates[`chats/${chatId}/groupType`] = 'public';
      updates[`chats/${chatId}/username`] = cleanUsername;
    } else {
      updates[`chats/${chatId}/groupType`] = 'private';
      updates[`chats/${chatId}/username`] = null;
      if (oldUsername) updates[`group_usernames/${oldUsername}`] = null;

      // Приватной группе дополнительные юзернеймы не положены: иначе
      // поиск и ссылки вели бы в закрытую группу. Снимаем их вместе
      // с переводом в приватную.
      const aliases = await get(ref(db, 'username_aliases')).then(
        (snapshot) => snapshot.val() || {},
        () => ({}),
      );
      for (const [name, record] of Object.entries(aliases)) {
        if (record && record.type === 'group' && record.target === chatId) {
          updates[`username_aliases/${name}`] = null;
        }
      }
    }
  }

  try {
    await update(ref(db), updates);
  } catch (error) {
    // Не оставляем «висячий» новый юзернейм группы.
    if (claimed) await set(ref(db, `group_usernames/${claimed}`), null).catch(() => {});
    throw error;
  }
  return getChat(chatId);
}

/* ============================================================
 *  Участники и администраторы группы
 * ============================================================ */

/** Может ли пользователь добавлять участников группы. */
async function canManageGroupMembers(chat, uid) {
  if (!uid || chat.type !== 'group') return false;
  if (chat.owner === uid || chat.admins?.[uid]) return true;
  return isRootAdmin(uid);
}

/** Может ли пользователь назначать администраторов группы: владелец или супер-админ. */
async function canManageGroupAdmins(chat, uid) {
  if (!uid || chat.type !== 'group') return false;
  if (chat.owner === uid) return true;
  return isRootAdmin(uid);
}

/**
 * Добавить участника в группу.
 * Добавлять могут владелец, администраторы группы и супер-админ.
 * @returns {Promise<{added: boolean}>} added=false — пользователь уже в группе
 */
export async function addGroupMember(chatId, requesterUid, targetUid) {
  if (!chatId || !requesterUid || !targetUid) throw new Error('Некорректные параметры');
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Группа не найдена');
  if (chat.type !== 'group') throw new Error('Добавлять участников можно только в группы');
  if (!(await canManageGroupMembers(chat, requesterUid))) {
    throw new Error('Добавлять участников может владелец или администратор группы');
  }

  const target = await getUserProfile(targetUid);
  if (!target) throw new Error('Пользователь не найден');
  if (chat.users?.[targetUid] || chat.owner === targetUid) return { added: false };

  await update(ref(db), {
    [`chats/${chatId}/users/${targetUid}`]: true,
    [`user_chats/${targetUid}/${chatId}`]: true,
  });
  return { added: true };
}

/**
 * Назначить администратора группы. Назначает владелец или супер-админ;
 * пользователь должен уже состоять в группе.
 * @returns {Promise<void>}
 */
export async function addGroupAdmin(chatId, requesterUid, targetUid) {
  if (!chatId || !requesterUid || !targetUid) throw new Error('Некорректные параметры');
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Группа не найдена');
  if (chat.type !== 'group') throw new Error('Администраторы есть только у групп');
  if (!(await canManageGroupAdmins(chat, requesterUid))) {
    throw new Error('Назначать администраторов может только владелец группы');
  }
  if (targetUid === chat.owner) throw new Error('Владелец уже администратор');
  if (!chat.users?.[targetUid]) throw new Error('Сначала добавьте пользователя в группу');

  await set(ref(db, `chats/${chatId}/admins/${targetUid}`), true);
}

/**
 * Снять администратора группы. Владельца снять нельзя.
 * @returns {Promise<void>}
 */
export async function removeGroupAdmin(chatId, requesterUid, targetUid) {
  if (!chatId || !requesterUid || !targetUid) throw new Error('Некорректные параметры');
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Группа не найдена');
  if (chat.type !== 'group') throw new Error('Администраторы есть только у групп');
  if (!(await canManageGroupAdmins(chat, requesterUid))) {
    throw new Error('Снимать администраторов может только владелец группы');
  }
  if (targetUid === chat.owner) throw new Error('Нельзя снять владельца группы');

  await set(ref(db, `chats/${chatId}/admins/${targetUid}`), null);
}

/**
 * Покинуть группу. Владелец покинуть группу не может — он должен удалить её.
 * Снимаем участие, права администратора и запись в списке чатов.
 * @returns {Promise<void>}
 */
export async function leaveGroup(chatId, uid) {
  if (!chatId || !uid) throw new Error('Некорректные параметры');
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Группа не найдена');
  if (chat.type !== 'group') throw new Error('Покинуть можно только группу');
  if (chat.owner === uid) throw new Error('Владелец не может покинуть группу — удалите её');
  if (!chat.users?.[uid]) return;

  await update(ref(db), {
    [`chats/${chatId}/users/${uid}`]: null,
    [`chats/${chatId}/admins/${uid}`]: null,
    [`user_chats/${uid}/${chatId}`]: null,
    [`typing/${chatId}/${uid}`]: null,
  });
}

/**
 * Удалить участника из группы. Доступно владельцу группы и супер-админу:
 * администраторы группы могут только добавлять участников.
 * @returns {Promise<{removed: boolean}>} removed=false — пользователя не было в группе
 */
export async function removeGroupMember(chatId, requesterUid, targetUid) {
  if (!chatId || !requesterUid || !targetUid) throw new Error('Некорректные параметры');
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Группа не найдена');
  if (chat.type !== 'group') throw new Error('Удалять участников можно только из групп');
  if (!(await canManageGroupAdmins(chat, requesterUid))) {
    throw new Error('Удалять участников может только владелец группы');
  }
  if (targetUid === chat.owner) throw new Error('Нельзя удалить владельца группы');
  if (!chat.users?.[targetUid]) return { removed: false };

  await update(ref(db), {
    [`chats/${chatId}/users/${targetUid}`]: null,
    [`chats/${chatId}/admins/${targetUid}`]: null,
    [`user_chats/${targetUid}/${chatId}`]: null,
  });
  return { removed: true };
}

/* ============================================================
 *  Администраторы канала
 * ============================================================ */

/** Может ли пользователь управлять админами канала: владелец или супер-админ. */
async function canManageChannelAdmins(chat, uid) {
  if (!uid) return false;
  if (chat.owner === uid) return true;
  return isRootAdmin(uid);
}

/**
 * Добавить администратора канала (админы могут писать в канал и смотреть
 * статистику). Нового админа автоматически подписываем на канал.
 * @returns {Promise<void>}
 */
export async function addChannelAdmin(chatId, requesterUid, targetUid) {
  if (!chatId || !requesterUid || !targetUid) throw new Error('Некорректные параметры');
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Чат не найден');
  if (chat.type !== 'channel') throw new Error('Администраторы есть только у каналов');
  if (!(await canManageChannelAdmins(chat, requesterUid))) {
    throw new Error('Управлять администраторами может только владелец канала');
  }
  if (targetUid === chat.owner) throw new Error('Владелец уже администратор');

  const target = await getUserProfile(targetUid);
  if (!target) throw new Error('Пользователь не найден');

  const updates = { [`chats/${chatId}/admins/${targetUid}`]: true };

  // Подписываем нового админа, если он ещё не подписан. Запоминаем, что
  // подписка автоматическая: при снятии админа её откатим (см. removeChannelAdmin).
  const subscribed = (await get(ref(db, `user_chats/${targetUid}/${chatId}`))).val();
  if (!subscribed) {
    updates[`user_chats/${targetUid}/${chatId}`] = true;
    updates[`chats/${chatId}/subscribers/${targetUid}`] = true;
    updates[`chats/${chatId}/auto_subscribed/${targetUid}`] = true;
    updates[`chats/${chatId}/subscribersCount`] = increment(1);
  }

  await update(ref(db), updates);
}

/**
 * Снять администратора канала. Владельца снять нельзя.
 * @returns {Promise<void>}
 */
export async function removeChannelAdmin(chatId, requesterUid, targetUid) {
  if (!chatId || !requesterUid || !targetUid) throw new Error('Некорректные параметры');
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Чат не найден');
  if (chat.type !== 'channel') throw new Error('Администраторы есть только у каналов');
  if (!(await canManageChannelAdmins(chat, requesterUid))) {
    throw new Error('Управлять администраторами может только владелец канала');
  }
  if (targetUid === chat.owner) throw new Error('Нельзя снять владельца канала');

  // Если подписка была автоматической (при добавлении в админы) — при снятии
  // админа откатываем её: канал не должен оставаться в подписках пользователя.
  const autoSubscribed = Boolean(
    (await get(ref(db, `chats/${chatId}/auto_subscribed/${targetUid}`))).val()
  );

  const updates = {
    [`chats/${chatId}/admins/${targetUid}`]: null,
    [`chats/${chatId}/auto_subscribed/${targetUid}`]: null,
  };

  if (autoSubscribed) {
    updates[`user_chats/${targetUid}/${chatId}`] = null;
    updates[`user_chat_meta/${targetUid}/${chatId}`] = null;
    updates[`chats/${chatId}/subscribers/${targetUid}`] = null;
    updates[`chats/${chatId}/subscribersCount`] = increment(-1);
  }

  await update(ref(db), updates);
}

/* ============================================================
 *  Логотип канала
 * ============================================================ */

/**
 * Настроить аватар группы или логотип канала: буква/эмодзи на цвете/градиенте.
 * avatar = null — вернуть стандартную букву названия.
 * Менять может владелец чата или супер-админ.
 * @param {{kind?: string, value: string, bgType?: string, bg1: string, bg2?: string, size?: number}|null} avatar
 * @returns {Promise<void>}
 */
export async function updateChatAvatar(chatId, requesterUid, avatar) {
  if (!chatId || !requesterUid) throw new Error('Некорректные параметры');
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Чат не найден');
  if (chat.type !== 'channel' && chat.type !== 'group') {
    throw new Error('Аватар можно настроить только у группы или канала');
  }
  const isGroupAdmin = chat.type === 'group' && Boolean(chat.admins?.[requesterUid]);
  if (chat.owner !== requesterUid && !isGroupAdmin && !(await isRootAdmin(requesterUid))) {
    throw new Error(chat.type === 'group'
      ? 'Менять аватар может владелец или администратор группы'
      : 'Менять логотип может только владелец канала');
  }

  let cleanAvatar = null;
  if (avatar) {
    const kind = avatar.kind === 'emoji' ? 'emoji' : 'letter';
    const rawValue = String(avatar.value || '').trim();
    const value = kind === 'letter'
      ? rawValue.replace(/[^0-9A-Za-zА-Яа-яЁё]/g, '').charAt(0).toUpperCase()
      : [...rawValue].slice(0, 4).join('');
    if (!value) throw new Error('Укажите букву или эмодзи для логотипа');

    // Нормализуем hex-цвета: #abc -> #aabbcc, без «#» — добавим.
    const hex = (raw) => {
      let v = String(raw || '').trim().toLowerCase();
      if (!v) return null;
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + [...v.slice(1)].map((c) => c + c).join('');
      return /^#[0-9a-f]{6}$/.test(v) ? v : null;
    };
    const bg1 = hex(avatar.bg1);
    if (!bg1) throw new Error('Некорректный цвет логотипа');
    const bgType = avatar.bgType === 'gradient' ? 'gradient' : 'solid';
    const bg2 = bgType === 'gradient' ? (hex(avatar.bg2) || bg1) : null;
    const size = Math.min(200, Math.max(50, Number(avatar.size) || 100));

    cleanAvatar = bgType === 'gradient'
      ? { kind, value, bgType, bg1, bg2, size }
      : { kind, value, bgType, bg1, size };
  }

  await set(ref(db, `chats/${chatId}/avatar`), cleanAvatar);
}


/**
 * Удалить группу или канал (доступно только владельцу): сам чат, его
 * сообщения, юзернейм-индекс и записи в /user_chats у всех, у кого он был.
 *
 * @returns {Promise<void>}
 */
export async function deleteChat(chatId, requesterUid) {
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Чат не найден');
  if (chat.type !== 'group' && chat.type !== 'channel') {
    throw new Error('Удалять можно только группы и каналы');
  }
  if (chat.owner !== requesterUid && !(await isRootAdmin(requesterUid))) {
    throw new Error('Удалять может только владелец');
  }

  const updates = {};

  // 1. Убираем чат из списков участников (группы: участники и владелец;
  //    каналы: владелец, админы и подписчики). Делаем это до удаления узла
  //    чата: правила БД проверяют владельца ещё существующего чата.
  const memberUids = new Set([
    chat.owner,
    ...Object.keys(chat.users || {}),
    ...Object.keys(chat.admins || {}),
    ...Object.keys(chat.subscribers || {}),
  ]);
  for (const uid of memberUids) {
    if (!uid) continue;
    updates[`user_chats/${uid}/${chatId}`] = null;
    updates[`user_chat_meta/${uid}/${chatId}`] = null;
  }

  // 2. Содержимое чата.
  updates[`messages/${chatId}`] = null;
  updates[`comments/${chatId}`] = null;
  updates[`views/${chatId}`] = null;
  updates[`poll_votes/${chatId}`] = null;
  updates[`typing/${chatId}`] = null;

  // 3. Индекс юзернейма и выданные дополнительные имена.
  if (chat.username) {
    const indexNode = chat.type === 'channel' ? 'channel_usernames' : 'group_usernames';
    updates[`${indexNode}/${chat.username}`] = null;
  }
  const aliases = await get(ref(db, 'username_aliases')).then(
    (snapshot) => snapshot.val() || {},
    () => ({}),
  );
  for (const [name, record] of Object.entries(aliases)) {
    if (record && record.target === chatId && (record.type === 'channel' || record.type === 'group')) {
      updates[`username_aliases/${name}`] = null;
    }
  }

  // 4. Сам узел чата — последним, чтобы предыдущие проверки видели владельца.
  updates[`chats/${chatId}`] = null;

  await update(ref(db), updates);
}

/* ============================================================
 *  Подписки RTDB
 * ============================================================ */

/**
 * Подписка на список чатов пользователя /user_chats/$uid.
 * @param {(chatIds: string[]) => void} onChange
 * @returns {() => void} функция отписки
 */
export function subscribeToUserChats(uid, onChange, onError = null) {
  return onValue(
    ref(db, `user_chats/${uid}`),
    (snapshot) => {
      const value = snapshot.val() || {};
      onChange(Object.keys(value).filter((chatId) => value[chatId]));
    },
    (error) => {
      console.error('Ошибка подписки на user_chats:', error);
      if (onError) onError(error);
    },
  );
}

/**
 * Подписка на метаданные одного чата /chats/$chat_id.
 * @param {(chat: object|null) => void} onChange
 * @returns {() => void} функция отписки
 */
export function subscribeToChat(chatId, onChange, onError = null) {
  return onValue(
    ref(db, `chats/${chatId}`),
    (snapshot) => onChange(snapshot.val() || null),
    (error) => {
      console.error(`Ошибка подписки на чат ${chatId}:`, error);
      if (onError) onError(error);
    },
  );
}

/**
 * Подписка на последние сообщения чата /messages/$chat_id
 * с ограничением limitToLast (по умолчанию 50).
 *
 * @param {string} chatId
 * @param {(messages: Array<object>) => void} onChange — массив, отсортированный по времени
 * @param {{ pageSize?: number, onError?: ((error: Error) => void)|null }} options
 * @returns {() => void} функция отписки
 */
export function subscribeToMessages(chatId, onChange, { pageSize = MESSAGES_PAGE_SIZE, onError = null } = {}) {
  const messagesQuery = query(ref(db, `messages/${chatId}`), limitToLast(pageSize));
  return onValue(
    messagesQuery,
    (snapshot) => {
      const value = snapshot.val() || {};
      const messages = Object.entries(value)
        .map(([id, message]) => ({ id, ...message }))
        .sort((a, b) => (a.timestamp - b.timestamp) || String(a.id).localeCompare(String(b.id)));
      onChange(messages);
    },
    (error) => {
      console.error(`Ошибка подписки на сообщения чата ${chatId}:`, error);
      if (onError) onError(error);
    },
  );
}

/* ============================================================
 *  Чёрный список
 * ============================================================ */

/**
 * Добавить пользователя в чёрный список.
 * Его сообщения скрываются, а писать ему нельзя до разблокировки.
 * @returns {Promise<void>}
 */
export async function blockUser(ownerUid, targetUid) {
  if (!ownerUid || !targetUid || ownerUid === targetUid) throw new Error('Некорректный пользователь');
  await set(ref(db, `user_blocks/${ownerUid}/${targetUid}`), true);
}

/**
 * Убрать пользователя из чёрного списка.
 * @returns {Promise<void>}
 */
export async function unblockUser(ownerUid, targetUid) {
  if (!ownerUid || !targetUid) throw new Error('Некорректный пользователь');
  await set(ref(db, `user_blocks/${ownerUid}/${targetUid}`), null);
}

/**
 * Список uid пользователей в чёрном списке.
 * @returns {Promise<string[]>}
 */
export async function getBlockedUids(ownerUid) {
  const snapshot = await get(ref(db, `user_blocks/${ownerUid}`));
  const value = snapshot.val() || {};
  return Object.keys(value).filter((uid) => value[uid]);
}

/* ============================================================
 *  Супер-администраторы и баны (режим тестирования мессенджера)
 * ============================================================ */

/** Является ли пользователь супер-администратором: /root_admins/$uid. */
export async function isRootAdmin(uid) {
  if (!uid) return false;
  const snapshot = await get(ref(db, `root_admins/${uid}`));
  return snapshot.exists();
}

/** Подписка на список супер-администраторов: { $uid: true }. */
export function subscribeToRootAdmins(onChange, onError = null) {
  return onValue(
    ref(db, 'root_admins'),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на root_admins:', error);
      if (onError) onError(error);
    },
  );
}

/** Подписка на все записи банов: { $uid: { by, at } }. */
export function subscribeToBans(onChange, onError = null) {
  return onValue(
    ref(db, 'banned_users'),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на banned_users:', error);
      if (onError) onError(error);
    },
  );
}

/** Запись бана конкретного пользователя: /banned_users/$uid (null — не забанен). */
export function subscribeToMyBan(uid, onChange, onError = null) {
  return onValue(
    ref(db, `banned_users/${uid}`),
    (snapshot) => onChange(snapshot.val() || null),
    (error) => {
      console.error('Ошибка подписки на бан:', error);
      if (onError) onError(error);
    },
  );
}

/** Запись бана пользователя (одноразово): { by, at } | null. */
export async function getBan(uid) {
  if (!uid) return null;
  const snapshot = await get(ref(db, `banned_users/${uid}`));
  return snapshot.val() || null;
}

/** Забанить пользователя: /banned_users/$uid = { by, at }. */
export async function banUser(uid, byUid) {
  if (!uid || !byUid) throw new Error('Некорректный пользователь');
  await set(ref(db, `banned_users/${uid}`), { by: byUid, at: serverTimestamp() });
}

/** Разбанить пользователя. */
export async function unbanUser(uid) {
  if (!uid) throw new Error('Некорректный пользователь');
  await set(ref(db, `banned_users/${uid}`), null);
}

/* ============================================================
 *  Удаление аккаунта
 * ============================================================ */

/** Имя, которое остаётся у сообщений удалённого аккаунта. */
export const DELETED_ACCOUNT_NAME = 'Удалённый аккаунт';

/** Подписка на метку удалённого аккаунта: true | null. */
export function subscribeToDeletedAccount(uid, onChange, onError = null) {
  return onValue(
    ref(db, `deleted_users/${uid}`),
    (snapshot) => onChange(snapshot.exists()),
    (error) => {
      console.error('Ошибка подписки на deleted_users:', error);
      if (onError) onError(error);
    },
  );
}

/** Удалён ли аккаунт: /deleted_users/$uid. */
export async function getDeletedAccount(uid) {
  if (!uid) return false;
  const snapshot = await get(ref(db, `deleted_users/${uid}`));
  return snapshot.exists();
}

/**
 * Стереть данные аккаунта, сохранив сообщения.
 *
 * В /users/$uid остаётся только подпись «Удалённый аккаунт» и createdAt:
 * по ней сообщения, комментарии и пересылки продолжают отображаться.
 * Удаляются профиль, юзернеймы, индексы входа, сессии, настройки, папки,
 * списки чатов, прочитанное, метаданные чатов, присутствие, подписки
 * и членство в группах.
 * Личные чаты не удаляются — второй участник должен видеть историю.
 * «Избранное» удаляется вместе со своими сообщениями: это личное хранилище,
 * а не переписка.
 *
 * @param {string} uid — чей аккаунт стираем
 * @param {{ deletedBy?: string|null, ban?: boolean }} options
 *        ban — заблокировать вход (для удаления чужим супер-админом:
 *        Firebase Auth чужого пользователя с клиента удалить нельзя).
 * @returns {Promise<void>}
 */
export async function deleteUserAccount(uid, { deletedBy = null, ban = false } = {}) {
  if (!uid) throw new Error('Некорректный пользователь');

  // Супер-администратора может удалить только он сам. Чужой супер-админ
  // не должен иметь возможности снести равного себе.
  const targetIsRoot = await isRootAdmin(uid);
  if (targetIsRoot && deletedBy !== uid) {
    throw new Error('Нельзя удалить другого супер-администратора');
  }

  const profileSnap = await get(ref(db, `users/${uid}`));
  const profile = profileSnap.val() || {};
  const username = normalizeUsername(profile.username);

  // Списки чатов, прочитанное и метаданные удаляем по дочерним ключам:
  // у этих узлов нет общего write-правила, только правила на конкретный чат.
  const [userChatsSnap, userReadsSnap, userChatMetaSnap, usernamesSnap, aliasesSnap] = await Promise.all([
    get(ref(db, `user_chats/${uid}`)).catch(() => null),
    get(ref(db, `user_reads/${uid}`)).catch(() => null),
    get(ref(db, `user_chat_meta/${uid}`)).catch(() => null),
    get(ref(db, 'usernames')).catch(() => null),
    get(ref(db, 'username_aliases')).catch(() => null),
  ]);
  const chatIds = new Set([
    ...Object.keys(userChatsSnap?.val() || {}),
    ...Object.keys(userReadsSnap?.val() || {}),
    ...Object.keys(userChatMetaSnap?.val() || {}),
  ]);

  const chatEntries = await Promise.all([...chatIds].map(async (chatId) => {
    try {
      const snapshot = await get(ref(db, `chats/${chatId}`));
      return { chatId, chat: snapshot.val() };
    } catch (error) {
      console.warn(`Не удалось прочитать чат ${chatId} при удалении аккаунта:`, error);
      return { chatId, chat: null };
    }
  }));

  const updates = {};
  const deleteNode = (path) => {
    updates[path] = null;
  };

  // Личные узлы, которые можно удалить целиком.
  [
    'sessions',
    'user_blocks',
    'user_settings',
    'user_folders',
    'user_message_deletes',
    'presence',
    'user_invites',
  ].forEach((node) => deleteNode(`${node}/${uid}`));

  for (const chatId of chatIds) {
    deleteNode(`user_chats/${uid}/${chatId}`);
    deleteNode(`user_reads/${uid}/${chatId}`);
    deleteNode(`user_chat_meta/${uid}/${chatId}`);
  }

  for (const { chatId, chat } of chatEntries) {
    deleteNode(`typing/${chatId}/${uid}`);
    if (!chat) continue;

    if (chat.type === 'saved') {
      // «Избранное» — личное хранилище, его сообщения не являются
      // перепиской с другими людьми.
      if (chat.owner === uid) {
        deleteNode(`chats/${chatId}`);
        deleteNode(`messages/${chatId}`);
      }
      continue;
    }

    // Личный чат оставляем второму участнику: он должен видеть историю
    // и подпись «Удалённый аккаунт». Из групп и каналов выходим.
    if (chat.type !== 'private') {
      deleteNode(`chats/${chatId}/users/${uid}`);
      deleteNode(`chats/${chatId}/admins/${uid}`);
      deleteNode(`chats/${chatId}/auto_subscribed/${uid}`);
      if (chat.subscribers && chat.subscribers[uid]) {
        deleteNode(`chats/${chatId}/subscribers/${uid}`);
        const count = Number(chat.subscribersCount);
        if (Number.isFinite(count) && count > 0) {
          updates[`chats/${chatId}/subscribersCount`] = count - 1;
        }
      }
    }
  }

  if (username) {
    deleteNode(`usernames/${username}`);
    deleteNode(`login_index/${username}`);
  }

  // На всякий случай чистим и старые/висячие записи индексов, ведущие на uid.
  for (const [name, value] of Object.entries(usernamesSnap?.val() || {})) {
    if (value === uid) deleteNode(`usernames/${name}`);
  }
  for (const [name, record] of Object.entries(aliasesSnap?.val() || {})) {
    if (record && record.type === 'user' && record.target === uid) {
      deleteNode(`username_aliases/${name}`);
      // Узел /login_index целиком не читается (правило только на имя),
      // поэтому вход по дополнительному имени убираем по его названию.
      deleteNode(`login_index/${name}`);
    }
  }

  // Подпись к сообщениям. Email и остальные поля профиля не сохраняем.
  updates[`users/${uid}`] = {
    firstName: DELETED_ACCOUNT_NAME,
    deleted: true,
    createdAt: Number(profile.createdAt) || nowSeconds(),
  };
  updates[`deleted_users/${uid}`] = true;

  // Самоудаление супер-администратора снимает и его супер-права.
  if (targetIsRoot) deleteNode(`root_admins/${uid}`);

  // Чужой Firebase Auth с клиента не удалить, поэтому закрываем вход баном.
  if (ban && deletedBy && deletedBy !== uid) {
    updates[`banned_users/${uid}`] = { by: deletedBy, at: serverTimestamp() };
  }

  await update(ref(db), updates);
  usersCache.delete(uid);
  await getUserProfile(uid, { force: true }).catch(() => null);
}

/* ============================================================
 *  Права и отправка сообщений
 * ============================================================ */

/**
 * Разрешено ли пользователю писать в чат.
 * В каналах писать могут только пользователи из chats/$chat_id/admins.
 */
export function canPostToChat(chat, uid) {
  if (!chat || !uid) return false;
  if (chat.type === 'channel') return Boolean(chat.admins && chat.admins[uid]);
  return Boolean(chat.users && chat.users[uid]);
}

/**
 * Разрешено ли пользователю голосовать в опросе.
 * В каналах голосуют все подписчики, а не только администраторы.
 * @param {object} chat
 * @param {string} uid
 * @param {boolean} isMember — чат есть в /user_chats пользователя
 */
export function canVoteInChat(chat, uid, isMember = false) {
  if (!chat || !uid) return false;
  if (chat.type === 'channel') {
    return Boolean(
      isMember
      || (chat.users && chat.users[uid])
      || (chat.subscribers && chat.subscribers[uid])
      || (chat.admins && chat.admins[uid])
      || chat.owner === uid
    );
  }
  return Boolean(chat.users && chat.users[uid]);
}

/**
 * Отправить сообщение атомарным multi-path update (update()):
 *   1) новое сообщение -> /messages/$chat_id/$msg_id;
 *   2) превью и время  -> /chats/$chat_id/lastMessage.
 *
 * options.replyTo       — { msgId, sender, text } для ответа на сообщение;
 * options.forwardedFrom — { uid, name } для пересланного сообщения;
 * options.savedFrom     — { chatId, chatTitle, msgId, sender, text } для закладки.
 *
 * @returns {Promise<string|null>} id созданного сообщения (null, если текст пустой)
 */
export async function sendMessage(chatId, senderUid, text, options = {}) {
  if (!chatId || !senderUid) throw new Error('Не указан чат или отправитель');

  const body = String(text || '').trim();
  if (!body) return null;

  const timestamp = nowSeconds();
  const messageId = push(ref(db, `messages/${chatId}`)).key;
  const message = { sender: senderUid, text: body, timestamp };
  if (options.replyTo) message.replyTo = options.replyTo;
  if (options.forwardedFrom) message.forwardedFrom = options.forwardedFrom;
  if (options.savedFrom) message.savedFrom = options.savedFrom;

  const updates = {
    [`messages/${chatId}/${messageId}`]: message,
    [`chats/${chatId}/lastMessage`]: { text: body, sender: senderUid, timestamp },
  };

  await update(ref(db), updates);
  return messageId;
}

/* ============================================================
 *  Сообщения: правка, удаление, реакции, закреп, пересылка
 * ============================================================ */

/** Максимальная длина цитаты (ответ, закреп, пересылка). */
export const MESSAGE_SNIPPET_LIMIT = 120;

/** Однострочный сниппет текста сообщения для цитат и превью. */
export function messageSnippet(text, limit = MESSAGE_SNIPPET_LIMIT) {
  const body = String(text || '').replace(/\s+/g, ' ').trim();
  return body.length > limit ? body.slice(0, limit - 1) + '…' : body;
}

/**
 * Изменить текст своего сообщения (ставит метку editedAt).
 * Если сообщение — последнее в чате, обновляет и превью lastMessage.
 * @returns {Promise<void>}
 */
export async function editMessage(chatId, msgId, editorUid, text) {
  const body = String(text || '').trim();
  if (!body) throw new Error('Сообщение не может быть пустым');

  const snapshot = await get(ref(db, `messages/${chatId}/${msgId}`));
  const message = snapshot.val();
  if (!message) throw new Error('Сообщение не найдено');
  if (message.sender !== editorUid) throw new Error('Редактировать можно только свои сообщения');

  const updates = {
    [`messages/${chatId}/${msgId}/text`]: body,
    [`messages/${chatId}/${msgId}/editedAt`]: nowSeconds(),
  };

  // Если это последнее сообщение — синхронизируем превью в списке чатов.
  const lastSnapshot = await get(query(ref(db, `messages/${chatId}`), limitToLast(1)));
  const last = lastSnapshot.val() || {};
  if (Object.keys(last)[0] === msgId) {
    updates[`chats/${chatId}/lastMessage/text`] = body;
  }

  await update(ref(db), updates);
}

/**
 * Удалить своё сообщение для всех: сообщение + закреп + превью.
 * @returns {Promise<void>}
 */
export async function deleteMessage(chatId, msgId, deleterUid) {
  const snapshot = await get(ref(db, `messages/${chatId}/${msgId}`));
  const message = snapshot.val();
  if (!message) return;
  if (message.sender !== deleterUid && !(await isRootAdmin(deleterUid))) {
    throw new Error('Удалить у всех можно только свои сообщения');
  }

  // Сначала связанные узлы, само сообщение — последним: правила БД проверяют
  // авторство по ещё существующему сообщению.
  await update(ref(db), {
    [`chats/${chatId}/pinned/${msgId}`]: null,
    [`poll_votes/${chatId}/${msgId}`]: null,
    [`comments/${chatId}/${msgId}`]: null,
    [`views/${chatId}/${msgId}`]: null,
    [`messages/${chatId}/${msgId}`]: null,
  });

  // Обновляем превью последнего сообщения (или убираем).
  const lastSnapshot = await get(query(ref(db, `messages/${chatId}`), limitToLast(1)));
  const entries = Object.entries(lastSnapshot.val() || {});
  const last = entries.length
    ? { text: entries[0][1].text, sender: entries[0][1].sender, timestamp: entries[0][1].timestamp }
    : null;
  await update(ref(db), { [`chats/${chatId}/lastMessage`]: last });
}

/**
 * «Удалить у меня»: пометка /user_message_deletes/$uid/$chat_id/$msg_id.
 * Сообщение исчезает только у этого пользователя, в БД остаётся.
 * @returns {Promise<void>}
 */
export async function deleteMessageLocally(uid, chatId, msgId) {
  if (!uid || !chatId || !msgId) throw new Error('Некорректные параметры');
  await update(ref(db), { [`user_message_deletes/${uid}/${chatId}/${msgId}`]: true });
}

/**
 * Подписка на список сообщений, удалённых локально /user_message_deletes/$uid.
 * @param {(map: object) => void} onChange — { $chat_id: { $msg_id: true } }
 * @returns {() => void} функция отписки
 */
export function subscribeToUserMessageDeletes(uid, onChange, onError = null) {
  return onValue(
    ref(db, `user_message_deletes/${uid}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на локально удалённые сообщения:', error);
      if (onError) onError(error);
    },
  );
}

/**
 * Поставить/снять реакцию. Включение и выключение — кликом по той же.
 * Хранение: /messages/$chat_id/$msg_id/reactions/$emoji/$uid = true.
 * @param {boolean} active — true поставить, false снять
 * @returns {Promise<void>}
 */
export async function setReaction(chatId, msgId, emoji, uid, active) {
  const clean = String(emoji || '').trim();
  if (!clean) throw new Error('Пустая реакция');
  await update(ref(db), { [`messages/${chatId}/${msgId}/reactions/${clean}/${uid}`]: active ? true : null });
}

/**
 * Закрепить или открепить сообщение.
 * Храним снимок последнего текста, чтобы закреп отображался,
 * даже если сообщение вне загруженного окна истории.
 * @param {boolean} pinned — true закрепить, false снять
 * @returns {Promise<void>}
 */
export async function setPinned(chatId, msgId, pinned, snapshot = null) {
  if (pinned) {
    const stored = snapshot || {};
    await update(ref(db), {
      [`chats/${chatId}/pinned/${msgId}`]: {
        ts: nowSeconds(),
        text: messageSnippet(stored.text || ''),
        sender: stored.sender || '',
      },
    });
    return;
  }
  await update(ref(db), { [`chats/${chatId}/pinned/${msgId}`]: null });
}

/* ============================================================
 *  Присутствие: онлайн-статусы и «был(а) недавно»
 * ============================================================ */

/**
 * Включить присутствие пользователя: /presence/$uid.
 * При подключении пишем { online: true, lastSeen }, а при обрыве связи
 * onDisconnect сам выставит { online: false, lastSeen: серверное время }.
 * @returns {() => void} функция отписки
 */
export function startPresence(uid) {
  if (!uid) return () => {};
  const presenceRef = ref(db, `presence/${uid}`);
  return onValue(ref(db, '.info/connected'), (snapshot) => {
    if (snapshot.val() !== true) return;
    onDisconnect(presenceRef)
      .set({ online: false, lastSeen: serverTimestamp() })
      .catch(() => {});
    set(presenceRef, { online: true, lastSeen: nowSeconds() }).catch(() => {});
  });
}

/** Явно пометить пользователя офлайн (выход из аккаунта). */
export async function setOfflinePresence(uid) {
  if (!uid) return;
  await set(ref(db, `presence/${uid}`), { online: false, lastSeen: nowSeconds() }).catch(() => {});
}

/**
 * Подписка на присутствие пользователя.
 * @param {(presence: {online: boolean, lastSeen: number}|null) => void} onChange
 */
export function subscribeToPresence(uid, onChange, onError = null) {
  return onValue(
    ref(db, `presence/${uid}`),
    (snapshot) => onChange(snapshot.val() || null),
    (error) => {
      console.error('Ошибка подписки на присутствие:', error);
      if (onError) onError(error);
    },
  );
}

/* ============================================================
 *  Настройки пользователя (приватность последнего визита)
 * ============================================================ */

/** Настройки пользователя /user_settings/$uid ({} — если не заданы). */
export async function getUserSettings(uid) {
  const snapshot = await get(ref(db, `user_settings/${uid}`));
  return snapshot.val() || {};
}

/** Подписка на настройки пользователя. */
export function subscribeToUserSettings(uid, onChange, onError = null) {
  return onValue(
    ref(db, `user_settings/${uid}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на настройки пользователя:', error);
      if (onError) onError(error);
    },
  );
}

/**
 * Приватность последнего визита: 'all' — виден всем, 'nobody' — скрыт.
 * @returns {Promise<void>}
 */
export async function setLastSeenPrivacy(uid, value) {
  const clean = value === 'nobody' ? 'nobody' : 'all';
  await set(ref(db, `user_settings/${uid}/lastSeenPrivacy`), clean);
}

/**
 * Переключатель админ-прав для тестирования: /user_settings/$uid/adminMode.
 * false — права приостановлены, поведение как у обычного пользователя.
 * @returns {Promise<void>}
 */
export async function setAdminMode(uid, enabled) {
  if (!uid) throw new Error('Некорректный пользователь');
  await set(ref(db, `user_settings/${uid}/adminMode`), enabled ? true : false);
}

/**
 * Скрыть промо-строку канала @dev в списке чатов:
 * /user_settings/$uid/hideDevPromo. Поиск и подписка канала не блокируются.
 * @returns {Promise<void>}
 */
export async function setDevPromoHidden(uid, hidden) {
  if (!uid) throw new Error('Некорректный пользователь');
  await set(ref(db, `user_settings/${uid}/hideDevPromo`), hidden ? true : null);
}

/* ============================================================
 *  Индикатор «печатает…»
 * ============================================================ */

/** Через сколько секунд запись «печатает…» считается устаревшей. */
export const TYPING_TTL = 5;

/** Пути typing, для которых уже зарегистрирован onDisconnect (за сессию). */
const typingOnDisconnect = new Set();

/**
 * Отметить, что пользователь печатает в чате: /typing/$chat_id/$uid = { name, ts }.
 * Для каждого чата один раз за сессию регистрируется onDisconnect remove.
 * @returns {Promise<void>}
 */
export async function setTyping(chatId, uid, name) {
  if (!chatId || !uid) return;
  const path = `typing/${chatId}/${uid}`;
  if (!typingOnDisconnect.has(path)) {
    typingOnDisconnect.add(path);
    onDisconnect(ref(db, path)).remove().catch(() => {});
  }
  await set(ref(db, path), { name: String(name || '').slice(0, 64), ts: nowSeconds() });
}

/** Убрать отметку «печатает…». */
export async function clearTyping(chatId, uid) {
  if (!chatId || !uid) return;
  await set(ref(db, `typing/${chatId}/${uid}`), null).catch(() => {});
}

/**
 * Подписка на отметки «печатает…» в чате.
 * @param {(map: object) => void} onChange — { $uid: { name, ts } }
 */
export function subscribeToTyping(chatId, onChange, onError = null) {
  return onValue(
    ref(db, `typing/${chatId}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на «печатает…»:', error);
      if (onError) onError(error);
    },
  );
}

/* ============================================================
 *  Прочтения: галочки ✓ / ✓✓ и непрочитанные
 * ============================================================ */

/**
 * Отметить чат прочитанным до timestamp (unix-секунды):
 * /user_reads/$uid/$chat_id = ts.
 */
export async function markChatRead(uid, chatId, ts) {
  if (!uid || !chatId) return;
  const value = Math.floor(Number(ts) || 0);
  if (!value) return;
  await set(ref(db, `user_reads/${uid}/${chatId}`), value).catch(() => {});
}

/** Подписка на прочтения всех чатов пользователя: { $chat_id: ts }. */
export function subscribeToUserReads(uid, onChange, onError = null) {
  return onValue(
    ref(db, `user_reads/${uid}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на прочтения:', error);
      if (onError) onError(error);
    },
  );
}

/** Подписка на прочтение одного чата пользователем: ts (0 — не читал). */
export function subscribeToChatReads(uid, chatId, onChange, onError = null) {
  return onValue(
    ref(db, `user_reads/${uid}/${chatId}`),
    (snapshot) => onChange(Number(snapshot.val()) || 0),
    (error) => {
      console.error('Ошибка подписки на прочтения чата:', error);
      if (onError) onError(error);
    },
  );
}

/**
 * Сколько чужих сообщений в чате новее ts (для счётчика непрочитанных).
 * Берём последние 100 сообщений — индексов в правилах БД не требуется.
 * @returns {Promise<number>}
 */
export async function countUnreadMessages(chatId, uid, sinceTs) {
  if (!chatId || !uid) return 0;
  const from = Math.floor(Number(sinceTs) || 0);
  const snapshot = await get(query(ref(db, `messages/${chatId}`), limitToLast(100)));
  let count = 0;
  snapshot.forEach((child) => {
    const message = child.val() || {};
    if (message.sender !== uid && (Number(message.timestamp) || 0) > from) count += 1;
  });
  return count;
}

/* ============================================================
 *  Опросы
 * ============================================================ */

/** Максимальное количество вариантов ответа в опросе. */
export const POLL_MAX_OPTIONS = 10;

/**
 * Отправить опрос: сообщение с полем poll и превью «📊 вопрос».
 * @param {{ question: string, options: string[], multiple?: boolean,
 *           forwardedFrom?: { uid: string, name: string } }} data
 * @returns {Promise<string>} id сообщения-опроса
 */
export async function sendPollMessage(chatId, senderUid, {
  question,
  options = [],
  multiple = false,
  forwardedFrom = null,
} = {}) {
  if (!chatId || !senderUid) throw new Error('Не указан чат или отправитель');

  const cleanQuestion = String(question || '').trim();
  const cleanOptions = options.map((text) => String(text || '').trim()).filter(Boolean);
  if (!cleanQuestion) throw new Error('Укажите вопрос опроса');
  if (cleanOptions.length < 2) throw new Error('Нужно минимум два варианта');
  if (cleanOptions.length > POLL_MAX_OPTIONS) throw new Error(`Не больше ${POLL_MAX_OPTIONS} вариантов`);

  const timestamp = nowSeconds();
  const messageId = push(ref(db, `messages/${chatId}`)).key;
  const message = {
    sender: senderUid,
    text: '',
    timestamp,
    poll: {
      question: cleanQuestion,
      multiple: Boolean(multiple),
      options: cleanOptions.map((text, index) => ({ id: 'o' + (index + 1), text })),
    },
  };
  if (forwardedFrom) message.forwardedFrom = forwardedFrom;

  await update(ref(db), {
    [`messages/${chatId}/${messageId}`]: message,
    [`chats/${chatId}/lastMessage`]: { text: '📊 ' + cleanQuestion, sender: senderUid, timestamp },
  });
  return messageId;
}

/**
 * Проголосовать / отозвать голос.
 * Одиночный выбор: клик по выбранному — снять голос, по другому — переключить.
 * Множественный: клик по варианту включает/выключает его.
 * @returns {Promise<void>}
 */
export async function votePoll(chatId, msgId, uid, optionId, multiple = false) {
  const voteRef = ref(db, `poll_votes/${chatId}/${msgId}/${uid}`);
  const current = (await get(voteRef)).val() || {};

  let next = {};
  if (multiple) {
    next = { ...current };
    if (next[optionId]) delete next[optionId];
    else next[optionId] = true;
  } else if (!current[optionId]) {
    next[optionId] = true;
  }

  await set(voteRef, Object.keys(next).length ? next : null);
}

/** Подписка на голоса всех опросов чата: { $msg_id: { $uid: { $option_id: true } } }. */
export function subscribeToPollVotes(chatId, onChange, onError = null) {
  return onValue(
    ref(db, `poll_votes/${chatId}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на голоса опросов:', error);
      if (onError) onError(error);
    },
  );
}

/* ============================================================
 *  Комментарии к постам каналов
 * ============================================================ */

/**
 * Добавить комментарий к посту: /comments/$chat_id/$post_id/$comment_id.
 * @returns {Promise<string|null>} id комментария (null — если текст пустой)
 */
export async function sendComment(chatId, postId, senderUid, text) {
  const body = String(text || '').trim();
  if (!body) return null;

  const commentId = push(ref(db, `comments/${chatId}/${postId}`)).key;
  await set(ref(db, `comments/${chatId}/${postId}/${commentId}`), {
    sender: senderUid,
    text: body,
    timestamp: nowSeconds(),
  });
  return commentId;
}

/** Удалить комментарий (свой или любой — если requesterUid супер-админ). */
export async function deleteComment(chatId, postId, commentId, requesterUid = null) {
  if (!chatId || !postId || !commentId) throw new Error('Некорректные параметры');
  if (requesterUid) {
    const snapshot = await get(ref(db, `comments/${chatId}/${postId}/${commentId}`));
    const comment = snapshot.val();
    if (comment && comment.sender !== requesterUid && !(await isRootAdmin(requesterUid))) {
      throw new Error('Удалять можно только свои комментарии');
    }
  }
  await set(ref(db, `comments/${chatId}/${postId}/${commentId}`), null);
}

/**
 * Подписка на комментарии одного поста.
 * @param {(map: object) => void} onChange — { $comment_id: { sender, text, timestamp } }
 */
export function subscribeToPostComments(chatId, postId, onChange, onError = null) {
  return onValue(
    ref(db, `comments/${chatId}/${postId}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на комментарии:', error);
      if (onError) onError(error);
    },
  );
}

/**
 * Подписка на все комментарии чата (для счётчиков на постах):
 * { $post_id: { $comment_id: { sender, text, timestamp } } }.
 */
export function subscribeToChatComments(chatId, onChange, onError = null) {
  return onValue(
    ref(db, `comments/${chatId}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на комментарии канала:', error);
      if (onError) onError(error);
    },
  );
}

/* ============================================================
 *  Просмотры постов канала
 * ============================================================ */

/** Зафиксировать уникальный просмотр: /views/$chat_id/$msg_id/$uid = ts. */
export async function recordView(chatId, msgId, uid) {
  if (!chatId || !msgId || !uid) return;
  await set(ref(db, `views/${chatId}/${msgId}/${uid}`), nowSeconds()).catch(() => {});
}

/**
 * Подписка на просмотры чата: { $msg_id: { $uid: ts } }.
 */
export function subscribeToChatViews(chatId, onChange, onError = null) {
  return onValue(
    ref(db, `views/${chatId}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на просмотры:', error);
      if (onError) onError(error);
    },
  );
}

/* ============================================================
 *  Папки чатов, архив и закреп (личные настройки списка)
 * ============================================================ */

/**
 * Подписка на личные настройки списка чатов:
 * { $chat_id: { archived?, pinnedAt?, folders?: { $folder_id: true } } }.
 */
export function subscribeToUserChatMeta(uid, onChange, onError = null) {
  return onValue(
    ref(db, `user_chat_meta/${uid}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на настройки чатов:', error);
      if (onError) onError(error);
    },
  );
}

/** Архивировать (true) или вернуть из архива (false) чат. */
export async function setChatArchived(uid, chatId, archived) {
  if (!uid || !chatId) throw new Error('Некорректные параметры');
  await update(ref(db), { [`user_chat_meta/${uid}/${chatId}/archived`]: archived ? true : null });
}

/** Закрепить (true) или открепить (false) чат наверху списка. */
export async function setChatPinned(uid, chatId, pinned) {
  if (!uid || !chatId) throw new Error('Некорректные параметры');
  await update(ref(db), { [`user_chat_meta/${uid}/${chatId}/pinnedAt`]: pinned ? nowSeconds() : null });
}

/** Добавить (member=true) или убрать (false) чат в папке. */
export async function toggleChatFolder(uid, chatId, folderId, member) {
  if (!uid || !chatId || !folderId) throw new Error('Некорректные параметры');
  await update(ref(db), {
    [`user_chat_meta/${uid}/${chatId}/folders/${folderId}`]: member ? true : null,
  });
}

/** Создать папку чатов: /user_folders/$uid/$folder_id { name, createdAt }. */
export async function createUserFolder(uid, name) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Укажите название папки');
  if (clean.length > 40) throw new Error('Название папки слишком длинное');

  const folderId = push(ref(db, `user_folders/${uid}`)).key;
  await set(ref(db, `user_folders/${uid}/${folderId}`), { name: clean, createdAt: nowSeconds() });
  return folderId;
}

/** Удалить папку и убрать её из всех чатов пользователя. */
export async function deleteUserFolder(uid, folderId) {
  if (!uid || !folderId) throw new Error('Некорректные параметры');

  const snapshot = await get(ref(db, `user_chat_meta/${uid}`));
  const meta = snapshot.val() || {};
  const updates = { [`user_folders/${uid}/${folderId}`]: null };

  for (const [chatId, item] of Object.entries(meta)) {
    if (item && item.folders && item.folders[folderId]) {
      updates[`user_chat_meta/${uid}/${chatId}/folders/${folderId}`] = null;
    }
  }

  await update(ref(db), updates);
}

/** Подписка на папки чатов: { $folder_id: { name, createdAt } }. */
export function subscribeToUserFolders(uid, onChange, onError = null) {
  return onValue(
    ref(db, `user_folders/${uid}`),
    (snapshot) => onChange(snapshot.val() || {}),
    (error) => {
      console.error('Ошибка подписки на папки:', error);
      if (onError) onError(error);
    },
  );
}

/* ============================================================
 *  «Избранное»: чат с самим собой для заметок и закладок
 * ============================================================ */

/** Детерминированный id чата «Избранное». */
export function buildSavedChatId(uid) {
  return `saved_${uid}`;
}

/** Создать «Избранное» при первом входе (идемпотентно). */
export async function ensureSavedChat(uid) {
  if (!uid) return null;
  const chatId = buildSavedChatId(uid);
  const snapshot = await get(ref(db, `chats/${chatId}`));
  if (!snapshot.exists()) {
    await update(ref(db), {
      [`chats/${chatId}`]: {
        type: 'saved',
        owner: uid,
        createdAt: nowSeconds(),
        users: { [uid]: true },
      },
      [`user_chats/${uid}/${chatId}`]: true,
    });
  }
  return chatId;
}

/**
 * Сохранить сообщение в «Избранное»: копия с полем savedFrom,
 * по которому можно вернуться к исходному сообщению.
 */
export async function saveToFavorites(uid, source, text) {
  const chatId = await ensureSavedChat(uid);
  const body = String(text || '').trim();
  if (!body) throw new Error('Нечего сохранять');

  return sendMessage(chatId, uid, body, {
    savedFrom: {
      chatId: source.chatId,
      chatTitle: source.chatTitle || '',
      msgId: source.msgId,
      sender: source.sender || '',
      text: source.text || '',
    },
  });
}

/* ============================================================
 *  Чтение истории для поиска и статистики
 * ============================================================ */

/**
 * Последние $limit сообщений чата (для поиска по тексту).
 * @returns {Promise<Array<object>>} сообщения по возрастанию времени
 */
export async function fetchRecentMessages(chatId, limit = 150) {
  const snapshot = await get(query(ref(db, `messages/${chatId}`), limitToLast(limit)));
  const value = snapshot.val() || {};
  return Object.entries(value)
    .map(([id, message]) => ({ id, ...message }))
    .sort((a, b) => (a.timestamp - b.timestamp) || String(a.id).localeCompare(String(b.id)));
}

/** Все сообщения чата одной выборкой (для статистики канала). */
export async function getChatMessages(chatId) {
  const snapshot = await get(ref(db, `messages/${chatId}`));
  return snapshot.val() || {};
}

/** Все просмотры чата одной выборкой: { $msg_id: { $uid: ts } }. */
export async function getChatViews(chatId) {
  const snapshot = await get(ref(db, `views/${chatId}`));
  return snapshot.val() || {};
}
