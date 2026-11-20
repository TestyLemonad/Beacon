import * as Chat from '../services/chat.js?v=77';
import { buildChatListItem, sortedChats, visibleChats } from './chat-list.js?v=77';
import { openChannelPreview, openChannelReadOnly, selectChat } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { flashMessage } from './messages.js?v=77';
import { CHAT_TYPE_ICONS, applyChatAvatar, applyProfileAvatar, buildNameWithStatus, buildUserNameWithStatus, chatStatusFor, getChatTitle, getPrivatePeerUid, getProfileName, getSenderName, hydrateUsers } from './profile-view.js?v=77';
import { deepLink, state } from './state.js?v=77';
import { createEl, formatListTime, plural, toast } from './utils.js?v=77';

/**
 * Поиск: пользователи по @юзернейму, каналы, свои чаты и сообщения
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let searchSeq = 0;          // защита от гонок при поиске
let searchTimer = null;
let deepLinkHandled = false;

/* ============================================================
 *  Поиск: пользователи по @юзернейму, каналы, свои чаты
 * ============================================================ */

/** Локальная фильтрация своих чатов по названию/юзернейму. */
function filterLocalChats(query) {
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  return sortedChats().filter(([, chat]) => {
    const title = getChatTitle(chat).toLowerCase();
    const username = (chat.username || '').toLowerCase();
    return title.includes(q) || (username && username.includes(q));
  });
}

/* --- Полнотекстовый поиск по сообщениям (идея 17) --- */

/** Сколько секунд держим сообщения чата в кэше поиска. */
const MSG_CACHE_TTL = 120;

/** Последние сообщения чата с кэшем: без повторных запросов при каждом вводе. */
async function fetchChatMessagesCached(chatId) {
  const cached = state.msgCache.get(chatId);
  const now = Date.now() / 1000;
  if (cached && now - cached.ts < MSG_CACHE_TTL) return cached.messages;
  const messages = await Chat.fetchRecentMessages(chatId, 150);
  state.msgCache.set(chatId, { ts: now, messages });
  return messages;
}

/** Подходит ли сообщение выбранному периоду ('all' | 'day' | 'week' | 'month'). */
function matchPeriod(timestamp, period) {
  if (period === 'all' || !period) return true;
  const diff = Date.now() / 1000 - Number(timestamp);
  if (period === 'day') return diff <= 86400;
  if (period === 'week') return diff <= 7 * 86400;
  if (period === 'month') return diff <= 30 * 86400;
  return true;
}

/** Собрать совпадения по тексту во всех моих чатах (последние 150 сообщений). */
async function collectMessageResults(query, seq) {
  const q = query.toLowerCase();
  const results = [];

  await Promise.allSettled([...state.myChatIds].map(async (chatId) => {
    try {
      const messages = await fetchChatMessagesCached(chatId);
      for (const message of messages) {
        const text = String(message.text || '');
        if (text && text.toLowerCase().includes(q)) {
          results.push({
            chatId,
            msgId: message.id,
            sender: message.sender,
            text,
            timestamp: message.timestamp,
          });
        }
      }
    } catch (error) {
      console.error('Ошибка поиска сообщений в чате:', chatId, error);
    }
  }));

  if (seq !== searchSeq) return; // запрос устарел
  results.sort((a, b) => b.timestamp - a.timestamp);
  state.search.messages = results.slice(0, 80);
}

/** Результаты поиска сообщений после фильтров «чат / автор / период». */
function filteredMessageResults() {
  const { chatId, author, period } = state.searchFilters;
  const messages = Array.isArray(state.search.messages) ? state.search.messages : [];
  return messages.filter((item) => (
    (!chatId || item.chatId === chatId)
    && (!author || item.sender === author)
    && matchPeriod(item.timestamp, period)
  ));
}

