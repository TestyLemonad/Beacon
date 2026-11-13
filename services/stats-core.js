/**
 * Beacon — чистые вычисления статистики.
 *
 * Модуль не обращается ни к Firebase, ни к DOM: получает уже загруженные
 * узлы Realtime Database и возвращает готовые числа/ряды для дашборда.
 * Так одну и ту же логику используют страница /dashboard и служебный
 * снимок публичной статистики.
 */

/** Секунд в сутках. */
export const DAY_SECONDS = 86400;

/** Локальный ключ даты YYYY-MM-DD (в часовом поясе зрителя). */
export function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Короткая подпись даты: «13.11». */
export function shortDate(date) {
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

/** Безопасное число: null/undefined/NaN -> 0. */
export function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Однострочный сниппет текста сообщения. */
export function snippet(value, limit = 90) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** Имя пользователя для списков: имя+фамилия, иначе @username, иначе подпись. */
export function displayName(user, uid = '') {
  if (!user) return uid ? 'Пользователь' : 'Удалённый аккаунт';
  if (user.deleted === true) return 'Удалённый аккаунт';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (user.username) return '@' + user.username;
  return 'Без имени';
}

/**
 * Ряд «последние N дней» по массиву unix-секунд.
 * @param {number[]} timestamps
 * @param {number} days
 * @param {number} nowMs
 * @returns {Array<{key: string, label: string, date: Date, count: number}>}
 */
export function buildDailySeries(timestamps, days = 30, nowMs = Date.now()) {
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);

  const series = [];
  const index = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = dateKey(date);
    const item = { key, label: shortDate(date), date, count: 0 };
    series.push(item);
    index.set(key, item);
  }

  for (const value of timestamps || []) {
    const ts = num(value);
    if (!ts) continue;
    const item = index.get(dateKey(ts * 1000));
    if (item) item.count += 1;
  }

  return series;
}

/**
 * Ряд «последние N месяцев».
 * @param {number[]} timestamps
 * @param {number} months
 * @param {number} nowMs
 */
export function buildMonthlySeries(timestamps, months = 12, nowMs = Date.now()) {
  const now = new Date(nowMs);
  const series = [];
  const index = new Map();

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const item = {
      key,
      label: date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', ''),
      count: 0,
    };
    series.push(item);
    index.set(key, item);
  }

  for (const value of timestamps || []) {
    const ts = num(value);
    if (!ts) continue;
    const date = new Date(ts * 1000);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const item = index.get(key);
    if (item) item.count += 1;
  }

  return series;
}

/** Распределение по дням недели (Пн…Вс). */
export function buildWeekdaySeries(timestamps) {
  const labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const counts = new Array(7).fill(0);
  for (const value of timestamps || []) {
    const ts = num(value);
    if (!ts) continue;
    const day = new Date(ts * 1000).getDay();
    counts[(day + 6) % 7] += 1;
  }
  return labels.map((label, index) => ({ label, count: counts[index] }));
}

/** Распределение по часам суток (0…23). */
export function buildHourSeries(timestamps) {
  const counts = new Array(24).fill(0);
  for (const value of timestamps || []) {
    const ts = num(value);
    if (!ts) continue;
    counts[new Date(ts * 1000).getHours()] += 1;
  }
  return counts.map((count, hour) => ({ label: String(hour).padStart(2, '0'), count }));
}

/** Тип чата в терминах статистики. */
export function chatKind(chat) {
  if (!chat || typeof chat !== 'object') return 'unknown';
  if (chat.type === 'channel') return 'channel';
  if (chat.type === 'group') return 'group';
  if (chat.type === 'saved') return 'saved';
  if (chat.type === 'private') return 'private';
  return 'unknown';
}

/** Название канала/чата для списков. */
export function chatTitle(chat, fallback = 'Без названия') {
  if (!chat) return fallback;
  if (chat.title) return String(chat.title);
  if (chat.username) return '@' + chat.username;
  return fallback;
}

/** Число уникальных ключей в объекте. */
function keyCount(value) {
  if (!value || typeof value !== 'object') return 0;
  return Object.keys(value).length;
}

/** Все сообщения чата в виде массива с id. */
export function messageList(messagesMap) {
  if (!messagesMap || typeof messagesMap !== 'object') return [];
  return Object.entries(messagesMap)
    .filter(([, message]) => message && typeof message === 'object')
    .map(([id, message]) => ({ id, ...message }))
    .sort((a, b) => (num(a.timestamp) - num(b.timestamp)) || String(a.id).localeCompare(String(b.id)));
}

/** Сколько реакций у сообщения (по пользователям). */
export function reactionCount(message) {
  const reactions = message?.reactions;
  if (!reactions || typeof reactions !== 'object') return 0;
  let total = 0;
  for (const users of Object.values(reactions)) total += keyCount(users);
  return total;
}

