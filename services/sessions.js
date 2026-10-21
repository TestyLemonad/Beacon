/**
 * Beacon — реестр активных сессий устройства.
 *
 * Firebase Auth на клиенте не отдаёт список refresh-токенов, поэтому
 * ведём собственный реестр в RTDB. Это «мягкий» выход: приложение на
 * другом устройстве увидит revokedAt и выйдет из аккаунта. Полный
 * отзыв токенов возможен только через Admin SDK / Cloud Functions.
 */
import { ref, get, set, update, remove, onValue } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
import { db } from '../firebase-config.js?v=28';

const SESSION_KEY = 'beacon-session-id';
const HEARTBEAT_MS = 60_000;

/** Текущая зарегистрированная сессия. */
let active = null;
/** Поколение реестра: отменяет незавершённый startSession после выхода. */
let generation = 0;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function readStoredSessionId() {
  try {
    const fromLocal = window.localStorage.getItem(SESSION_KEY);
    if (fromLocal) return fromLocal;
  } catch {
    // Приватный режим или запрет доступа к localStorage.
  }
  try {
    return window.sessionStorage.getItem(SESSION_KEY) || '';
  } catch {
    return '';
  }
}

function storeSessionId(sessionId) {
  try {
    window.localStorage.setItem(SESSION_KEY, sessionId);
  } catch {
    // Ниже попробуем sessionStorage.
  }
  try {
    window.sessionStorage.setItem(SESSION_KEY, sessionId);
  } catch {
    // Остаётся сессия в памяти до перезагрузки.
  }
}

function makeSessionId() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    // Старые браузеры — запасной вариант ниже.
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Короткое описание браузера и ОС для списка сессий. */
function detectDevice() {
  const ua = navigator.userAgent || '';
  let browser = 'Браузер';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/YaBrowser\//.test(ua)) browser = 'Яндекс.Браузер';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let os = 'устройство';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return {
    userAgent: ua.slice(0, 400),
    platform: String(navigator.platform || '').slice(0, 80),
    label: `${browser} · ${os}`,
    mobile: /Android|iPhone|iPad|iPod|Mobile/.test(ua),
  };
}

/**
 * Зарегистрировать текущее устройство и слушать отзыв сессии.
 * @param {string} uid
 * @param {() => void} [onRevoked] Вызывается, если сессию завершили с другого устройства.
 */
export async function startSession(uid, onRevoked = null) {
  if (!uid) return null;
  if (active?.uid === uid && active.sessionId) return active.sessionId;

  await stopSession({ removeRecord: false });
  const token = ++generation;

  const sessionId = readStoredSessionId() || makeSessionId();
  storeSessionId(sessionId);

  const sessionRef = ref(db, `sessions/${uid}/${sessionId}`);
  let existing = null;
  try {
    existing = (await get(sessionRef)).val();
  } catch (error) {
    console.warn('Не удалось прочитать запись сессии:', error);
    throw error;
  }
  if (token !== generation) return null;

  if (existing?.revokedAt) {
    // Сессию завершили, пока это устройство было офлайн. Не воскрешаем её:
    // приложение выйдет из аккаунта, а запись удалится при выходе.
    active = {
      uid,
      sessionId,
      sessionRef,
      unsubscribe: null,
      heartbeat: null,
      onVisible: null,
      revoked: true,
    };
    onRevoked?.();
    return sessionId;
  }

  const device = detectDevice();
  const now = nowSeconds();
  await set(sessionRef, {
    createdAt: Number(existing?.createdAt) || now,
    lastActive: now,
    label: device.label,
    userAgent: device.userAgent,
    platform: device.platform,
    mobile: device.mobile,
  });
  if (token !== generation) {
    // Пользователь вышел или начал новую сессию, пока шла запись.
    // Не трогаем узел: более новая сессия могла уже записать свои данные.
    return null;
  }

  active = {
    uid,
    sessionId,
    sessionRef,
    unsubscribe: null,
    heartbeat: null,
    onVisible: null,
    revoked: false,
  };

  // Если сессию завершили на другом устройстве — выходим.
  active.unsubscribe = onValue(
    sessionRef,
    (snapshot) => {
      if (!active || active.sessionId !== sessionId || active.revoked) return;
      const data = snapshot.val();
      if (!data || data.revokedAt) {
        active.revoked = true;
        onRevoked?.();
      }
    },
    (error) => console.warn('Не удалось подписаться на сессию:', error)
  );

  const heartbeat = () => {
    if (!active || active.sessionId !== sessionId || active.revoked) return;
    update(sessionRef, { lastActive: nowSeconds() }).catch((error) => {
      console.warn('Не удалось обновить активность сессии:', error);
    });
  };
  active.heartbeat = window.setInterval(heartbeat, HEARTBEAT_MS);
  active.onVisible = () => {
    if (document.visibilityState === 'visible') heartbeat();
  };
  document.addEventListener('visibilitychange', active.onVisible);

  return sessionId;
}

/**
 * Остановить локальный реестр и, если нужно, удалить запись сессии.
 * Удалять нужно до Auth.logout(), пока у пользователя есть права.
 */
export async function stopSession({ removeRecord = true } = {}) {
  generation += 1;
  const session = active;
  active = null;
  if (!session) return;

  if (session.heartbeat) window.clearInterval(session.heartbeat);
  if (session.onVisible) document.removeEventListener('visibilitychange', session.onVisible);
  try {
    session.unsubscribe?.();
  } catch {
    // Подписка уже могла быть снята.
  }

  if (!removeRecord || !session.uid || !session.sessionId) return;
  try {
    await remove(ref(db, `sessions/${session.uid}/${session.sessionId}`));
  } catch (error) {
    console.warn('Не удалось удалить запись сессии:', error);
  }
}

/** Идентификатор текущей сессии (для отметки «это устройство»). */
export function getCurrentSessionId() {
  return active?.sessionId || readStoredSessionId();
}

/** Список незавершённых сессий пользователя. */
export async function listSessions(uid) {
  const snapshot = await get(ref(db, `sessions/${uid}`));
  const value = snapshot.val() || {};
  return Object.entries(value)
    .map(([id, session]) => ({ ...(session && typeof session === 'object' ? session : {}), id }))
    .filter((session) => !session.revokedAt)
    .sort((a, b) => (Number(b.lastActive) || 0) - (Number(a.lastActive) || 0));
}

/** Завершить одну сессию (кроме текущей). */
export async function revokeSession(uid, sessionId, currentSessionId = null) {
  if (!uid || !sessionId) return false;
  if (currentSessionId && sessionId === currentSessionId) {
    throw new Error('Нельзя завершить текущую сессию');
  }

  const sessionRef = ref(db, `sessions/${uid}/${sessionId}`);
  const snapshot = await get(sessionRef);
  if (!snapshot.exists()) return false;
  await update(sessionRef, { revokedAt: nowSeconds() });
  return true;
}

/** Завершить все сессии, кроме текущей. Возвращает количество. */
export async function revokeOtherSessions(uid, currentSessionId) {
  const sessions = await listSessions(uid);
  const targets = sessions.filter((session) => session.id !== currentSessionId);
  if (!targets.length) return 0;

  const revokedAt = nowSeconds();
  const updates = {};
  targets.forEach((session) => {
    updates[`sessions/${uid}/${session.id}/revokedAt`] = revokedAt;
  });
  await update(ref(db), updates);
  return targets.length;
}
