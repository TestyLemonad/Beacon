/**
 * Beacon — точка входа SPA.
 *
 * Связывает сервисы Firebase (services/*) с DOM:
 *  - роутинг экранов: авторизация -> онбординг (юзернейм/имя/фамилия/био) -> мессенджер;
 *  - состояние приложения (профиль, чаты, активный чат, поиск, предпросмотр канала);
 *  - подписки RTDB и их очистка;
 *  - обработчики UI: список чатов, поиск по юзернеймам, сообщения,
 *    модальные окна «Новый чат» и «Профиль».
 */
import * as Auth from './services/auth.js?v=3';
import * as Chat from './services/chat.js?v=3';

/* ============================================================
 *  DOM
 * ============================================================ */

const $ = (id) => document.getElementById(id);

const dom = {
  // Экран авторизации
  authScreen: $('auth-screen'),
  authForm: $('auth-form'),
  authEmail: $('auth-email'),
  authPassword: $('auth-password'),
  authError: $('auth-error'),
  authSubmit: $('auth-submit'),
  authToggleMode: $('auth-toggle-mode'),
  googleBtn: $('google-btn'),

  // Онбординг: заполнение профиля после входа
  onboardingScreen: $('onboarding-screen'),
  onboardingForm: $('onboarding-form'),
  onboardingEmail: $('onboarding-email'),
  onboardingError: $('onboarding-error'),
  onboardingSubmit: $('onboarding-submit'),
  onboardingLogout: $('onboarding-logout'),
  obUsername: $('ob-username'),
  obFirstname: $('ob-firstname'),
  obLastname: $('ob-lastname'),
  obBio: $('ob-bio'),

  // Мессенджер: боковая панель
  messengerScreen: $('messenger-screen'),
  sidebarAvatar: $('sidebar-avatar'),
  currentUserName: $('current-user-name'),
  profileBtn: $('profile-btn'),
  logoutBtn: $('logout-btn'),
  newChatBtn: $('new-chat-btn'),
  searchInput: $('search-input'),
  searchClear: $('search-clear'),
  chatListWrap: $('chat-list-wrap'),
  chatList: $('chat-list'),
  chatListEmpty: $('chat-list-empty'),
  searchResults: $('search-results'),

  // Мессенджер: панель чата
  chatPanelEmpty: $('chat-panel-empty'),
  channelPreview: $('channel-preview'),
  previewBackBtn: $('preview-back-btn'),
  previewAvatar: $('preview-avatar'),
  previewTitle: $('preview-title'),
  previewMeta: $('preview-meta'),
  previewDescription: $('preview-description'),
  previewSubscribe: $('preview-subscribe'),
  chatView: $('chat-view'),
  backBtn: $('back-btn'),
  chatHeaderAvatar: $('chat-header-avatar'),
  chatTitle: $('chat-title'),
  chatStatus: $('chat-status'),
  unsubscribeBtn: $('unsubscribe-btn'),
  messages: $('messages'),
  channelLocked: $('channel-locked'),
  messageForm: $('message-form'),
  messageInput: $('message-input'),
  sendBtn: $('send-btn'),

  // Модальное окно «Новый чат»
  modalOverlay: $('modal-overlay'),
  modalClose: $('modal-close'),
  modalCancel: $('modal-cancel'),
  modalSubmit: $('modal-submit'),
  modalError: $('modal-error'),
  modalTabs: Array.from(document.querySelectorAll('.tab')),
  modalPanes: Array.from(document.querySelectorAll('.tab-pane')),
  createChatForm: $('create-chat-form'),
  privateUsername: $('private-username'),
  groupTitle: $('group-title'),
  groupMembers: $('group-members'),
  channelUsername: $('channel-username'),
  channelTitle: $('channel-title'),
  channelDescription: $('channel-description'),

  // Модальное окно «Профиль»
  profileOverlay: $('profile-overlay'),
  profileForm: $('profile-form'),
  profileClose: $('profile-close'),
  profileCancel: $('profile-cancel'),
  profileSubmit: $('profile-submit'),
  profileError: $('profile-error'),
  pfUsername: $('pf-username'),
  pfFirstname: $('pf-firstname'),
  pfLastname: $('pf-lastname'),
  pfBio: $('pf-bio'),

  // Уведомления
  toast: $('toast'),
};

/* ============================================================
 *  Состояние приложения
 * ============================================================ */

const state = {
  user: null,               // текущий Firebase Auth user
  profile: null,            // профиль из /users/$uid
  chats: new Map(),         // chatId -> узел /chats/$chat_id
  myChatIds: new Set(),     // id чатов из /user_chats/$uid (подписки)
  activeChatId: null,       // id открытого чата
  messages: [],             // сообщения активного чата (отсортированы)
  stickToBottom: true,      // держать ли скролл внизу
  channelPreview: null,     // { chatId, chat } — предпросмотр канала из поиска
  search: { query: '', loading: false, users: [], channels: [], localChats: [] },
  subscriptions: {
    userChats: null,
    messages: null,
    chatMeta: new Map(),    // chatId -> unsubscribe для /chats/$chat_id
  },
};