/** Сколько уникальных проголосовавших в опросе. */
function pollVoterCount(votesForMessage) {
  return keyCount(votesForMessage);
}

/** Сколько всего отметок в опросе (мультивыбор даёт несколько). */
function pollSelectionCount(votesForMessage) {
  if (!votesForMessage || typeof votesForMessage !== 'object') return 0;
  let total = 0;
  for (const options of Object.values(votesForMessage)) {
    if (options && typeof options === 'object') total += keyCount(options);
  }
  return total;
}

/**
 * Сводная статистика всего мессенджера.
 *
 * @param {{
 *   users?: object, deletedUsers?: object, bannedUsers?: object, presence?: object,
 *   chats?: object, messages?: object, views?: object, comments?: object,
 *   pollVotes?: object, invites?: object, redemptions?: object
 * }} raw
 */
export function buildGlobalStats({
  users = {},
  deletedUsers = {},
  bannedUsers = {},
  presence = {},
  chats = {},
  messages = {},
  views = {},
  comments = {},
  pollVotes = {},
  invites = {},
  redemptions = {},
} = {}) {
  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);
  const safeUsers = users && typeof users === 'object' ? users : {};
  const userIds = Object.keys(safeUsers);

  const deletedSet = new Set();
  for (const [uid, value] of Object.entries(deletedUsers || {})) {
    if (value) deletedSet.add(uid);
  }
  for (const uid of userIds) {
    if (safeUsers[uid]?.deleted === true) deletedSet.add(uid);
  }
  const activeIds = userIds.filter((uid) => !deletedSet.has(uid));
  const activeSet = new Set(activeIds);

  const bannedIds = Object.keys(bannedUsers || {}).filter((uid) => bannedUsers[uid]);

  // --- Пользователи ---
  const createdTimestamps = [];
  let withUsername = 0;
  let withAvatar = 0;
  let withBio = 0;
  for (const uid of activeIds) {
    const user = safeUsers[uid] || {};
    if (user.username) withUsername += 1;
    if (user.avatar) withAvatar += 1;
    if (user.bio) withBio += 1;
    if (user.createdAt) createdTimestamps.push(num(user.createdAt));
  }
  const registeredToday = createdTimestamps.filter((ts) => ts >= now - DAY_SECONDS).length;
  const registeredWeek = createdTimestamps.filter((ts) => ts >= now - 7 * DAY_SECONDS).length;
  const registeredMonth = createdTimestamps.filter((ts) => ts >= now - 30 * DAY_SECONDS).length;

  // --- Присутствие ---
  let online = 0;
  let activeToday = 0;
  let activeWeek = 0;
  let activeMonth = 0;
  for (const [uid, item] of Object.entries(presence || {})) {
    if (!activeSet.has(uid)) continue;
    if (item?.online === true) online += 1;
    const lastSeen = num(item?.lastSeen);
    if (!lastSeen) continue;
    if (lastSeen >= now - DAY_SECONDS) activeToday += 1;
    if (lastSeen >= now - 7 * DAY_SECONDS) activeWeek += 1;
    if (lastSeen >= now - 30 * DAY_SECONDS) activeMonth += 1;
  }

  // --- Чаты и сообщения ---
  const safeChats = chats && typeof chats === 'object' ? chats : {};
  const safeMessages = messages && typeof messages === 'object' ? messages : {};
  const chatIds = new Set([...Object.keys(safeChats), ...Object.keys(safeMessages)]);

  const chatsByKind = { private: 0, group: 0, channel: 0, saved: 0, unknown: 0 };
  let groupsPublic = 0;
  let groupsPrivate = 0;
  let channelsRequiringSubscription = 0;
  let channelsWithUsername = 0;
  let activeChannels = 0;
  let activeGroups = 0;

  let messagesTotal = 0;
  let savedMessages = 0;
  const messagesByKind = { private: 0, group: 0, channel: 0, saved: 0, unknown: 0 };
  const messageTimestamps = [];
  let withText = 0;
  let withPoll = 0;
  let withForward = 0;
  let withReply = 0;
  let edited = 0;
  let totalChars = 0;
  const senders = new Set();
  const sentByUser = new Map();

  let viewsTotal = 0;
  const uniqueViewers = new Set();
  let commentsTotal = 0;
  const commenters = new Set();
  let reactionsTotal = 0;
  const reactors = new Set();
  const reactionEmoji = new Map();
  let pollsTotal = 0;
  let pollVotesTotal = 0;
  let pollSelectionsTotal = 0;
  const voters = new Set();
  let subscribersTotal = 0;

  const channelRows = [];

  for (const chatId of chatIds) {
    const chat = safeChats[chatId] || null;
    const kind = chatKind(chat);
    chatsByKind[kind] = (chatsByKind[kind] || 0) + 1;

    if (kind === 'group') {
      if (chat?.groupType === 'public') {
        groupsPublic += 1;
        activeGroups += 1;
      } else {
        groupsPrivate += 1;
      }
    }
    if (kind === 'channel') {
      activeChannels += 1;
      if (chat?.requiresSubscription === true) channelsRequiringSubscription += 1;
      if (chat?.username) channelsWithUsername += 1;
    }

    const list = messageList(safeMessages[chatId]);
    const chatMessageCount = list.length;
    if (kind === 'saved') savedMessages += chatMessageCount;
    else {
      messagesTotal += chatMessageCount;
      messagesByKind[kind] = (messagesByKind[kind] || 0) + chatMessageCount;
    }

    const chatViews = views?.[chatId] && typeof views[chatId] === 'object' ? views[chatId] : {};
    let chatViewsTotal = 0;
    for (const map of Object.values(chatViews)) {
      if (!map || typeof map !== 'object') continue;
      const count = keyCount(map);
      chatViewsTotal += count;
      viewsTotal += count;
      for (const uid of Object.keys(map)) uniqueViewers.add(uid);
    }

    const chatComments = comments?.[chatId] && typeof comments[chatId] === 'object' ? comments[chatId] : {};
    let chatCommentsTotal = 0;
    for (const postComments of Object.values(chatComments)) {
      if (!postComments || typeof postComments !== 'object') continue;
      for (const comment of Object.values(postComments)) {
        chatCommentsTotal += 1;
        commentsTotal += 1;
        if (comment?.sender) commenters.add(comment.sender);
      }
    }

    const chatVotes = pollVotes?.[chatId] && typeof pollVotes[chatId] === 'object' ? pollVotes[chatId] : {};
    let chatPollVotes = 0;
    for (const votesForMessage of Object.values(chatVotes)) {
      chatPollVotes += pollVoterCount(votesForMessage);
      pollVotesTotal += pollVoterCount(votesForMessage);
      pollSelectionsTotal += pollSelectionCount(votesForMessage);
      if (votesForMessage && typeof votesForMessage === 'object') {
        for (const uid of Object.keys(votesForMessage)) voters.add(uid);
      }
    }

    let chatPolls = 0;
    let lastMessageAt = 0;
    for (const message of list) {
      const ts = num(message.timestamp);
      if (ts) {
        if (kind !== 'saved') messageTimestamps.push(ts);
        lastMessageAt = Math.max(lastMessageAt, ts);
      }
      if (message.poll) chatPolls += 1;
      if (kind !== 'saved') {
        if (message.sender) {
          senders.add(message.sender);
          sentByUser.set(message.sender, (sentByUser.get(message.sender) || 0) + 1);
        }
        const text = String(message.text || '');
        if (text.trim()) {
          withText += 1;
          totalChars += text.length;
        }
        if (message.poll) withPoll += 1;
        if (message.forwardedFrom) withForward += 1;
        if (message.replyTo) withReply += 1;
        if (message.editedAt) edited += 1;
      }

      const reactions = message.reactions;
      if (reactions && typeof reactions === 'object') {
        for (const [emoji, map] of Object.entries(reactions)) {
          if (!map || typeof map !== 'object') continue;
          const count = keyCount(map);
          reactionsTotal += count;
          reactionEmoji.set(emoji, (reactionEmoji.get(emoji) || 0) + count);
          for (const uid of Object.keys(map)) reactors.add(uid);
        }
      }
    }
    pollsTotal += chatPolls;

    const subscribers = keyCount(chat?.subscribers) || num(chat?.subscribersCount);
    if (kind === 'channel') {
      subscribersTotal += subscribers;
      channelRows.push({
        id: chatId,
        title: chatTitle(chat, 'Канал'),
        username: String(chat?.username || ''),
        subscribers,
        subscribersCount: num(chat?.subscribersCount),
        messages: chatMessageCount,
        views: chatViewsTotal,
        comments: chatCommentsTotal,
        pollVotes: chatPollVotes,
        postsLast30: list.filter((message) => num(message.timestamp) >= now - 30 * DAY_SECONDS).length,
        lastMessageAt,
        requiresSubscription: chat?.requiresSubscription === true,
      });
    }
  }

  const topChannels = [...channelRows].sort((a, b) =>
    (b.subscribers - a.subscribers) || (b.messages - a.messages) || (b.views - a.views));
  const topChannelsByMessages = [...channelRows].sort((a, b) =>
    (b.messages - a.messages) || (b.views - a.views));

  const topUsers = activeIds
    .map((uid) => ({
      uid,
      name: displayName(safeUsers[uid], uid),
      username: String(safeUsers[uid]?.username || ''),
      messages: sentByUser.get(uid) || 0,
    }))
    .filter((row) => row.messages > 0)
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 12);

  // --- Инвайты ---
  const inviteList = Object.values(invites || {}).filter((item) => item && typeof item === 'object');
  let revoked = 0;
  let expired = 0;
  for (const invite of inviteList) {
    if (invite.revoked === true) revoked += 1;
    else if (num(invite.expiresAt) && num(invite.expiresAt) < now) expired += 1;
  }

  return {
    generatedAt: now,
    users: {
      total: userIds.length,
      active: activeIds.length,
      deleted: deletedSet.size,
      banned: bannedIds.length,
      withUsername,
      withAvatar,
      withBio,
      registeredToday,
      registeredWeek,
      registeredMonth,
      daily: buildDailySeries(createdTimestamps, 30, nowMs),
      monthly: buildMonthlySeries(createdTimestamps, 12, nowMs),
    },
    presence: { online, activeToday, activeWeek, activeMonth },
    chats: {
      total: chatIds.size,
      private: chatsByKind.private,
      groups: chatsByKind.group,
      groupsPublic,
      groupsPrivate,
      channels: chatsByKind.channel,
      saved: chatsByKind.saved,
      unknown: chatsByKind.unknown,
      channelsRequiringSubscription,
      channelsWithUsername,
      activeChannels,
      activeGroups,
    },
    messages: {
      total: messagesTotal,
      saved: savedMessages,
      byKind: messagesByKind,
      today: messageTimestamps.filter((ts) => ts >= now - DAY_SECONDS).length,
      last7: messageTimestamps.filter((ts) => ts >= now - 7 * DAY_SECONDS).length,
      last30: messageTimestamps.filter((ts) => ts >= now - 30 * DAY_SECONDS).length,
      withText,
      withPoll,
      withForward,
      withReply,
      edited,
      avgLength: withText ? Math.round(totalChars / withText) : 0,
      uniqueSenders: senders.size,
      daily: buildDailySeries(messageTimestamps, 30, nowMs),
      monthly: buildMonthlySeries(messageTimestamps, 12, nowMs),
      byWeekday: buildWeekdaySeries(messageTimestamps),
      byHour: buildHourSeries(messageTimestamps),
    },
    engagement: {
      views: viewsTotal,
      uniqueViewers: uniqueViewers.size,
      comments: commentsTotal,
      commenters: commenters.size,
      reactions: reactionsTotal,
      reactors: reactors.size,
      reactionEmoji: [...reactionEmoji.entries()]
        .map(([emoji, count]) => ({ emoji, count }))
        .sort((a, b) => b.count - a.count),
      polls: pollsTotal,
      pollVotes: pollVotesTotal,
      pollSelections: pollSelectionsTotal,
      voters: voters.size,
      subscribers: subscribersTotal,
    },
    invites: {
      total: inviteList.length,
      revoked,
      expired,
      active: inviteList.length - revoked - expired,
      redeemed: Object.keys(redemptions || {}).length,
    },
    topChannels: topChannels.slice(0, 10),
    topChannelsByMessages: topChannelsByMessages.slice(0, 10),
    topUsers,
    channelRows,
  };
}

