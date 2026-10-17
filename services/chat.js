/**
 * Beacon — сервис чатов, профилей и сообщений.
 *
 * Все пути и названия полей соответствуют structure-template.json:
 *
 *   /users/$uid              { username, firstName, lastName?, bio?, avatar?, email, createdAt }
 *   /usernames/$username     $uid                       — индекс поиска людей
 *   /chats/$chat_id          { type, groupType?, username?, title?, description?, owner?, users?,
 *                              admins?, subscribersCount?, createdAt, lastMessage? }
 *   /channel_usernames/$username  $chat_id              — индекс поиска каналов
 *   /group_usernames/$username    $chat_id              — индекс поиска публичных групп
 *   /messages/$chat_id       { $msg_id: { sender, text, timestamp } }
 *   /user_chats/$uid         { $chat_id: true }
 *   /user_blocks/$uid        { $blocked_uid: true }     — чёрный список
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
  query,
  limitToLast,
  limitToFirst,
  orderByKey,
  startAt,
  endAt,
  runTransaction,
  increment,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
import { db } from '../firebase-config.js?v=4';

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

/**
 * Занять юзернейм для пользователя (атомарно, через транзакцию).
 * Если юзернейм свободен или уже принадлежит этому пользователю — успех.
 */
async function claimUsername(uid, username) {
  const result = await runTransaction(ref(db, `usernames/${username}`), (current) => {
    if (current === null || current === uid) return uid;
    return undefined; // занято другим — прерываем транзакцию
  });
  if (!result.committed) throw new Error(`Юзернейм @${username} уже занят`);
}

/**
 * Занять юзернейм канала (по нему канал находят и подписываются).
 * @returns {Promise<string>} chatId канала-владельца
 */
async function claimChannelUsername(chatId, username) {
  const result = await runTransaction(ref(db, `channel_usernames/${username}`), (current) => {
    if (current === null || current === chatId) return chatId;
    return undefined; // занято другим каналом — прерываем транзакцию
  });
  if (!result.committed) throw new Error(`Юзернейм канала @${username} уже занят`);
}

/**
 * Занять юзернейм публичной группы (по нему группу находят и присоединяются).
 * @returns {Promise<string>} chatId группы-владельца
 */
async function claimGroupUsername(chatId, username) {
  const result = await runTransaction(ref(db, `group_usernames/${username}`), (current) => {
    if (current === null || current === chatId) return chatId;
    return undefined; // занято другой группой — прерываем транзакцию
  });
  if (!result.committed) throw new Error(`Юзернейм группы @${username} уже занят`);
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
 *            bg1: string, bg2?: string}|null} null — аватарка по умолчанию (инициалы)
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

  const gradient = raw.bgType === 'gradient' && AVATAR_COLOR_REGEX.test(bg2);
  return gradient
    ? { kind, value, bgType: 'gradient', bg1, bg2 }
    : { kind, value, bgType: 'solid', bg1 };
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
 * Найти пользователя по юзернейму (через индекс /usernames).
 * @param {string} rawUsername — можно передавать с «@»
 * @returns {Promise<({uid: string} & Record<string, unknown>) | null>}
 */
export async function getUserByUsername(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) return null;

  const snapshot = await get(ref(db, `usernames/${username}`));
  const uid = snapshot.val();
  if (!uid) return null;

  const profile = await getUserProfile(uid);
  return { uid, username, ...(profile || {}) };
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

  usersCache.delete(uid);
  return getUserProfile(uid, { force: true });
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
  const snapshot = await get(usersQuery);

  // Внимание: колбэк forEach обязан возвращать undefined (тело в блоках).
  // SDK прекращает перебор, если колбэк вернёт истинное значение, а
  // Array.push возвращает число — выражение-стрелка здесь «съело» бы всех детей кроме первого.
  const found = [];
  snapshot.forEach((child) => {
    found.push({ username: child.key, uid: child.val() });
  });

  const users = [];
  for (const entry of found) {
    const profile = await getUserProfile(entry.uid);
    if (profile) users.push({ uid: entry.uid, ...profile, username: profile.username || entry.username });
  }
  return users;
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

  const updates = {};
  if (!snapshot.exists()) {
    updates[`chats/${chatId}`] = {
      type: 'private',
      createdAt: nowSeconds(),
      users: { [myUid]: true, [peerUid]: true },
    };
  }
  // Идемпотентно добавляем чат в списки обоих участников.
  updates[`user_chats/${myUid}/${chatId}`] = true;
  updates[`user_chats/${peerUid}/${chatId}`] = true;

  await update(ref(db), updates);
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
  if (isPublic) await claimGroupUsername(chatId, cleanUsername);

  const users = { [ownerUid]: true };
  if (!isPublic) {
    memberUids.filter(Boolean).forEach((uid) => {
      if (uid !== ownerUid) users[uid] = true;
    });
  }

  const updates = {};
  updates[`chats/${chatId}`] = {
    type: 'group',
    groupType: isPublic ? 'public' : 'private',
    title: cleanTitle,
    owner: ownerUid,
    createdAt: nowSeconds(),
    users,
    ...(cleanDescription ? { description: cleanDescription } : {}),
    ...(isPublic ? { username: cleanUsername } : {}),
  };
  Object.keys(users).forEach((uid) => {
    updates[`user_chats/${uid}/${chatId}`] = true;
  });

  try {
    await update(ref(db), updates);
  } catch (error) {
    // Не оставляем «висячий» юзернейм группы.
    if (isPublic) await set(ref(db, `group_usernames/${cleanUsername}`), null).catch(() => {});
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
  await claimChannelUsername(chatId, cleanUsername);

  const updates = {};
  updates[`chats/${chatId}`] = {
    type: 'channel',
    username: cleanUsername,
    title: cleanTitle,
    description: cleanDescription,
    owner: ownerUid,
    createdAt: nowSeconds(),
    subscribersCount: 1,
    admins: { [ownerUid]: true },
  };
  updates[`user_chats/${ownerUid}/${chatId}`] = true;

  try {
    await update(ref(db), updates);
  } catch (error) {
    // Не оставляем «висячий» юзернейм канала.
    await set(ref(db, `channel_usernames/${cleanUsername}`), null).catch(() => {});
    throw error;
  }

  return chatId;
}