let authMode = 'login';     // 'login' | 'register'
let modalTab = 'private';   // активная вкладка модального окна
let searchSeq = 0;          // защита от гонок при поиске
let searchTimer = null;

/* ============================================================
 *  Утилиты
 * ============================================================ */

/** Палитра аватарок-заглушек. */
const AVATAR_COLORS = ['#f0a24a', '#e06c75', '#61afef', '#98c379', '#c678dd', '#56b6c2', '#d19a66', '#8f9ff5'];

/** Стабильный цвет аватарки по произвольному seed (uid или id чата). */
function avatarColor(seed) {
  let hash = 0;
  for (const char of String(seed || '?')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** unix-секунды -> "ЧЧ:ММ". */
function formatTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** unix-секунды -> "Сегодня" / "Вчера" / "ДД.ММ.ГГГГ" для разделителей дней. */
function formatDayLabel(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Сегодня';
  if (sameDay(date, yesterday)) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** unix-секунды -> время для списка чатов (сегодня — ЧЧ:ММ, иначе ДД.ММ). */
function formatListTime(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  if (date.toDateString() === new Date().toDateString()) return formatTime(unixSeconds);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** Склонение: plural(3, ['участник', 'участника', 'участников']). */
function plural(count, forms) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** Хелпер создания элементов. Пользовательский текст попадает только через textContent. */
function createEl(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

/* ============================================================
 *  Профили: отображение
 * ============================================================ */

/** Полное имя пользователя или @юзернейм. */
function getProfileName(profile) {
  if (!profile) return null;
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return full || (profile.username ? '@' + profile.username : null);
}

/** Инициалы для аватарки (или первая буква юзернейма). */
function getProfileInitials(profile) {
  const first = (profile?.firstName || '').trim();
  const last = (profile?.lastName || '').trim();
  if (first || last) return ((first[0] || '') + (last[0] || '')).toUpperCase();
  if (profile?.username) return profile.username.charAt(0).toUpperCase();
  return '?';
}

/** Имя отправителя из кэша профилей. */
function getSenderName(uid) {
  const profile = Chat.getCachedUserProfile(uid);
  if (profile === undefined) return '…'; // профиль ещё загружается
  return getProfileName(profile) || 'Пользователь';
}

/** Отрисовать аватар в существующем узле. */
function applyAvatar(node, seed, label) {
  node.style.background = avatarColor(seed);
  node.textContent = String(label || '?');
}

/* ============================================================
 *  Представление чата: заголовок, аватар, статус
 * ============================================================ */

/** SVG-иконки типов чата. */
const CHAT_TYPE_ICONS = {
  private:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  group:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  channel:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
};

/** Для личного чата — uid собеседника (все uid, кроме моего). */
function getPrivatePeerUid(chat) {
  if (!chat || chat.type !== 'private') return null;
  return Object.keys(chat.users || {}).find((uid) => uid !== state.user?.uid) || null;
}

/** Заголовок чата: для private — имя собеседника из /users. */
function getChatTitle(chat) {
  if (!chat) return 'Загрузка…';
  if (chat.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    const profile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
    return getProfileName(profile) || 'Личный чат';
  }
  return chat.title || 'Без названия';
}

/** Данные аватарки чата: seed цвета + подпись. */
function getChatAvatar(chatId, chat) {
  if (chat && chat.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    const profile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
    return { seed: peerUid || chatId, label: getProfileInitials(profile) };
  }
  return { seed: chatId, label: (chat?.title || '?').trim().charAt(0).toUpperCase() };
}

/** Статус в шапке чата: тип + @юзернейм / количество участников. */
function getChatStatus(chat) {
  if (!chat) return '';
  if (chat.type === 'channel') {
    const count = Number(chat.subscribersCount) || 0;
    const handle = chat.username ? `@${chat.username} · ` : '';
    return `Канал · ${handle}${count} ${plural(count, ['подписчик', 'подписчика', 'подписчиков'])}`;
  }
  if (chat.type === 'group') {
    const count = Object.keys(chat.users || {}).length;
    return `Группа · ${count} ${plural(count, ['участник', 'участника', 'участников'])}`;
  }
  const peerUid = getPrivatePeerUid(chat);
  const profile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
  return profile?.username ? '@' + profile.username : 'Личный чат';
}

/** Текст превью последнего сообщения для списка чатов. */
function getChatPreview(chat) {
  const last = chat?.lastMessage;
  if (!last || !last.text) return 'Нет сообщений';
  if (chat.type === 'private') return last.text;
  const who = last.sender === state.user?.uid ? 'Вы' : getSenderName(last.sender);
  return `${who}: ${last.text}`;
}

/** Имя текущего пользователя для сайдбара. */
function getOwnDisplayName() {
  return getProfileName(state.profile) || state.profile?.email || 'Пользователь';
}

/** Обновить аватар и имя текущего пользователя в сайдбаре. */
function updateSidebarUser() {
  dom.currentUserName.textContent = getOwnDisplayName();
  applyAvatar(dom.sidebarAvatar, state.user?.uid || 'me', getProfileInitials(state.profile));
}

/* ============================================================
 *  Догрузка профилей (имена отправителей, собеседников)
 * ============================================================ */

/**
 * Загрузить отсутствующие профили и перерисовать UI.
 * Профили кэшируются в services/chat.js, поэтому повторных
 * запросов и циклов перерисовки не возникает.
 */
async function hydrateUsers(uids) {
  if (!state.user) return;
  const missing = [...new Set(uids)]
    .filter(Boolean)
    .filter((uid) => Chat.getCachedUserProfile(uid) === undefined);
  if (!missing.length) return;

  await Promise.allSettled(missing.map((uid) => Chat.getUserProfile(uid)));
  if (!state.user) return; // пользователь успел выйти, пока грузили

  renderChatList();
  if (state.search.query) renderSearchResults();
  renderMainPanel();
}

/* ============================================================
 *  Список чатов (боковая панель)
 * ============================================================ */

/** Чаты, отсортированные по времени последнего сообщения (или создания). */
function sortedChats() {
  const time = (chat) => chat?.lastMessage?.timestamp || chat?.createdAt || 0;
  return [...state.chats.entries()].sort((a, b) => time(b[1]) - time(a[1]));
}

/** Элемент списка чатов (используется и в сайдбаре, и в результатах поиска). */
function buildChatListItem(tag, chatId, chat) {
  const item = createEl(tag, `chat-item${chatId === state.activeChatId ? ' active' : ''}`);
  item.dataset.chatId = chatId;

  const avatar = createEl('div', 'avatar');
  const avatarData = getChatAvatar(chatId, chat);
  applyAvatar(avatar, avatarData.seed, avatarData.label);

  const body = createEl('div', 'chat-item-body');

  const top = createEl('div', 'chat-item-top');
  top.append(createEl('span', 'chat-item-title', getChatTitle(chat)));
  if (chat.lastMessage?.timestamp) {
    top.append(createEl('span', 'chat-item-time', formatListTime(chat.lastMessage.timestamp)));
  }

  const bottom = createEl('div', 'chat-item-bottom');
  bottom.append(createEl('span', 'chat-item-preview', getChatPreview(chat)));
  const typeIcon = createEl('span', 'chat-type-icon');
  typeIcon.innerHTML = CHAT_TYPE_ICONS[chat.type] || '';
  bottom.append(typeIcon);

  body.append(top, bottom);
  item.append(avatar, body);
  item.addEventListener('click', () => selectChat(chatId));

  return item;
}

/** Отрисовать список диалогов. */
function renderChatList() {
  const chats = sortedChats();
  dom.chatList.innerHTML = '';
  dom.chatListEmpty.classList.toggle('hidden', chats.length > 0);

  const uidsToHydrate = [];

  for (const [chatId, chat] of chats) {
    dom.chatList.append(buildChatListItem('li', chatId, chat));

    if (chat.type === 'private') uidsToHydrate.push(getPrivatePeerUid(chat));
    if (chat.lastMessage?.sender) uidsToHydrate.push(chat.lastMessage.sender);
  }

  hydrateUsers(uidsToHydrate);
}

/* ============================================================
 *  Поиск: пользователи по @юзернейму, каналы, свои чаты
 * ============================================================ */

/** Локальная фильтрация своих чатов по названию/юзернейму. */
function filterLocalChats(query) {
  const q = query.toLowerCase();
  return sortedChats().filter(([, chat]) => {
    const title = getChatTitle(chat).toLowerCase();
    const username = (chat.username || '').toLowerCase();
    return title.includes(q) || (username && username.includes(q));
  });
}

async function runSearch(rawQuery) {
  const seq = ++searchSeq;
  const prefix = Chat.normalizeUsername(rawQuery);

  state.search.query = rawQuery;
  state.search.localChats = filterLocalChats(rawQuery);
  state.search.loading = Boolean(prefix);

  if (!prefix) {
    state.search.users = [];
    state.search.channels = [];
    renderSearchResults();
    return;
  }

  renderSearchResults(); // показываем состояние «Поиск…»

  let users = [];
  let channels = [];
  try {
    [users, channels] = await Promise.all([
      Chat.searchUsersByPrefix(prefix, 10),
      Chat.searchChannelsByPrefix(prefix, 10),
    ]);
  } catch (error) {
    console.error('Ошибка поиска:', error);
  }
  if (seq !== searchSeq) return; // устаревший запрос

  state.search.users = users.filter((user) => user.uid !== state.user?.uid);
  state.search.channels = channels;
  state.search.loading = false;
  renderSearchResults();
}

/** Строка результата «пользователь». */
function buildUserRow(user) {
  const item = createEl('div', 'chat-item');
  const avatar = createEl('div', 'avatar');
  applyAvatar(avatar, user.uid, getProfileInitials(user));

  const body = createEl('div', 'chat-item-body');
  const top = createEl('div', 'chat-item-top');
  top.append(createEl('span', 'chat-item-title', getProfileName(user) || '@' + user.username));

  const bottom = createEl('div', 'chat-item-bottom');
  const subtitle = '@' + user.username + (user.bio ? ' · ' + user.bio : '');
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

  const avatar = createEl('div', 'avatar');
  applyAvatar(avatar, channel.chatId, (channel.title || '?').charAt(0).toUpperCase());

  const body = createEl('div', 'chat-item-body');
  const top = createEl('div', 'chat-item-top');
  top.append(createEl('span', 'chat-item-title', channel.title || 'Канал'));
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
    else openChannelPreview(channel.chatId);
  });
  return item;
}

/** Отрисовать результаты поиска (разделы: мои чаты, люди, каналы). */
function renderSearchResults() {
  const { query, loading, users, channels, localChats } = state.search;
  dom.searchResults.innerHTML = '';
  if (!query) return;

  if (loading && !users.length && !channels.length && !localChats.length) {
    dom.searchResults.append(createEl('p', 'search-empty', 'Поиск…'));
    return;
  }

  const addSection = (title, nodes) => {
    if (!nodes.length) return;
    dom.searchResults.append(createEl('div', 'search-section', title));
    nodes.forEach((node) => dom.searchResults.append(node));
  };

  addSection('Мои чаты', localChats.map(([chatId, chat]) => buildChatListItem('div', chatId, chat)));
  addSection('Пользователи', users.map(buildUserRow));
  addSection('Каналы', channels.map(buildChannelRow));

  if (!dom.searchResults.children.length) {
    const empty = createEl('p', 'search-empty');
    empty.innerHTML = 'Ничего не найдено.<br />Поиск идёт по @юзернеймам пользователей и каналов.';
    dom.searchResults.append(empty);
  }
}

function enterSearchMode() {
  dom.searchResults.classList.remove('hidden');
  dom.chatListWrap.classList.add('hidden');
}

function exitSearchMode() {
  searchSeq++; // результаты «в полёте» больше не перерисуют панель
  dom.searchInput.value = '';
  dom.searchClear.classList.add('hidden');
  dom.searchResults.classList.add('hidden');
  dom.chatListWrap.classList.remove('hidden');
  state.search = { query: '', loading: false, users: [], channels: [], localChats: [] };
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

/* ============================================================
 *  Активный чат, предпросмотр канала и сообщения
 * ============================================================ */

/** Открыть чат: подписаться на сообщения, отрисовать панель. */
function selectChat(chatId) {
  state.channelPreview = null;

  const chatChanged = state.activeChatId !== chatId;
  state.activeChatId = chatId;
  document.body.classList.add('chat-open');

  if (chatChanged) {
    state.subscriptions.messages?.();
    state.subscriptions.messages = null;
    state.messages = [];
    state.stickToBottom = true;

    state.subscriptions.messages = Chat.subscribeToMessages(
      chatId,
      (messages) => {
        state.messages = messages;
        renderMessages();
      },
      { onError: () => toast('Не удалось загрузить сообщения', 'error') },
    );
  }

  renderChatList();
  renderMainPanel();
  if (chatChanged && window.innerWidth > 768) dom.messageInput.focus();
}

/** Полностью снять активный чат (например, отписались от канала). */
function closeActiveChat() {
  state.subscriptions.messages?.();
  state.subscriptions.messages = null;
  state.activeChatId = null;
  state.messages = [];
  state.stickToBottom = true;
  renderChatList();
  renderMainPanel();
}

/** Открыть предпросмотр канала (из поиска) — с кнопкой «Подписаться». */
async function openChannelPreview(chatId) {
  state.subscriptions.messages?.();
  state.subscriptions.messages = null;
  state.activeChatId = null;

  state.channelPreview = { chatId, chat: null };
  document.body.classList.add('chat-open');
  renderMainPanel();

  try {
    const chat = await Chat.getChat(chatId);
    if (!state.channelPreview || state.channelPreview.chatId !== chatId) return;
    state.channelPreview.chat = chat;
    renderMainPanel();
  } catch (error) {
    console.error(error);
    toast('Не удалось загрузить канал', 'error');
    closeChannelPreview();
  }
}

function closeChannelPreview() {
  state.channelPreview = null;
  document.body.classList.remove('chat-open');
  renderMainPanel();
}

/** Отрисовать главную панель: предпросмотр канала / чат / пустое состояние. */
function renderMainPanel() {
  if (state.channelPreview) {
    renderChannelPreview();
    return;
  }
  dom.channelPreview.classList.add('hidden');

  if (!state.activeChatId) {
    dom.chatView.classList.add('hidden');
    dom.chatPanelEmpty.classList.remove('hidden');
    return;
  }

  dom.chatPanelEmpty.classList.add('hidden');
  dom.chatView.classList.remove('hidden');

  const chat = state.chats.get(state.activeChatId) || null;

  dom.chatTitle.textContent = getChatTitle(chat);
  dom.chatStatus.textContent = getChatStatus(chat);
  const avatarData = getChatAvatar(state.activeChatId, chat);
  applyAvatar(dom.chatHeaderAvatar, avatarData.seed, avatarData.label);

  // Правом на запись управляет role-логика: каналы — только админы.
  const canPost = Chat.canPostToChat(chat, state.user?.uid);
  dom.messageInput.disabled = !canPost;
  dom.sendBtn.disabled = !canPost;
  dom.messageInput.placeholder = canPost ? 'Написать сообщение…' : 'Просмотр';
  dom.channelLocked.classList.toggle('hidden', !(chat?.type === 'channel' && !canPost));

  // «Отписаться» — для каналов, где я подписчик, но не админ.
  const isChannel = chat?.type === 'channel';
  const isAdmin = Boolean(chat?.admins?.[state.user?.uid]);
  const showUnsubscribe = isChannel && !isAdmin && state.myChatIds.has(state.activeChatId);
  dom.unsubscribeBtn.classList.toggle('hidden', !showUnsubscribe);

  renderMessages();
}

/** Отрисовать предпросмотр канала. */
function renderChannelPreview() {
  const { chatId, chat } = state.channelPreview;
  const subscribed = state.myChatIds.has(chatId);

  dom.channelPreview.classList.remove('hidden');
  dom.chatView.classList.add('hidden');
  dom.chatPanelEmpty.classList.add('hidden');

  applyAvatar(dom.previewAvatar, chatId, (chat?.title || 'К').trim().charAt(0).toUpperCase());
  dom.previewTitle.textContent = chat?.title || 'Загрузка…';

  if (chat) {
    const count = Number(chat.subscribersCount) || 0;
    const handle = chat.username ? `@${chat.username} · ` : '';
    dom.previewMeta.textContent = `${handle}${count} ${plural(count, ['подписчик', 'подписчика', 'подписчиков'])}`;
  } else {
    dom.previewMeta.textContent = '';
  }

  dom.previewDescription.textContent = chat?.description || '';
  dom.previewDescription.classList.toggle('hidden', !chat?.description);

  dom.previewSubscribe.textContent = subscribed ? 'Открыть канал' : 'Подписаться';
  dom.previewSubscribe.disabled = false;
}

/** Перерисовать область сообщений активного чата. */
function renderMessages() {
  const chat = state.chats.get(state.activeChatId) || null;
  const showSender = Boolean(chat) && (chat.type === 'group' || chat.type === 'channel');
  const container = dom.messages;
  const wasStick = state.stickToBottom;
  const prevScrollTop = container.scrollTop;

  container.innerHTML = '';

  if (!state.messages.length) {
    container.append(createEl('p', 'messages-empty', 'В этом чате пока нет сообщений'));
    return;
  }

  let lastDay = null;
  const senderUids = [];

  for (const message of state.messages) {
    const dayKey = new Date(message.timestamp * 1000).toDateString();
    if (dayKey !== lastDay) {
      container.append(createEl('div', 'message-day', formatDayLabel(message.timestamp)));
      lastDay = dayKey;
    }
    container.append(buildMessageElement(message, showSender));
    senderUids.push(message.sender);
  }

  // Автопрокрутка вниз при новых сообщениях, если пользователь у нижнего края.
  if (wasStick) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  } else {
    // Пользователь читает историю — сохраняем позицию скролла.
    container.scrollTop = prevScrollTop;
  }

  hydrateUsers(senderUids);
}

/** Собрать DOM одного сообщения. */
function buildMessageElement(message, showSender) {
  const own = message.sender === state.user?.uid;
  const wrap = createEl('div', `message ${own ? 'own' : 'other'}`);

  if (showSender) {
    wrap.append(createEl('div', 'message-sender', own ? 'Вы' : getSenderName(message.sender)));
  }

  const bubble = createEl('div', 'bubble');
  bubble.append(createEl('span', 'bubble-text', message.text || ''));
  bubble.append(createEl('span', 'bubble-time', formatTime(message.timestamp)));
  wrap.append(bubble);

  return wrap;
}

/* ============================================================
 *  Подписки RTDB
 * ============================================================ */

/** Подписка на /user_chats/$uid и diff-подписки на каждый /chats/$chat_id. */
function handleUserChatsUpdate(chatIds) {
  state.myChatIds = new Set(chatIds);

  // Отписываемся от чатов, которых больше нет у пользователя.
  for (const [chatId, unsubscribe] of state.subscriptions.chatMeta) {
    if (!chatIds.includes(chatId)) {
      unsubscribe();
      state.subscriptions.chatMeta.delete(chatId);
      state.chats.delete(chatId);
      if (state.activeChatId === chatId) closeActiveChat();
    }
  }

  // Подписываемся на новые чаты.
  for (const chatId of chatIds) {
    if (state.subscriptions.chatMeta.has(chatId)) continue;

    state.subscriptions.chatMeta.set(
      chatId,
      Chat.subscribeToChat(chatId, (chat) => {
        if (chat) state.chats.set(chatId, chat);
        else state.chats.delete(chatId);

        renderChatList();
        if (chatId === state.activeChatId) renderMainPanel();
      }),
    );
  }

  renderChatList();
  if (state.channelPreview) renderMainPanel(); // могли подписаться из другого клиента
}

/** Запустить подписки после входа. */
function startSubscriptions() {
  if (!state.user || state.subscriptions.userChats) return;
  state.subscriptions.userChats = Chat.subscribeToUserChats(
    state.user.uid,
    handleUserChatsUpdate,
    () => toast('Не удалось загрузить список чатов', 'error'),
  );
}

/** Снять все подписки и очистить состояние (при выходе). */
function teardownSubscriptions() {
  state.subscriptions.userChats?.();
  state.subscriptions.messages?.();
  for (const unsubscribe of state.subscriptions.chatMeta.values()) unsubscribe();

  state.subscriptions.userChats = null;
  state.subscriptions.messages = null;
  state.subscriptions.chatMeta.clear();
  state.chats.clear();
  state.myChatIds = new Set();
  state.activeChatId = null;
  state.messages = [];
  state.stickToBottom = true;
  state.channelPreview = null;

  exitSearchMode();
  dom.chatList.innerHTML = '';
  dom.chatListEmpty.classList.add('hidden');
  renderMainPanel();
}

/* ============================================================
 *  Экраны: авторизация / онбординг / мессенджер
 * ============================================================ */

function showAuthScreen() {
  dom.messengerScreen.classList.add('hidden');
  dom.onboardingScreen.classList.add('hidden');
  dom.authScreen.classList.remove('hidden');
  document.body.classList.remove('chat-open');
  dom.authPassword.value = '';
  hideAuthError();
}

/** Экран первого заполнения профиля после входа. */
function showOnboardingScreen() {
  dom.authScreen.classList.add('hidden');
  dom.messengerScreen.classList.add('hidden');
  dom.onboardingScreen.classList.remove('hidden');
  document.body.classList.remove('chat-open');

  dom.onboardingEmail.textContent = state.user?.email || '';
  dom.obUsername.value = state.profile?.username || '';
  dom.obFirstname.value = state.profile?.firstName || '';
  dom.obLastname.value = state.profile?.lastName || '';
  dom.obBio.value = state.profile?.bio || '';
  dom.onboardingError.classList.add('hidden');
  setTimeout(() => dom.obUsername.focus(), 0);
}

/** Показать мессенджер (профиль заполнен). */
function enterMessenger() {
  dom.authScreen.classList.add('hidden');
  dom.onboardingScreen.classList.add('hidden');
  dom.messengerScreen.classList.remove('hidden');
  updateSidebarUser();
  renderChatList();
  startSubscriptions();
}

function showAuthError(message) {
  dom.authError.textContent = message;
  dom.authError.classList.remove('hidden');
}

function hideAuthError() {
  dom.authError.classList.add('hidden');
}

/** Переключение «Вход <-> Регистрация». */
function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === 'register';

  dom.authSubmit.textContent = isRegister ? 'Зарегистрироваться' : 'Войти';
  dom.authToggleMode.textContent = isRegister
    ? 'Уже есть аккаунт? Войти'
    : 'Нет аккаунта? Зарегистрироваться';
  dom.authPassword.autocomplete = isRegister ? 'new-password' : 'current-password';

  hideAuthError();
}

function setAuthLoading(loading) {
  dom.authSubmit.disabled = loading;
  dom.googleBtn.disabled = loading;
  dom.authSubmit.textContent = loading
    ? 'Подождите…'
    : authMode === 'register' ? 'Зарегистрироваться' : 'Войти';
}

/* ============================================================
 *  Профиль: сохранение (онбординг и модальное окно)
 * ============================================================ */

/**
 * Общий обработчик форм профиля (онбординг / модалка).
 * Показывает ошибки, блокирует кнопку, обновляет state.profile.
 */
async function saveProfileForm({ usernameEl, firstNameEl, lastNameEl, bioEl, errorEl, submitEl, onSuccess }) {
  errorEl.classList.add('hidden');
  const originalText = submitEl.textContent;
  submitEl.disabled = true;
  submitEl.textContent = 'Сохраняем…';

  try {
    const updated = await Chat.updateUserProfile(
      state.user.uid,
      {
        username: usernameEl.value,
        firstName: firstNameEl.value,
        lastName: lastNameEl.value,
        bio: bioEl.value,
      },
      state.profile?.username || null,
    );
    state.profile = updated;
    errorEl.classList.add('hidden');
    onSuccess(updated);
  } catch (error) {
    console.error(error);
    errorEl.textContent = error.message || 'Не удалось сохранить профиль';
    errorEl.classList.remove('hidden');
  } finally {
    submitEl.disabled = false;
    submitEl.textContent = originalText;
  }
}

function openProfileModal() {
  dom.profileOverlay.classList.remove('hidden');
  dom.pfUsername.value = state.profile?.username || '';
  dom.pfFirstname.value = state.profile?.firstName || '';
  dom.pfLastname.value = state.profile?.lastName || '';
  dom.pfBio.value = state.profile?.bio || '';
  dom.profileError.classList.add('hidden');
  dom.pfUsername.focus();
}

function closeProfileModal() {
  dom.profileOverlay.classList.add('hidden');
}

/* ============================================================
 *  Модальное окно «Новый чат»
 * ============================================================ */

function openModal() {
  dom.modalOverlay.classList.remove('hidden');
  setModalTab('private');
  hideModalError();
  dom.privateUsername.focus();
}

function closeModal() {
  dom.modalOverlay.classList.add('hidden');
}

function setModalTab(tab) {
  modalTab = tab;
  dom.modalTabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  dom.modalPanes.forEach((pane) => pane.classList.toggle('hidden', pane.dataset.pane !== tab));
  hideModalError();
}

function showModalError(message) {
  dom.modalError.textContent = message;
  dom.modalError.classList.remove('hidden');
}

function hideModalError() {
  dom.modalError.classList.add('hidden');
}

function setModalLoading(loading) {
  dom.modalSubmit.disabled = loading;
  dom.modalSubmit.textContent = loading ? 'Создаём…' : 'Создать';
}

/** Разобрать список юзернеймов (через запятую/пробел/перенос строки). */
function parseUsernames(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((part) => Chat.normalizeUsername(part))
    .filter(Boolean);
}

/** Обработка формы «Создать чат» для активной вкладки. */
async function handleCreateChatSubmit(event) {
  event.preventDefault();
  hideModalError();
  setModalLoading(true);

  try {
    const myUid = state.user?.uid;
    if (!myUid) throw new Error('Нужно войти в аккаунт');

    if (modalTab === 'private') {
      const username = Chat.normalizeUsername(dom.privateUsername.value);
      if (!Chat.isValidUsername(username)) {
        throw new Error('Укажите юзернейм: 3–32 символа (a–z, 0–9, «_»)');
      }
      const peer = await Chat.getUserByUsername(username);
      if (!peer) throw new Error(`Пользователь @${username} не найден`);
      if (peer.uid === myUid) throw new Error('Нельзя создать чат с самим собой');

      const chatId = await Chat.createPrivateChat(myUid, peer.uid);
      closeModal();
      dom.createChatForm.reset();
      selectChat(chatId);
      toast('Личный чат создан', 'success');
      return;
    }

    if (modalTab === 'group') {
      const title = dom.groupTitle.value.trim();
      if (!title) throw new Error('Укажите название группы');

      const usernames = parseUsernames(dom.groupMembers.value);
      const members = new Set();
      const notFound = [];

      for (const username of usernames) {
        if (!Chat.isValidUsername(username)) {
          throw new Error(`Некорректный юзернейм: «${username}»`);
        }
        const user = await Chat.getUserByUsername(username);
        if (!user) notFound.push('@' + username);
        else if (user.uid !== myUid) members.add(user.uid);
      }
      if (notFound.length) throw new Error(`Не найдены: ${notFound.join(', ')}`);

      const chatId = await Chat.createGroupChat(myUid, title, [...members]);
      closeModal();
      dom.createChatForm.reset();
      selectChat(chatId);
      toast('Группа создана', 'success');
      return;
    }

    // Канал: обязательны юзернейм (по нему находят и подписываются) и название.
    const username = Chat.normalizeUsername(dom.channelUsername.value);
    const title = dom.channelTitle.value.trim();
    if (!Chat.isValidUsername(username)) {
      throw new Error('Юзернейм канала: 3–32 символа (a–z, 0–9, «_»)');
    }
    if (!title) throw new Error('Укажите название канала');

    const chatId = await Chat.createChannel(myUid, {
      username,
      title,
      description: dom.channelDescription.value,
    });
    closeModal();
    dom.createChatForm.reset();
    selectChat(chatId);
    toast(`Канал @${username} создан`, 'success');
  } catch (error) {
    console.error(error);
    showModalError(error.message || 'Не удалось создать чат');
  } finally {
    setModalLoading(false);
  }
}

/* ============================================================
 *  Уведомления
 * ============================================================ */

let toastTimer = null;

/** Показать всплывающее уведомление. type: 'info' | 'error' | 'success'. */
function toast(message, type = 'info') {
  dom.toast.textContent = message;
  dom.toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.add('hidden'), 3500);
}

/* ============================================================
 *  Отправка сообщений
 * ============================================================ */

async function handleSendMessage(event) {
  event.preventDefault();
  if (!state.activeChatId || !state.user) return;

  const text = dom.messageInput.value;
  if (!text.trim()) return;

  const chat = state.chats.get(state.activeChatId);
  if (!Chat.canPostToChat(chat, state.user.uid)) return;

  // Оптимистично очищаем поле; при ошибке вернём текст обратно.
  dom.messageInput.value = '';
  state.stickToBottom = true;

  try {
    await Chat.sendMessage(state.activeChatId, state.user.uid, text);
  } catch (error) {
    console.error(error);
    toast('Не удалось отправить сообщение', 'error');
    dom.messageInput.value = text;
  }

  dom.messageInput.focus();
}

/* ============================================================
 *  Инициализация: обработчики UI и подписка на Auth
 * ============================================================ */

// --- Экран авторизации ---
dom.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAuthError();
  setAuthLoading(true);

  const email = dom.authEmail.value;
  const password = dom.authPassword.value;

  try {
    if (authMode === 'register') await Auth.registerWithEmail(email, password);
    else await Auth.loginWithEmail(email, password);
  } catch (error) {
    showAuthError(Auth.getAuthErrorMessage(error));
  } finally {
    setAuthLoading(false);
  }
});