async function runSearch(rawQuery) {
  const seq = ++searchSeq;
  const query = String(rawQuery || '').trim();
  const normalized = Chat.normalizeUsername(rawQuery);
  // Индексный поиск по @юзернейму — только для валидных юзернеймов (a–z, 0–9, «_»).
  const prefix = normalized && Chat.isValidUsername(normalized) ? normalized : '';

  state.search.query = rawQuery;
  syncSearchUrl(query);
  state.search.localChats = filterLocalChats(query);
  state.search.loading = Boolean(prefix) || query.length >= 2;

  if (!prefix && query.length < 2) {
    state.search.users = [];
    state.search.groups = [];
    state.search.channels = [];
    state.search.messages = [];
    renderSearchResults();
    return;
  }

  renderSearchResults(); // показываем состояние «Поиск…»

  const jobs = [];

  if (prefix) {
    jobs.push((async () => {
      try {
        const [users, groups, channels] = await Promise.all([
          Chat.searchUsersByPrefix(prefix, 10),
          Chat.searchGroupsByPrefix(prefix, 10),
          Chat.searchChannelsByPrefix(prefix, 10),
        ]);
        if (seq !== searchSeq) return; // устаревший запрос
        state.search.users = users.filter((user) => user.uid !== state.user?.uid);
        state.search.groups = groups;
        state.search.channels = channels;
      } catch (error) {
        console.error('Ошибка поиска:', error);
      }
    })());
  } else {
    state.search.users = [];
    state.search.groups = [];
    state.search.channels = [];
  }

  if (query.length >= 2) jobs.push(collectMessageResults(query, seq));
  else state.search.messages = [];

  await Promise.allSettled(jobs);
  if (seq !== searchSeq) return;
  state.search.loading = false;
  renderSearchResults();
}

/** Строка результата «пользователь». */
function buildUserRow(user) {
  // Снимок из поиска мог устареть — показываем свежий профиль из кэша.
  const cached = Chat.getCachedUserProfile(user.uid);
  const profile = cached === undefined ? user : { ...user, ...(cached || {}) };

  const item = createEl('div', 'chat-item');
  item.tabIndex = 0;
  const avatar = createEl('div', 'avatar');
  applyProfileAvatar(avatar, profile, user.uid);

  const body = createEl('div', 'chat-item-body');
  const top = createEl('div', 'chat-item-top');
  top.append(buildUserNameWithStatus(getProfileName(profile) || '@' + profile.username, user.uid));
  if (state.blocked.has(user.uid)) top.append(createEl('span', 'search-badge muted', 'в ЧС'));

  const bottom = createEl('div', 'chat-item-bottom');
  const subtitle = '@' + profile.username + (profile.bio ? ' · ' + profile.bio : '');
  bottom.append(createEl('span', 'chat-item-preview', subtitle));

  body.append(top, bottom);
  item.append(avatar, body);
  item.addEventListener('click', () => openPrivateChatWith(user.uid));
  return item;
}

/** Строка результата «канал». */
function buildChannelRow(channel) {
  const subscribed = state.myChatIds.has(channel.chatId);
  const item = createEl('div', 'chat-item');
  item.tabIndex = 0;

  const avatar = createEl('div', 'avatar');
  applyChatAvatar(avatar, channel.chatId, channel);

  const body = createEl('div', 'chat-item-body');
  const top = createEl('div', 'chat-item-top');
  top.append(buildNameWithStatus(channel.title || 'Канал', chatStatusFor(channel.chatId)));
  if (subscribed) top.append(createEl('span', 'search-badge', 'вы подписаны'));

  const bottom = createEl('div', 'chat-item-bottom');
  const count = Number(channel.subscribersCount) || 0;
  const subtitle = `@${channel.username} · ${count} ${plural(count, ['подписчик', 'подписчика', 'подписчиков'])}`;
  bottom.append(createEl('span', 'chat-item-preview', subtitle));
  const icon = createEl('span', 'chat-type-icon');
  icon.innerHTML = CHAT_TYPE_ICONS.channel;
  bottom.append(icon);

  body.append(top, bottom);
  item.append(avatar, body);
  item.addEventListener('click', () => {
    exitSearchMode();
    if (subscribed) selectChat(channel.chatId);
    else if (channel.requiresSubscription === false) openChannelReadOnly(channel.chatId, channel);
    else openChannelPreview(channel.chatId);
  });
  return item;
}