/**
 * Подписаться на канал: запись в /user_chats + счётчик подписчиков.
 * @returns {Promise<void>}
 */
export async function subscribeToChannel(uid, chatId) {
  const updates = {
    [`user_chats/${uid}/${chatId}`]: true,
    [`chats/${chatId}/subscribersCount`]: increment(1),
  };
  await update(ref(db), updates);
}

/**
 * Отписаться от канала / покинуть его.
 * @returns {Promise<void>}
 */
export async function unsubscribeFromChannel(uid, chatId) {
  const updates = {
    [`user_chats/${uid}/${chatId}`]: null,
    [`chats/${chatId}/subscribersCount`]: increment(-1),
  };
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
  const snapshot = await get(channelsQuery);

  const results = [];
  const entries = [];
  // Тело в блоках: возврат истинного значения из колбэка останавливает перебор (см. комментарий в searchUsersByPrefix).
  snapshot.forEach((child) => {
    entries.push({ username: child.key, chatId: child.val() });
  });

  for (const entry of entries) {
    const chat = await getChat(entry.chatId);
    if (chat) results.push({ chatId: entry.chatId, ...chat, username: chat.username || entry.username });
  }
  return results;
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
  const snapshot = await get(groupsQuery);

  const entries = [];
  // Тело в блоках: возврат истинного значения из колбэка останавливает перебор (см. комментарий в searchUsersByPrefix).
  snapshot.forEach((child) => {
    entries.push({ username: child.key, chatId: child.val() });
  });

  const results = [];
  for (const entry of entries) {
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
  return results;
}

/**
 * Обновить настройки группы или канала (доступно только владельцу).
 * Группа: название, описание, тип (приватная/публичная), юзернейм публичной
 * группы — с захватом/освобождением индекса /group_usernames.
 * Канал: название и описание.
 *
 * @param {string} chatId
 * @param {string} requesterUid
 * @param {{ title: string, description?: string, groupType?: 'private'|'public',
 *           username?: string }} data
 * @returns {Promise<object>} обновлённый узел чата
 */
export async function updateChatSettings(chatId, requesterUid, data) {
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Чат не найден');
  if (chat.type !== 'group' && chat.type !== 'channel') {
    throw new Error('Настройки доступны только для групп и каналов');
  }
  if (chat.owner !== requesterUid) throw new Error('Изменять настройки может только владелец');

  const cleanTitle = String(data.title || '').trim();
  const cleanDescription = String(data.description || '').trim();
  if (!cleanTitle) throw new Error(chat.type === 'group' ? 'Укажите название группы' : 'Укажите название канала');

  const updates = {
    [`chats/${chatId}/title`]: cleanTitle,
    [`chats/${chatId}/description`]: cleanDescription || null,
  };

  let claimed = null;
  if (chat.type === 'group') {
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
  if (chat.owner !== requesterUid) throw new Error('Удалять может только владелец');

  const updates = {
    [`chats/${chatId}`]: null,
    [`messages/${chatId}`]: null,
  };
  if (chat.username) {
    const indexNode = chat.type === 'channel' ? 'channel_usernames' : 'group_usernames';
    updates[`${indexNode}/${chat.username}`] = null;
  }

  // Убираем чат из списков всех пользователей: у каналов подписчики заранее неизвестны.
  const allUserChats = (await get(ref(db, 'user_chats'))).val() || {};
  for (const [uid, chatsMap] of Object.entries(allUserChats)) {
    if (chatsMap && chatsMap[chatId]) updates[`user_chats/${uid}/${chatId}`] = null;
  }

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
 * Отправить сообщение атомарным multi-path update (update()):
 *   1) новое сообщение -> /messages/$chat_id/$msg_id;
 *   2) превью и время  -> /chats/$chat_id/lastMessage.
 *
 * @returns {Promise<string|null>} id созданного сообщения (null, если текст пустой)
 */
export async function sendMessage(chatId, senderUid, text) {
  if (!chatId || !senderUid) throw new Error('Не указан чат или отправитель');

  const body = String(text || '').trim();
  if (!body) return null;

  const timestamp = nowSeconds();
  const messageId = push(ref(db, `messages/${chatId}`)).key;
  const message = { sender: senderUid, text: body, timestamp };

  const updates = {
    [`messages/${chatId}/${messageId}`]: message,
    [`chats/${chatId}/lastMessage`]: { text: body, sender: senderUid, timestamp },
  };

  await update(ref(db), updates);
  return messageId;
}
