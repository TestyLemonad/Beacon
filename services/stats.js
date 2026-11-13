/**
 * Beacon — загрузка данных и расчёт статистики для страницы /dashboard.
 *
 * Слой между Firebase и UI: читает только те узлы, на которые хватает прав
 * (с graceful fallback, если правила ещё не опубликованы), и передаёт
 * сырые данные в services/stats-core.js.
 */
import { ref, get, set, onValue } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
import { db } from '../firebase-config.js?v=39';
import {
  buildGlobalStats,
  buildPersonalStats,
  buildChannelStats,
  toPublicSnapshot,
} from './stats-core.js?v=39';

/** Ошибка «нет прав» (правила RTDB ещё не опубликованы). */
export function isPermissionDenied(error) {
  return error?.code === 'database/permission-denied'
    || /permission[_\s-]?denied/i.test(String(error?.message || ''));
}

/** Прочитать узел; при отсутствии прав вернуть null, остальные ошибки — наружу. */
async function safeRead(path, fallback = null) {
  try {
    const snapshot = await get(ref(db, path));
    return snapshot.exists() ? snapshot.val() : fallback;
  } catch (error) {
    if (isPermissionDenied(error)) return fallback;
    throw error;
  }
}

/** Попытка чтения с признаком «прав не хватило». */
async function tryRead(path) {
  try {
    const snapshot = await get(ref(db, path));
    return { ok: true, value: snapshot.exists() ? snapshot.val() : null };
  } catch (error) {
    if (isPermissionDenied(error)) return { ok: false, error };
    throw error;
  }
}

/**
 * Ограниченный параллелизм: не открываем сотни соединений сразу.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} worker
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<R[]>}
 */
async function mapLimit(items, limit, worker, onProgress = null) {
  const list = Array.isArray(items) ? items : [];
  const results = new Array(list.length);
  let cursor = 0;
  let done = 0;

  async function run() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(list[index], index);
      done += 1;
      if (onProgress) onProgress(done, list.length);
    }
  }

  const workers = Math.max(1, Math.min(limit, list.length));
  await Promise.all(Array.from({ length: workers }, run));
  return results;
}

/** Профиль супер-администратора: /root_admins/$uid. */
export async function isRootAdmin(uid) {
  if (!uid) return false;
  try {
    const snapshot = await get(ref(db, `root_admins/${uid}`));
    return snapshot.exists() && snapshot.val() !== false;
  } catch (error) {
    if (isPermissionDenied(error)) return false;
    throw error;
  }
}

/** Профиль аккаунта для подписи в шапке дашборда. */
export async function loadAccountProfile(uid) {
  if (!uid) return null;
  return safeRead(`users/${uid}`, null);
}

/** Публичный снимок /public_stats (читается без входа, если правила опубликованы). */
export async function fetchPublicSnapshot() {
  const snapshot = await get(ref(db, 'public_stats'));
  return snapshot.exists() ? snapshot.val() : null;
}

/** Живая подписка на публичный снимок. */
export function subscribeToPublicSnapshot(onChange, onError = null) {
  return onValue(
    ref(db, 'public_stats'),
    (snapshot) => onChange(snapshot.exists() ? snapshot.val() : null),
    (error) => {
      if (onError) onError(error);
    },
  );
}

/** Опубликовать агрегаты в /public_stats (только для супер-администратора). */
export async function publishPublicSnapshot(stats) {
  const payload = toPublicSnapshot(stats);
  await set(ref(db, 'public_stats'), payload);
  return payload;
}

/* ============================================================
 *  Личная статистика
 * ============================================================ */

/**
 * Загрузить личные данные и посчитать статистику.
 * @param {string} uid
 * @param {{ onProgress?: (info: object) => void }} options
 */