dom.authToggleMode.addEventListener('click', () => {
  setAuthMode(authMode === 'login' ? 'register' : 'login');
});

dom.googleBtn.addEventListener('click', async () => {
  hideAuthError();
  setAuthLoading(true);
  try {
    await Auth.loginWithGoogle();
  } catch (error) {
    showAuthError(Auth.getAuthErrorMessage(error));
  } finally {
    setAuthLoading(false);
  }
});

// --- Юзернеймы: «@Test» и «test» — одно и то же ---
/** Приводить юзернейм к канону прямо при вводе: без «@», в нижнем регистре. */
function bindUsernameInput(input) {
  input.addEventListener('input', () => {
    const clean = Chat.normalizeUsername(input.value);
    if (clean !== input.value) input.value = clean;
  });
}
[dom.obUsername, dom.pfUsername, dom.privateUsername, dom.channelUsername].forEach(bindUsernameInput);

// --- Онбординг ---
dom.onboardingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveProfileForm({
    usernameEl: dom.obUsername,
    firstNameEl: dom.obFirstname,
    lastNameEl: dom.obLastname,
    bioEl: dom.obBio,
    errorEl: dom.onboardingError,
    submitEl: dom.onboardingSubmit,
    onSuccess: () => {
      enterMessenger();
      toast(`Добро пожаловать в Beacon, ${state.profile?.firstName || ''}!`.trim(), 'success');
    },
  });
});