/** Строка результата «публичная группа». */
function buildGroupRow(group) {
  const member = state.myChatIds.has(group.chatId);
  const item = createEl('div', 'chat-item');
  item.tabIndex = 0;

  const avatar = createEl('div', 'avatar');
  applyChatAvatar(avatar, group.chatId, group);

  const body = createEl('div', 'chat-item-body');
  const top = createEl('div', 'chat-item-top');
  top.append(buildNameWithStatus(group.title || 'Группа', chatStatusFor(group.chatId)));
  if (member) top.append(createEl('span', 'search-badge', 'вы участник'));

  const bottom = createEl('div', 'chat-item-bottom');
  const count = Number(group.memberCount) || 0;
  const subtitle = `@${group.username} · ${count} ${plural(count, ['участник', 'участника', 'участников'])}`;
  bottom.append(createEl('span', 'chat-item-preview', subtitle));
  const icon = createEl('span', 'chat-type-icon');
  icon.innerHTML = CHAT_TYPE_ICONS.group;
  bottom.append(icon);

  body.append(top, bottom);
  item.append(avatar, body);
  item.addEventListener('click', () => {
    exitSearchMode();
    if (member) selectChat(group.chatId);
    else openChannelPreview(group.chatId);
  });
  return item;
}

/** Текст с подсветкой совпадения поискового запроса. */
function highlightParts(text) {
  const raw = String(text || '');
  const query = String(state.search.query || '').trim();
  if (!query) return [document.createTextNode(raw)];

  const lower = raw.toLowerCase();
  const needle = query.toLowerCase();
  const parts = [];
  let from = 0;
  let index = lower.indexOf(needle);

  while (index !== -1) {
    if (index > from) parts.push(document.createTextNode(raw.slice(from, index)));
    parts.push(createEl('mark', 'search-mark', raw.slice(index, index + needle.length)));
    from = index + needle.length;
    index = lower.indexOf(needle, from);
  }
  if (from < raw.length) parts.push(document.createTextNode(raw.slice(from)));
  return parts;
}

/** Строка результата «сообщение»: автор, превью текста, чат. */
function buildMessageResultRow(item) {
  const chat = state.chats.get(item.chatId) || null;
  const row = createEl('div', 'chat-item msg-result');
  row.tabIndex = 0;

  const avatar = createEl('div', 'avatar avatar-sm');
  applyProfileAvatar(avatar, Chat.getCachedUserProfile(item.sender), item.sender);

  const body = createEl('div', 'chat-item-body');

  const top = createEl('div', 'chat-item-top');
  const author = item.sender === state.user?.uid ? 'Вы' : getSenderName(item.sender);
  top.append(buildUserNameWithStatus(author, item.sender));
  top.append(createEl('span', 'chat-item-time', formatListTime(item.timestamp)));

  const preview = createEl('div', 'chat-item-preview msg-result-text');
  preview.append(...highlightParts(item.text));

  const place = createEl('div', 'msg-result-place', 'в «' + getChatTitle(chat) + '»');

  body.append(top, preview, place);
  row.append(avatar, body);
  row.addEventListener('click', () => openSearchMessage(item));
  return row;
}

/** Перейти из результата поиска к сообщению в чате. */
function openSearchMessage(item) {
  exitSearchMode();
  selectChat(item.chatId);
  // Лента подгружается подпиской — пробуем подсветить сообщение.
  window.setTimeout(() => {
    if (state.activeChatId === item.chatId && !flashMessage(item.msgId)) {
      toast('Сообщение не подгружено в историю — оно выше загруженных');
    }
  }, 450);
}