export async function loadPersonalStats(uid, { onProgress = null } = {}) {
  if (!uid) throw new Error('Нужно войти в аккаунт');

  onProgress?.({ phase: 'profile', done: 0, total: 1, message: 'Читаем профиль…' });

  const [user, chatMap, reads, meta, folders, sessions, settings, presence] = await Promise.all([
    safeRead(`users/${uid}`, {}),
    safeRead(`user_chats/${uid}`, {}),
    safeRead(`user_reads/${uid}`, {}),
    safeRead(`user_chat_meta/${uid}`, {}),
    safeRead(`user_folders/${uid}`, {}),
    safeRead(`sessions/${uid}`, {}),
    safeRead(`user_settings/${uid}`, {}),
    safeRead(`presence/${uid}`, {}),
  ]);

  const chatIds = Object.keys(chatMap || {});
  onProgress?.({ phase: 'chats', done: 0, total: chatIds.length, message: 'Читаем чаты…' });

  const rows = await mapLimit(chatIds, 5, async (chatId) => {
    const [chat, messages, views, comments, pollVotes] = await Promise.all([
      safeRead(`chats/${chatId}`, null),
      safeRead(`messages/${chatId}`, {}),
      safeRead(`views/${chatId}`, {}),
      safeRead(`comments/${chatId}`, {}),
      safeRead(`poll_votes/${chatId}`, {}),
    ]);
    return { chatId, chat, messages, views, comments, pollVotes };
  }, (done, total) => {
    onProgress?.({ phase: 'chats', done, total, message: 'Читаем чаты…' });
  });

  const chats = {};
  const messages = {};
  const views = {};
  const comments = {};
  const pollVotes = {};
  for (const row of rows) {
    if (!row.chat) continue;
    chats[row.chatId] = row.chat;
    messages[row.chatId] = row.messages || {};
    views[row.chatId] = row.views || {};
    comments[row.chatId] = row.comments || {};
    pollVotes[row.chatId] = row.pollVotes || {};
  }

  return buildPersonalStats({
    uid,
    user: user || {},
    chats,
    messages,
    views,
    comments,
    pollVotes,
    reads: reads || {},
    meta: meta || {},
    folders: folders || {},
    sessions: sessions || {},
    settings: settings || {},
    presence: { [uid]: presence || {} },
  });
}

/* ============================================================
 *  Каналы
 * ============================================================ */