/**
 * Публичный снимок: только агрегаты, без имён/переписок.
 * @param {ReturnType<typeof buildGlobalStats>} stats
 */
export function toPublicSnapshot(stats) {
  const summary = {
    users: stats.users.active,
    channels: stats.chats.channels,
    groups: stats.chats.groups,
    privateChats: stats.chats.private,
    messages: stats.messages.total,
    messagesToday: stats.messages.today,
    messagesWeek: stats.messages.last7,
    messagesMonth: stats.messages.last30,
    online: stats.presence.online,
    activeWeek: stats.presence.activeWeek,
    activeMonth: stats.presence.activeMonth,
    views: stats.engagement.views,
    comments: stats.engagement.comments,
    reactions: stats.engagement.reactions,
    polls: stats.engagement.polls,
    pollVotes: stats.engagement.pollVotes,
    subscribers: stats.engagement.subscribers,
    usersRegisteredWeek: stats.users.registeredWeek,
    usersRegisteredMonth: stats.users.registeredMonth,
  };

  return {
    version: 1,
    updatedAt: stats.generatedAt,
    summary,
    dailyMessages: stats.messages.daily.map((day) => ({ key: day.key, label: day.label, count: day.count })),
    dailyUsers: stats.users.daily.map((day) => ({ key: day.key, label: day.label, count: day.count })),
    topChannels: stats.topChannels
      .filter((channel) => channel.username)
      .slice(0, 8)
      .map((channel) => ({
        title: channel.title,
        username: channel.username,
        subscribers: channel.subscribers,
        messages: channel.messages,
        views: channel.views,
      })),
  };
}