/** Панель фильтров поиска сообщений: чат / автор / период. */
function buildSearchFilters() {
  const row = createEl('div', 'search-filters');

  const chatSelect = createEl('select', 'filter-select');
  chatSelect.title = 'Чат';
  const allChats = createEl('option', '', 'Все чаты');
  allChats.value = '';
  chatSelect.append(allChats);
  for (const [chatId, chat] of visibleChats()) {
    const opt = createEl('option', '', getChatTitle(chat));
    opt.value = chatId;
    chatSelect.append(opt);
  }
  chatSelect.value = state.searchFilters.chatId;
  chatSelect.addEventListener('change', () => {
    state.searchFilters.chatId = chatSelect.value;
    renderSearchResults();
  });

  const authorSelect = createEl('select', 'filter-select');
  authorSelect.title = 'Автор';
  const anyAuthor = createEl('option', '', 'Любой автор');
  anyAuthor.value = '';
  authorSelect.append(anyAuthor);
  for (const uid of [...new Set(state.search.messages.map((item) => item.sender))]) {
    if (state.blocked.has(uid)) continue;
    const opt = createEl('option', '', uid === state.user?.uid ? 'Вы' : getSenderName(uid));
    opt.value = uid;
    authorSelect.append(opt);
  }
  authorSelect.value = state.searchFilters.author;
  authorSelect.addEventListener('change', () => {
    state.searchFilters.author = authorSelect.value;
    renderSearchResults();
  });

  const periodSelect = createEl('select', 'filter-select');
  periodSelect.title = 'Период';
  for (const [value, label] of [
    ['all', 'За всё время'],
    ['day', 'Сегодня'],
    ['week', 'За неделю'],
    ['month', 'За месяц'],
  ]) {
    const opt = createEl('option', '', label);
    opt.value = value;
    periodSelect.append(opt);
  }
  periodSelect.value = state.searchFilters.period;
  periodSelect.addEventListener('change', () => {
    state.searchFilters.period = periodSelect.value;
    renderSearchResults();
  });

  row.append(chatSelect, authorSelect, periodSelect);
  return row;
}

/** Секция результатов поиска по сообщениям с фильтрами. */
function renderMessageSearchSection() {
  const query = String(state.search.query || '').trim();
  if (query.length < 2) return;

  const total = Array.isArray(state.search.messages) ? state.search.messages.length : 0;
  dom.searchResults.append(createEl(
    'div',
    'search-section',
    total ? `Сообщения · ${total}` : 'Сообщения',
  ));
  dom.searchResults.append(buildSearchFilters());

  const filtered = filteredMessageResults();
  if (!filtered.length) {
    dom.searchResults.append(createEl('p', 'search-empty', state.search.loading
      ? 'Ищем в сообщениях…'
      : 'Совпадений в сообщениях нет'));
    return;
  }

  filtered.slice(0, 30).forEach((item) => dom.searchResults.append(buildMessageResultRow(item)));
  hydrateUsers(filtered.map((item) => item.sender));
}

/** Отрисовать результаты поиска (мои чаты, сообщения, люди, группы, каналы). */
export function renderSearchResults() {
  const { query, loading, users, groups, channels, localChats } = state.search;
  dom.searchResults.innerHTML = '';
  if (!query) return;

  if (loading && !users.length && !groups.length && !channels.length && !localChats.length) {
    dom.searchResults.append(createEl('p', 'search-empty', 'Поиск…'));
    return;
  }

  const addSection = (title, nodes) => {
    if (!nodes.length) return;
    dom.searchResults.append(createEl('div', 'search-section', title));
    nodes.forEach((node) => dom.searchResults.append(node));
  };

  addSection('Мои чаты', localChats.map(([chatId, chat]) => buildChatListItem('div', chatId, chat)));
  renderMessageSearchSection();
  addSection('Пользователи', users.map(buildUserRow));
  addSection('Группы', groups.map(buildGroupRow));
  addSection('Каналы', channels.map(buildChannelRow));

  // Следим за найденными людьми: имя и аватарка могут измениться.
  hydrateUsers(users.map((user) => user.uid));

  const normalized = Chat.normalizeUsername(query);
  const hasPrefix = Boolean(normalized) && Chat.isValidUsername(normalized);
  const onlyShortQuery = String(query).trim().length < 2 && !hasPrefix;
  if (!dom.searchResults.children.length || onlyShortQuery) {
    const empty = createEl('p', 'search-empty');
    empty.innerHTML = 'Ничего не найдено.<br />Поиск идёт по @юзернеймам и по тексту последних сообщений.';
    dom.searchResults.append(empty);
  }
}