dom.onboardingLogout.addEventListener('click', () => {
  Auth.logout().catch((error) => {
    console.error(error);
    toast('Не удалось выйти из аккаунта', 'error');
  });
});

// --- Боковая панель ---
dom.logoutBtn.addEventListener('click', () => {
  Auth.logout().catch((error) => {
    console.error(error);
    toast('Не удалось выйти из аккаунта', 'error');
  });
});

dom.newChatBtn.addEventListener('click', openModal);
dom.profileBtn.addEventListener('click', openProfileModal);

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

// --- Модальное окно «Новый чат» ---
dom.modalClose.addEventListener('click', closeModal);
dom.modalCancel.addEventListener('click', closeModal);
dom.modalOverlay.addEventListener('click', (event) => {
  if (event.target === dom.modalOverlay) closeModal();
});
dom.modalTabs.forEach((btn) => {
  btn.addEventListener('click', () => setModalTab(btn.dataset.tab));
});
dom.createChatForm.addEventListener('submit', handleCreateChatSubmit);

// --- Модальное окно «Профиль» ---
dom.profileClose.addEventListener('click', closeProfileModal);
dom.profileCancel.addEventListener('click', closeProfileModal);
dom.profileOverlay.addEventListener('click', (event) => {
  if (event.target === dom.profileOverlay) closeProfileModal();
});
dom.profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveProfileForm({
    usernameEl: dom.pfUsername,
    firstNameEl: dom.pfFirstname,
    lastNameEl: dom.pfLastname,
    bioEl: dom.pfBio,
    errorEl: dom.profileError,
    submitEl: dom.profileSubmit,
    onSuccess: () => {
      closeProfileModal();
      updateSidebarUser();
      renderChatList();
      toast('Профиль сохранён', 'success');
    },
  });
});