/**
 * Личная статистика пользователя.
 *
 * @param {{
 *   uid: string, user?: object, chats?: object, messages?: object,
 *   views?: object, comments?: object, pollVotes?: object, reads?: object,
 *   meta?: object, folders?: object, sessions?: object, settings?: object,
 *   presence?: object, users?: object
 * }} raw
 */
export function buildPersonalStats({
  uid,
  user = {},
  chats = {},
  messages = {},
  views = {},
  comments = {},
  pollVotes = {},
  reads = {},
  meta = {},
  folders = {},
  sessions = {},
  settings = {},
  presence = {},
  users = {},
} = {}) {
  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);

  const chatIds = Object.keys(chats || {});
  const counts = { private: 0, group: 0, channel: 0, saved: 0, unknown: 0 };
  let ownedGroups = 0;
  let adminGroups = 0;
  let ownedChannels = 0;
  let adminChannels = 0;
  let subscribedChannels = 0;
  let archived = 0;
  let pinned = 0;

  let myMessagesTotal = 0;
  const myTimestamps = [];
  const myMessagesByKind = { private: 0, group: 0, channel: 0, saved: 0, unknown: 0 };
  let myPolls = 0;
  let myForwards = 0;
  let myReplies = 0;
  let myEdited = 0;
  let myChars = 0;
  let myTextMessages = 0;
  let lastSentAt = 0;

  let unreadChats = 0;
  let unreadMessages = 0;

  let reactionsGiven = 0;
  let reactionsReceived = 0;
  let repliesToMe = 0;
  let forwardsOfMe = 0;
  let myViews = 0;
  let viewsOnMyPosts = 0;
  let myComments = 0;
  let commentsOnMyPosts = 0;
  let myVotes = 0;
  let myVoteSelections = 0;
  let votesOnMyPolls = 0;

  const topChats = [];
  const channelRows = [];

  for (const chatId of chatIds) {
    const chat = chats[chatId] || null;
    const kind = chatKind(chat);
    counts[kind] = (counts[kind] || 0) + 1;

    const isOwner = chat?.owner === uid;
    const isAdmin = Boolean(chat?.admins?.[uid]);
    const isSubscriber = Boolean(chat?.subscribers?.[uid]);

    if (kind === 'group') {
      if (isOwner) ownedGroups += 1;
      if (isAdmin) adminGroups += 1;
    }
    if (kind === 'channel') {
      if (isOwner) ownedChannels += 1;
      if (isAdmin) adminChannels += 1;
      if (isSubscriber) subscribedChannels += 1;
    }
    if (meta?.[chatId]?.archived) archived += 1;
    if (meta?.[chatId]?.pinnedAt) pinned += 1;

    const list = messageList(messages?.[chatId]);
    const readTs = num(reads?.[chatId]);
    let chatMine = 0;
    let chatUnread = 0;

    for (const message of list) {
      if (message.sender === uid) {
        chatMine += 1;
        myMessagesTotal += 1;
        myMessagesByKind[kind] = (myMessagesByKind[kind] || 0) + 1;
        const ts = num(message.timestamp);
        if (ts) {
          myTimestamps.push(ts);
          lastSentAt = Math.max(lastSentAt, ts);
        }
        if (message.poll) myPolls += 1;
        if (message.forwardedFrom) myForwards += 1;
        if (message.replyTo) myReplies += 1;
        if (message.editedAt) myEdited += 1;
        const text = String(message.text || '');
        if (text.trim()) {
          myTextMessages += 1;
          myChars += text.length;
        }
      } else if (num(message.timestamp) > readTs) {
        chatUnread += 1;
      }

      const messageReactions = message.reactions;
      if (messageReactions && typeof messageReactions === 'object') {
        for (const map of Object.values(messageReactions)) {
          if (!map || typeof map !== 'object') continue;
          if (map[uid]) reactionsGiven += 1;
          if (message.sender === uid) reactionsReceived += keyCount(map);
        }
      }

      if (message.replyTo?.sender === uid && message.sender !== uid) repliesToMe += 1;
      if (message.forwardedFrom?.uid === uid && message.sender !== uid) forwardsOfMe += 1;
    }

    const chatViews = views?.[chatId] && typeof views[chatId] === 'object' ? views[chatId] : {};
    for (const [msgId, map] of Object.entries(chatViews)) {
      if (!map || typeof map !== 'object') continue;
      if (map[uid]) myViews += 1;
      const post = messages?.[chatId]?.[msgId];
      if (post?.sender === uid) {
        viewsOnMyPosts += Object.keys(map).filter((viewerUid) => viewerUid !== uid).length;
      }
    }

    const chatComments = comments?.[chatId] && typeof comments[chatId] === 'object' ? comments[chatId] : {};
    for (const [postId, postComments] of Object.entries(chatComments)) {
      if (!postComments || typeof postComments !== 'object') continue;
      for (const comment of Object.values(postComments)) {
        if (comment?.sender === uid) myComments += 1;
        const post = messages?.[chatId]?.[postId];
        if (post?.sender === uid && comment?.sender !== uid) commentsOnMyPosts += 1;
      }
    }

    const chatVotes = pollVotes?.[chatId] && typeof pollVotes[chatId] === 'object' ? pollVotes[chatId] : {};
    for (const [msgId, votesForMessage] of Object.entries(chatVotes)) {
      if (!votesForMessage || typeof votesForMessage !== 'object') continue;
      if (votesForMessage[uid]) {
        myVotes += 1;
        myVoteSelections += keyCount(votesForMessage[uid]);
      }
      const post = messages?.[chatId]?.[msgId];
      if (post?.sender === uid && post?.poll) {
        votesOnMyPolls += keyCount(votesForMessage);
      }
    }

    if (chatUnread > 0) {
      unreadChats += 1;
      unreadMessages += chatUnread;
    }
    if (chatMine > 0) {
      topChats.push({
        id: chatId,
        title: chatTitle(chat, 'Чат'),
        kind,
        count: chatMine,
      });
    }

    if (kind === 'channel' && (isOwner || isAdmin)) {
      let channelViews = 0;
      for (const map of Object.values(chatViews)) {
        if (map && typeof map === 'object') channelViews += keyCount(map);
      }
      let channelComments = 0;
      for (const postComments of Object.values(chatComments)) {
        if (postComments && typeof postComments === 'object') channelComments += keyCount(postComments);
      }
      channelRows.push({
        id: chatId,
        title: chatTitle(chat, 'Канал'),
        username: String(chat?.username || ''),
        role: isOwner ? 'owner' : 'admin',
        subscribers: keyCount(chat?.subscribers) || num(chat?.subscribersCount),
        posts: list.length,
        views: channelViews,
        comments: channelComments,
        lastPostAt: list.length ? num(list[list.length - 1].timestamp) : 0,
      });
    }
  }

  topChats.sort((a, b) => b.count - a.count);

  const folderList = Object.values(folders || {}).filter((folder) => folder && typeof folder === 'object');
  const sessionList = Object.values(sessions || {}).filter((session) => session && typeof session === 'object');
  const activeSessions = sessionList.filter((session) => !session.revokedAt);
  const lastSession = activeSessions.reduce((max, session) => Math.max(max, num(session.lastActive)), 0);

  const createdAt = num(user?.createdAt);
  const myPresence = presence?.[uid] || presence || {};

  return {
    generatedAt: now,
    uid,
    profile: {
      name: displayName(user, uid),
      username: String(user?.username || ''),
      avatar: user?.avatar || null,
      createdAt,
      ageDays: createdAt ? Math.max(0, Math.floor((now - createdAt) / DAY_SECONDS)) : 0,
      hasUsername: Boolean(user?.username),
      hasName: Boolean(user?.firstName),
      hasAvatar: Boolean(user?.avatar),
      hasBio: Boolean(user?.bio),
    },
    account: {
      sessionsTotal: sessionList.length,
      sessionsActive: activeSessions.length,
      lastSessionAt: lastSession,
      lastSeenPrivacy: String(settings?.lastSeenPrivacy || 'all'),
      adminMode: settings?.adminMode !== false,
      online: myPresence?.online === true,
      lastSeen: num(myPresence?.lastSeen),
      folders: folderList.length,
      folderNames: folderList.map((folder) => String(folder.name || 'Папка')),
    },
    chats: {
      total: chatIds.length,
      private: counts.private,
      groups: counts.group,
      channels: counts.channel,
      saved: counts.saved,
      archived,
      pinned,
      ownedGroups,
      adminGroups,
      ownedChannels,
      adminChannels,
      subscribedChannels,
    },
    messages: {
      total: myMessagesTotal,
      byKind: myMessagesByKind,
      today: myTimestamps.filter((ts) => ts >= now - DAY_SECONDS).length,
      last7: myTimestamps.filter((ts) => ts >= now - 7 * DAY_SECONDS).length,
      last30: myTimestamps.filter((ts) => ts >= now - 30 * DAY_SECONDS).length,
      polls: myPolls,
      forwards: myForwards,
      replies: myReplies,
      edited: myEdited,
      avgLength: myTextMessages ? Math.round(myChars / myTextMessages) : 0,
      lastSentAt,
      daily: buildDailySeries(myTimestamps, 30, nowMs),
      monthly: buildMonthlySeries(myTimestamps, 12, nowMs),
      byWeekday: buildWeekdaySeries(myTimestamps),
      byHour: buildHourSeries(myTimestamps),
    },
    unread: { chats: unreadChats, messages: unreadMessages },
    engagement: {
      reactionsGiven,
      reactionsReceived,
      repliesToMe,
      forwardsOfMe,
      viewsOnMyPosts,
      myViews,
      commentsOnMyPosts,
      myComments,
      votesOnMyPolls,
      myVotes,
      myVoteSelections,
    },
    topChats: topChats.slice(0, 8),
    channels: channelRows,
    channelTotals: {
      count: channelRows.length,
      subscribers: channelRows.reduce((sum, row) => sum + row.subscribers, 0),
      posts: channelRows.reduce((sum, row) => sum + row.posts, 0),
      views: channelRows.reduce((sum, row) => sum + row.views, 0),
      comments: channelRows.reduce((sum, row) => sum + row.comments, 0),
    },
  };
}