function enterSearchMode() {
  dom.searchResults.classList.remove('hidden');
  dom.chatListWrap.classList.add('hidden');
}

export function exitSearchMode() {
  searchSeq++; // результаты «в полёте» больше не перерисуют панель
  dom.searchInput.value = '';
  dom.searchClear.classList.add('hidden');
  dom.searchResults.classList.add('hidden');
  dom.chatListWrap.classList.remove('hidden');
  state.search = { query: '', loading: false, users: [], groups: [], channels: [], localChats: [], messages: [] };
  state.searchFilters = { chatId: '', author: '', period: 'all' };
  // До применения глубокой ссылки не вычищаем ?s= из адреса, иначе ссылка
  // потеряется, если человек ещё не вошёл и обновит страницу.
  if (deepLinkHandled) syncSearchUrl('');
}

/* --- Глубокие ссылки: /?s=… и /?u=@… --- */

/** Обновить ?s= в адресной строке, не создавая записей в истории. */
function syncSearchUrl(query) {
  try {
    const url = new URL(window.location.href);
    const value = String(query || '').trim();
    if (value) url.searchParams.set('s', value);
    else url.searchParams.delete('s');
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, '', next);
  } catch (error) {
    console.warn('Не удалось обновить адрес поиска:', error);
  }
}

/** Убрать GET-параметр из адресной строки. */
function removeUrlParam(name) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (error) {
    console.warn('Не удалось обновить адрес:', error);
  }
}