/** Нормализовать @username канала. */
export function normalizeChannelUsername(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Мои каналы: подписки, владение и админство из /user_chats.
 * @param {string} uid
 */
export async function loadMyChannels(uid, { onProgress = null } = {}) {
  if (!uid) return [];
  const chatMap = await safeRead(`user_chats/${uid}`, {});
  const chatIds = Object.keys(chatMap || {});
  onProgress?.({ phase: 'channels', done: 0, total: chatIds.length, message: 'Ищем каналы…' });

  const rows = await mapLimit(chatIds, 6, async (chatId) => {
    const chat = await safeRead(`chats/${chatId}`, null);
    return chat?.type === 'channel' ? { id: chatId, chat } : null;
  }, (done, total) => {
    onProgress?.({ phase: 'channels', done, total, message: 'Ищем каналы…' });
  });

  return rows
    .filter(Boolean)
    .map(({ id, chat }) => ({
      id,
      title: String(chat.title || (chat.username ? '@' + chat.username : 'Канал')),
      username: String(chat.username || ''),
      subscribers: chat.subscribers ? Object.keys(chat.subscribers).length : Number(chat.subscribersCount) || 0,
      requiresSubscription: chat.requiresSubscription === true,
      isOwner: chat.owner === uid,
      isAdmin: chat.owner === uid || Boolean(chat.admins?.[uid]),
    }))
    .sort((a, b) => b.subscribers - a.subscribers || a.title.localeCompare(b.title, 'ru'));
}

/** Найти канал по @username через /channel_usernames. */
export async function findChannelByUsername(rawUsername) {
  const username = normalizeChannelUsername(rawUsername);
  if (!username) return null;

  const idSnapshot = await get(ref(db, `channel_usernames/${username}`));
  const chatId = idSnapshot.val();
  if (!chatId) return null;

  const chat = await safeRead(`chats/${chatId}`, null);
  if (!chat || chat.type !== 'channel') return null;
  return { id: chatId, chat };
}

/**
 * Подробная статистика канала.
 * @param {{ chatId: string, uid: string, isRoot?: boolean, onProgress?: Function }} options
 */
export async function loadChannelStats({ chatId, uid, isRoot = false, onProgress = null }) {
  if (!chatId) throw new Error('Канал не выбран');

  onProgress?.({ phase: 'channel', done: 0, total: 5, message: 'Читаем канал…' });
  const chat = await safeRead(`chats/${chatId}`, null);
  if (!chat || chat.type !== 'channel') {
    throw new Error('Канал не найден или недоступен');
  }

  const [messages, views, comments, pollVotes] = await Promise.all([
    safeRead(`messages/${chatId}`, {}),
    safeRead(`views/${chatId}`, {}),
    safeRead(`comments/${chatId}`, {}),
    safeRead(`poll_votes/${chatId}`, {}),
  ]);
  onProgress?.({ phase: 'channel', done: 4, total: 5, message: 'Считаем…' });

  const stats = buildChannelStats({
    uid,
    chat,
    messages: messages || {},
    views: views || {},
    comments: comments || {},
    pollVotes: pollVotes || {},
    isRoot,
  });

  // Имена для аудитории — только тем, кому можно её видеть.
  if (stats.roles.canSeeAudience) {
    const uids = new Set();
    for (const row of stats.topCommenters) uids.add(row.uid);
    for (const row of stats.topViewers) uids.add(row.uid);
    for (const row of stats.topReactors) uids.add(row.uid);

    const pairs = await mapLimit([...uids], 6, async (viewerUid) => [
      viewerUid,
      await safeRead(`users/${viewerUid}`, null),
    ]);
    stats.profiles = Object.fromEntries(pairs.filter(([, profile]) => profile));
  }

  onProgress?.({ phase: 'channel', done: 5, total: 5, message: 'Готово' });
  return stats;
}

/* ============================================================
 *  Весь мессенджер (только супер-администратор)
 * ============================================================ */

/** Перечислить чаты через /user_chats, если корневое чтение /chats недоступно. */
async function enumerateChats(userIds, onProgress) {
  const maps = await mapLimit(userIds, 8, async (uid) => safeRead(`user_chats/${uid}`, {}),
    (done, total) => onProgress?.({ phase: 'chats', done, total, message: 'Собираем список чатов…' }));

  const chatIds = new Set();
  for (const map of maps) {
    for (const chatId of Object.keys(map || {})) chatIds.add(chatId);
  }

  const chats = {};
  await mapLimit([...chatIds], 8, async (chatId) => {
    const chat = await safeRead(`chats/${chatId}`, null);
    if (chat) chats[chatId] = chat;
  }, (done, total) => onProgress?.({ phase: 'chats', done, total, message: 'Читаем чаты…' }));

  return chats;
}

/** Корневое чтение узла или сбор по одному чату. */
async function readPerChat(node, chatIds, onProgress, phaseLabel) {
  const root = await tryRead(node);
  if (root.ok) return root.value || {};

  const labels = {
    messages: 'сообщения',
    views: 'просмотры',
    comments: 'комментарии',
    poll_votes: 'голоса опросов',
  };
  const label = labels[node] || node;

  const pairs = await mapLimit(chatIds, 8, async (chatId) => [
    chatId,
    await safeRead(`${node}/${chatId}`, {}),
  ], (done, total) => onProgress?.({ phase: phaseLabel, done, total, message: `Читаем ${label}…` }));

  return Object.fromEntries(pairs);
}

/**
 * Полная статистика мессенджера.
 * @param {{ onProgress?: (info: object) => void }} options
 */
export async function loadGlobalStats({ onProgress = null } = {}) {
  onProgress?.({ phase: 'users', done: 0, total: 1, message: 'Читаем пользователей…' });

  const users = await safeRead('users', null);
  if (!users) {
    throw new Error('Не удалось прочитать список пользователей — нужны права супер-администратора');
  }
  const userIds = Object.keys(users);
  onProgress?.({ phase: 'users', done: 1, total: 1, message: 'Пользователи загружены' });

  const chatsRoot = await tryRead('chats');
  const chats = chatsRoot.ok
    ? (chatsRoot.value || {})
    : await enumerateChats(userIds, onProgress);
  const chatIds = Object.keys(chats);

  const [messages, views, comments, pollVotes, bannedUsers, deletedUsers, invites, redemptions] = await Promise.all([
    readPerChat('messages', chatIds, onProgress, 'messages'),
    readPerChat('views', chatIds, onProgress, 'views'),
    readPerChat('comments', chatIds, onProgress, 'comments'),
    readPerChat('poll_votes', chatIds, onProgress, 'poll_votes'),
    safeRead('banned_users', {}),
    safeRead('deleted_users', {}),
    safeRead('invite_codes', {}),
    safeRead('invite_redemptions', {}),
  ]);

  onProgress?.({ phase: 'presence', done: 0, total: userIds.length, message: 'Читаем присутствие…' });
  const presencePairs = await mapLimit(userIds, 8, async (uid) => [
    uid,
    await safeRead(`presence/${uid}`, null),
  ], (done, total) => onProgress?.({ phase: 'presence', done, total, message: 'Читаем присутствие…' }));
  const presence = Object.fromEntries(presencePairs.filter(([, item]) => item));

  onProgress?.({ phase: 'compute', done: 0, total: 1, message: 'Считаем итоги…' });
  const stats = buildGlobalStats({
    users,
    deletedUsers: deletedUsers || {},
    bannedUsers: bannedUsers || {},
    presence,
    chats,
    messages,
    views,
    comments,
    pollVotes,
    invites: invites || {},
    redemptions: redemptions || {},
  });
  onProgress?.({ phase: 'compute', done: 1, total: 1, message: 'Готово' });

  return stats;
}