// --- Escape закрывает верхнюю открытую модалку ---
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!dom.profileOverlay.classList.contains('hidden')) {
    closeProfileModal();
    return;
  }
  if (!dom.modalOverlay.classList.contains('hidden')) closeModal();
});

// --- Панель чата ---
dom.messageForm.addEventListener('submit', handleSendMessage);
dom.backBtn.addEventListener('click', () => document.body.classList.remove('chat-open'));
dom.previewBackBtn.addEventListener('click', closeChannelPreview);
dom.messages.addEventListener('scroll', () => {
  const el = dom.messages;
  state.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
});

// Подписка/вход в канал из предпросмотра.
dom.previewSubscribe.addEventListener('click', async () => {
  const preview = state.channelPreview;
  if (!preview) return;
  const { chatId } = preview;

  if (state.myChatIds.has(chatId)) {
    closeChannelPreview();
    selectChat(chatId);
    return;
  }

  dom.previewSubscribe.disabled = true;
  try {
    await Chat.subscribeToChannel(state.user.uid, chatId);
    toast('Вы подписались на канал', 'success');
    closeChannelPreview();
    selectChat(chatId);
  } catch (error) {
    console.error(error);
    toast('Не удалось подписаться на канал', 'error');
    dom.previewSubscribe.disabled = false;
  }
});