/** Записать ?u=@username в адрес, не создавая записей в истории. */
function syncUserUrl(username) {
  const value = username ? '@' + username : '';
  if (!value) {
    removeUrlParam('u');
    return;
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('u', value);
    // URLSearchParams кодирует «@» как %40 — в адресе оставляем читаемый вид.
    const search = url.search.replace(/%40/gi, '@');
    const next = `${url.pathname}${search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, '', next);
  } catch (error) {
    console.warn('Не удалось обновить адрес:', error);
  }
}

/**
 * Подставить ?u= под открытый чат: человек по @username, канал или группа.
 * Личный чат без юзернейма у собеседника просто убирает параметр.
 */
export async function syncChatUrl(chat) {
  if (!chat) return;

  let username = String(chat.username || '');
  if (chat.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    if (!peerUid) {
      syncUserUrl('');
      return;
    }
    let profile = Chat.getCachedUserProfile(peerUid);
    if (!profile?.username) {
      profile = await Chat.getUserProfile(peerUid).catch(() => null);
    }
    username = String(profile?.username || '');
  }

  syncUserUrl(username);
}

/** Открыть глобальный поиск по запросу (также используется для @упоминаний). */
export function openGlobalSearch(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) return;

  exitSearchMode();
  dom.searchInput.value = query;
  dom.searchClear.classList.remove('hidden');
  enterSearchMode();
  runSearch(query);
  if (window.innerWidth <= 768) dom.searchInput.blur();
}

/** Открыть пользователя, канал или публичную группу по @юзернейму. */
export async function openDeepLinkUsername(rawUsername) {
  const username = Chat.normalizeUsername(rawUsername);

  if (!Chat.isValidUsername(username)) {
    if (rawUsername) openGlobalSearch(rawUsername);
    return;
  }

  // Дополнительный юзернейм ведёт на основной профиль цели.
  try {
    const alias = await Chat.getUsernameAlias(username);
    if (alias?.type === 'user') {
      const profile = await Chat.getUserProfile(alias.target);
      if (profile) {
        if (alias.target === state.user?.uid) {
          openGlobalSearch('@' + username);
          toast('Это ваш юзернейм');
          return;
        }
        await openPrivateChatWith(alias.target);
        return;
      }
    } else if (alias && (alias.type === 'channel' || alias.type === 'group')) {
      const chat = await Chat.getChat(alias.target);
      if (chat) {
        exitSearchMode();
        const uid = state.user?.uid;
        const isMember = chat.type === 'group'
          ? Boolean(chat.users?.[uid])
          : Boolean(chat.subscribers?.[uid] || chat.admins?.[uid] || chat.owner === uid);
        if (isMember) selectChat(alias.target);
        else openChannelPreview(alias.target);
        return;
      }
    }
  } catch (error) {
    console.warn('Не удалось открыть дополнительный юзернейм:', error);
  }

  let target = null;
  try {
    const [user, channels, groups] = await Promise.all([
      Chat.getUserByUsername(username).catch(() => null),
      Chat.searchChannelsByPrefix(username, 5).catch(() => []),
      Chat.searchGroupsByPrefix(username, 5).catch(() => []),
    ]);
    const channel = channels.find((item) => item.username === username);
    const group = groups.find((item) => item.username === username);

    // Порядок как в выдаче поиска: сначала человек, затем канал и группа.
    if (user) target = { kind: 'user', user };
    else if (channel) target = { kind: 'chat', chat: channel };
    else if (group) target = { kind: 'chat', chat: group };
  } catch (error) {
    console.error('Не удалось открыть ссылку по юзернейму:', error);
  }

  if (!target) {
    openGlobalSearch('@' + username);
    toast(`@${username} не найден — показаны результаты поиска`);
    return;
  }

  exitSearchMode();

  if (target.kind === 'user') {
    if (target.user.uid === state.user?.uid) {
      openGlobalSearch('@' + username);
      toast('Это ваш юзернейм');
      return;
    }
    await openPrivateChatWith(target.user.uid);
    return;
  }

  const { chat } = target;
  const chatId = chat.chatId;
  if (!chatId) {
    openGlobalSearch('@' + username);
    return;
  }

  const uid = state.user?.uid;
  const isMember = chat.type === 'group'
    ? Boolean(chat.users?.[uid])
    : Boolean(chat.subscribers?.[uid] || chat.admins?.[uid] || chat.owner === uid);

  if (isMember) selectChat(chatId);
  else openChannelPreview(chatId);
}

/** Применить глубокую ссылку после входа в мессенджер. */
export async function applyDeepLink() {
  if (deepLinkHandled || !state.user) return;
  if (!deepLink.username && !deepLink.search) {
    deepLinkHandled = true;
    return;
  }

  deepLinkHandled = true;
  if (deepLink.username) {
    await openDeepLinkUsername(deepLink.username);
    return;
  }
  openGlobalSearch(deepLink.search);
}

/** Создать личный чат по uid и открыть его. */
async function openPrivateChatWith(peerUid) {
  try {
    const chatId = await Chat.createPrivateChat(state.user.uid, peerUid);
    exitSearchMode();
    selectChat(chatId);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось создать чат', 'error');
  }
}


/** Навесить обработчики интерфейса этого модуля. */
export function initSearch() {
  // --- Поиск ---
  dom.searchInput.addEventListener('input', () => {
    const query = dom.searchInput.value.trim();
    dom.searchClear.classList.toggle('hidden', !query);
    clearTimeout(searchTimer);

    if (!query) {
      exitSearchMode();
      return;
    }

    enterSearchMode();
    searchTimer = setTimeout(() => runSearch(query), 280);
  });

  dom.searchClear.addEventListener('click', () => {
    exitSearchMode();
    dom.searchInput.focus();
  });

  dom.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') exitSearchMode();
  });
}