/**
 * Подробная статистика одного канала.
 *
 * @param {{
 *   uid: string, chat: object, messages?: object, views?: object,
 *   comments?: object, pollVotes?: object, isRoot?: boolean
 * }} raw
 */
export function buildChannelStats({
  uid,
  chat = {},
  messages = {},
  views = {},
  comments = {},
  pollVotes = {},
  isRoot = false,
} = {}) {
  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);

  const posts = messageList(messages);
  const postIds = new Set(posts.map((post) => post.id));
  const subscribers = keyCount(chat?.subscribers) || num(chat?.subscribersCount);
  const admins = keyCount(chat?.admins) + (chat?.owner ? 1 : 0);

  let viewsTotal = 0;
  const uniqueViewers = new Map();
  const viewTimestamps = [];
  for (const [msgId, map] of Object.entries(views || {})) {
    if (!map || typeof map !== 'object') continue;
    if (postIds.size && !postIds.has(msgId)) {
      // Просмотры удалённых постов тоже считаем в общий счётчик.
    }
    for (const [viewerUid, ts] of Object.entries(map)) {
      viewsTotal += 1;
      uniqueViewers.set(viewerUid, (uniqueViewers.get(viewerUid) || 0) + 1);
      if (ts) viewTimestamps.push(num(ts));
    }
  }

  const commentsByPost = new Map();
  const commenters = new Map();
  let commentsTotal = 0;
  for (const [postId, postComments] of Object.entries(comments || {})) {
    if (!postComments || typeof postComments !== 'object') continue;
    const count = keyCount(postComments);
    commentsByPost.set(postId, count);
    commentsTotal += count;
    for (const comment of Object.values(postComments)) {
      const sender = comment?.sender;
      if (sender) commenters.set(sender, (commenters.get(sender) || 0) + 1);
    }
  }

  const votesByPost = new Map();
  let pollVotesTotal = 0;
  for (const [postId, votesForMessage] of Object.entries(pollVotes || {})) {
    const voters = keyCount(votesForMessage);
    votesByPost.set(postId, voters);
    pollVotesTotal += voters;
  }

  const reactionEmoji = new Map();
  const reactors = new Map();
  let reactionsTotal = 0;
  for (const post of posts) {
    const reactions = post.reactions;
    if (!reactions || typeof reactions !== 'object') continue;
    for (const [emoji, map] of Object.entries(reactions)) {
      if (!map || typeof map !== 'object') continue;
      const count = keyCount(map);
      reactionsTotal += count;
      reactionEmoji.set(emoji, (reactionEmoji.get(emoji) || 0) + count);
      for (const reactorUid of Object.keys(map)) {
        reactors.set(reactorUid, (reactors.get(reactorUid) || 0) + 1);
      }
    }
  }

  const postTimestamps = posts.map((post) => num(post.timestamp)).filter(Boolean);
  const lastPostAt = postTimestamps.length ? Math.max(...postTimestamps) : 0;
  const isOwner = chat?.owner === uid;
  const isAdmin = Boolean(chat?.admins?.[uid]);
  const isSubscriber = Boolean(chat?.subscribers?.[uid]);
  const canRead = Boolean(
    isRoot
    || isOwner
    || isAdmin
    || isSubscriber
    || chat?.requiresSubscription === false,
  );

  const postRows = posts.map((post) => {
    const viewsCount = keyCount(views?.[post.id]);
    const commentsCount = commentsByPost.get(post.id) || 0;
    const votesCount = votesByPost.get(post.id) || 0;
    const reactionsCount = reactionCount(post);
    const text = post.poll ? '📊 ' + String(post.poll.question || '') : String(post.text || '');
    return {
      id: post.id,
      timestamp: num(post.timestamp),
      text: snippet(text, 90),
      isPoll: Boolean(post.poll),
      views: viewsCount,
      comments: commentsCount,
      votes: votesCount,
      reactions: reactionsCount,
    };
  });

  const sortBy = (field, limit = 8) => [...postRows]
    .filter((row) => row[field] > 0)
    .sort((a, b) => (b[field] - a[field]) || (b.timestamp - a.timestamp))
    .slice(0, limit);

  const pollRows = posts
    .filter((post) => post.poll)
    .map((post) => {
      const votesForMessage = pollVotes?.[post.id] || {};
      const options = (post.poll.options || []).map((option) => {
        let count = 0;
        for (const selected of Object.values(votesForMessage)) {
          if (selected && selected[option.id]) count += 1;
        }
        return { id: option.id, text: String(option.text || ''), count };
      });
      return {
        id: post.id,
        question: String(post.poll.question || 'Опрос'),
        multiple: Boolean(post.poll.multiple),
        timestamp: num(post.timestamp),
        voters: keyCount(votesForMessage),
        options,
      };
    })
    .sort((a, b) => (b.voters - a.voters) || (b.timestamp - a.timestamp));

  const dailyViews = buildDailySeries(viewTimestamps, 30, nowMs);
  const dailyPosts = buildDailySeries(postTimestamps, 30, nowMs);

  const viewsToday = viewTimestamps.filter((ts) => ts >= now - DAY_SECONDS).length;
  const viewsWeek = viewTimestamps.filter((ts) => ts >= now - 7 * DAY_SECONDS).length;
  const viewsMonth = viewTimestamps.filter((ts) => ts >= now - 30 * DAY_SECONDS).length;
  const postsToday = postTimestamps.filter((ts) => ts >= now - DAY_SECONDS).length;
  const postsWeek = postTimestamps.filter((ts) => ts >= now - 7 * DAY_SECONDS).length;
  const postsMonth = postTimestamps.filter((ts) => ts >= now - 30 * DAY_SECONDS).length;

  const topUsers = (map, limit = 6) => [...map.entries()]
    .map(([entryUid, count]) => ({ uid: entryUid, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const createdAt = num(chat?.createdAt);
  const bestViewDay = dailyViews.reduce((best, day) => (day.count > best.count ? day : best), dailyViews[0] || { count: 0 });
  const bestPostDay = dailyPosts.reduce((best, day) => (day.count > best.count ? day : best), dailyPosts[0] || { count: 0 });

  return {
    generatedAt: now,
    id: chat?.id || '',
    title: chatTitle(chat, 'Канал'),
    username: String(chat?.username || ''),
    description: String(chat?.description || ''),
    createdAt,
    ageDays: createdAt ? Math.max(0, Math.floor((now - createdAt) / DAY_SECONDS)) : 0,
    requiresSubscription: chat?.requiresSubscription === true,
    avatar: chat?.avatar || null,
    hasAvatar: Boolean(chat?.avatar),
    owner: String(chat?.owner || ''),
    roles: {
      isOwner,
      isAdmin,
      isSubscriber,
      canRead,
      canSeeAudience: Boolean(isRoot || isOwner || isAdmin),
    },
    totals: {
      subscribers,
      subscribersCount: num(chat?.subscribersCount),
      admins,
      posts: posts.length,
      views: viewsTotal,
      uniqueViewers: uniqueViewers.size,
      comments: commentsTotal,
      commenters: commenters.size,
      reactions: reactionsTotal,
      reactors: reactors.size,
      polls: pollRows.length,
      pollVotes: pollVotesTotal,
    },
    growth: {
      postsToday,
      postsWeek,
      postsMonth,
      viewsToday,
      viewsWeek,
      viewsMonth,
      lastPostAt,
      silentDays: lastPostAt ? Math.max(0, Math.floor((now - lastPostAt) / DAY_SECONDS)) : null,
    },
    averages: {
      viewsPerPost: posts.length ? Math.round(viewsTotal / posts.length) : 0,
      commentsPerPost: posts.length ? Number((commentsTotal / posts.length).toFixed(2)) : 0,
      reactionsPerPost: posts.length ? Number((reactionsTotal / posts.length).toFixed(2)) : 0,
      votesPerPoll: pollRows.length ? Math.round(pollVotesTotal / pollRows.length) : 0,
      postsPerWeek: posts.length && createdAt
        ? Number((posts.length / Math.max(1, (now - createdAt) / (7 * DAY_SECONDS))).toFixed(2))
        : 0,
    },
    rates: {
      viewRate: subscribers ? Number(((viewsTotal / posts.length || 0) / subscribers * 100).toFixed(1)) : 0,
      engagementRate: subscribers ? Number((((commentsTotal + reactionsTotal) / posts.length || 0) / subscribers * 100).toFixed(1)) : 0,
    },
    bestDays: {
      views: bestViewDay?.count ? { label: bestViewDay.label, count: bestViewDay.count } : null,
      posts: bestPostDay?.count ? { label: bestPostDay.label, count: bestPostDay.count } : null,
    },
    dailyViews,
    dailyPosts,
    monthlyPosts: buildMonthlySeries(postTimestamps, 12, nowMs),
    byWeekday: buildWeekdaySeries(postTimestamps),
    byHour: buildHourSeries(postTimestamps),
    reactionEmoji: [...reactionEmoji.entries()]
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count),
    topPostsByViews: sortBy('views'),
    topPostsByComments: sortBy('comments'),
    topPostsByReactions: sortBy('reactions'),
    polls: pollRows.slice(0, 8),
    topCommenters: topUsers(commenters),
    topViewers: topUsers(uniqueViewers),
    topReactors: topUsers(reactors),
  };
}