// Отписка от канала (для подписчиков-неадминов).
dom.unsubscribeBtn.addEventListener('click', async () => {
  const chat = state.chats.get(state.activeChatId);
  if (!chat || chat.type !== 'channel') return;

  if (!window.confirm(`Отписаться от канала «${getChatTitle(chat)}»?`)) return;

  try {
    await Chat.unsubscribeFromChannel(state.user.uid, state.activeChatId);
    toast('Вы отписались от канала');
  } catch (error) {
    console.error(error);
    toast('Не удалось отписаться от канала', 'error');
  }
});

// --- Роутинг по состоянию авторизации ---
Auth.watchAuthState(async (user) => {
  if (!user) {
    state.user = null;
    state.profile = null;
    teardownSubscriptions();
    showAuthScreen();
    return;
  }

  state.user = user;

  // Базовый узел /users/$uid + актуальный профиль.
  try {
    await Auth.ensureUserRecord(user);
    state.profile = await Chat.getUserProfile(user.uid, { force: true });
  } catch (error) {
    console.error('Не удалось загрузить профиль пользователя:', error);
  }

  if (state.user !== user) return; // пользователь успел выйти, пока грузили

  // Профиль ещё не заполнен — показываем онбординг.
  if (!Chat.isProfileComplete(state.profile)) showOnboardingScreen();
  else enterMessenger();
});
