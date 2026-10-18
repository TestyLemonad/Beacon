/**
 * Beacon — точка входа SPA.
 *
 * Связывает сервисы Firebase (services/*) с DOM:
 *  - роутинг экранов: авторизация -> онбординг (юзернейм/имя/фамилия/био) -> мессенджер;
 *  - состояние приложения (профиль, чаты, активный чат, поиск, предпросмотр канала);
 *  - подписки RTDB и их очистка;
 *  - обработчики UI: список чатов, поиск по юзернеймам, сообщения,
 *    модальные окна «Новый чат» и «Профиль»;
 *  - меню сообщения (ПКМ / долгое нажатие): реакции, ответ, правка, пересылка,
 *    закреп, копирование и удаление (у себя или у всех).
 */
import * as Auth from './services/auth.js?v=8';
import * as Chat from './services/chat.js?v=8';

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
  settingsBtn: $('settings-btn'),
  searchInput: $('search-input'),
  searchClear: $('search-clear'),
  foldersBar: $('folders-bar'),
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

  // Панель чата: всплывающее меню чата и плашка блокировки
  chatMenuBtn: $('chat-menu-btn'),
  chatMenuOverlay: $('chat-menu-overlay'),
  chatMenuClose: $('chat-menu-close'),
  chatMenuAvatar: $('chat-menu-avatar'),
  chatMenuTitle: $('chat-menu-title'),
  chatMenuType: $('chat-menu-type'),
  chatMenuDescription: $('chat-menu-description'),
  chatMenuUsername: $('chat-menu-username'),
  chatMenuPresence: $('chat-menu-presence'),
  chatMenuActions: $('chat-menu-actions'),
  chatMenuMembersBlock: $('chat-menu-members-block'),
  chatMenuMembersTitle: $('chat-menu-members-title'),
  chatMenuMembers: $('chat-menu-members'),
  privateBlocked: $('private-blocked'),
  privateUnblockBtn: $('private-unblock-btn'),
  previewHeading: $('preview-heading'),

  // Сообщения: закреп, ответ/правка, меню сообщения, удаление, пересылка
  pinBar: $('pin-bar'),
  pinBarTitle: $('pin-bar-title'),
  pinBarText: $('pin-bar-text'),
  pinBarCount: $('pin-bar-count'),
  composerContext: $('composer-context'),
  composerContextTitle: $('composer-context-title'),
  composerContextText: $('composer-context-text'),
  composerContextCancel: $('composer-context-cancel'),
  msgMenuOverlay: $('msg-menu-overlay'),
  msgMenu: $('msg-menu'),
  msgMenuReactions: $('msg-menu-reactions'),
  msgMenuMore: $('msg-menu-more'),
  msgMenuAll: $('msg-menu-all'),
  msgMenuActions: $('msg-menu-actions'),
  deleteChoiceOverlay: $('delete-choice-overlay'),
  deleteChoiceClose: $('delete-choice-close'),
  deleteChoiceAll: $('delete-choice-all'),
  deleteChoiceLocal: $('delete-choice-local'),
  forwardOverlay: $('forward-overlay'),
  forwardClose: $('forward-close'),
  forwardList: $('forward-list'),
  forwardEmpty: $('forward-empty'),

  // Меню чата в списке (ПКМ): закрепить / архив / папки
  chatCtxOverlay: $('chat-ctx-overlay'),
  chatCtxMenu: $('chat-ctx-menu'),
  chatCtxActions: $('chat-ctx-actions'),
  chatCtxFolders: $('chat-ctx-folders'),

  // Настройки пользователя (по клику на логотип)
  prefsOverlay: $('prefs-overlay'),
  prefsClose: $('prefs-close'),
  prefsThemeToggle: $('prefs-theme-toggle'),
  prefsPrivacyToggle: $('prefs-privacy-toggle'),
  prefsArchiveBtn: $('prefs-archive-btn'),
  prefsArchiveCount: $('prefs-archive-count'),

  // Архив чатов
  archiveOverlay: $('archive-overlay'),
  archiveClose: $('archive-close'),
  archiveList: $('archive-list'),
  archiveEmpty: $('archive-empty'),

  // Создание опроса
  pollBtn: $('poll-btn'),
  pollOverlay: $('poll-overlay'),
  pollClose: $('poll-close'),
  pollForm: $('poll-form'),
  pollQuestion: $('poll-question'),
  pollOptions: $('poll-options'),
  pollAddOption: $('poll-add-option'),
  pollMultiple: $('poll-multiple'),
  pollError: $('poll-error'),
  pollCancel: $('poll-cancel'),
  pollSubmit: $('poll-submit'),

  // Комментарии к посту канала
  commentsOverlay: $('comments-overlay'),
  commentsClose: $('comments-close'),
  commentsPost: $('comments-post'),
  commentsList: $('comments-list'),
  commentsEmpty: $('comments-empty'),
  commentsForm: $('comments-form'),
  commentsInput: $('comments-input'),

  // Статистика канала (только админы)
  statsOverlay: $('stats-overlay'),
  statsClose: $('stats-close'),
  statsHeading: $('stats-heading'),
  statsCards: $('stats-cards'),
  statsChart: $('stats-chart'),
  statsTop: $('stats-top'),

  // Создание группы: тип, юзернейм, описание
  groupDescription: $('group-description'),
  groupTypeBtns: Array.from(document.querySelectorAll('[data-group-type]')),
  groupUsernameField: $('group-username-field'),
  groupUsername: $('group-username'),
  groupMembersField: $('group-members-field'),

  // Профиль: аватарка и чёрный список
  avatarPreview: $('avatar-preview'),
  avatarValue: $('avatar-value'),
  avatarKindBtns: Array.from(document.querySelectorAll('[data-avatar-kind]')),
  avatarBgBtns: Array.from(document.querySelectorAll('[data-avatar-bg]')),
  avatarPalette1: $('avatar-palette-1'),
  avatarPalette2: $('avatar-palette-2'),
  avatarHex1: $('avatar-hex-1'),
  avatarHex2: $('avatar-hex-2'),
  avatarColorRow2: $('avatar-color-row-2'),
  avatarSizeMinus: $('avatar-size-minus'),
  avatarSizePlus: $('avatar-size-plus'),
  avatarSizeValue: $('avatar-size-value'),
  profileBlockedBtn: $('profile-blocked-btn'),

  // Чёрный список
  blockedOverlay: $('blocked-overlay'),
  blockedClose: $('blocked-close'),
  blockedList: $('blocked-list'),
  blockedEmpty: $('blocked-empty'),

  // Настройки группы/канала
  settingsOverlay: $('settings-overlay'),
  settingsForm: $('settings-form'),
  settingsHeading: $('settings-heading'),
  settingsClose: $('settings-close'),
  settingsCancel: $('settings-cancel'),
  settingsSubmit: $('settings-submit'),
  settingsDelete: $('settings-delete'),
  settingsError: $('settings-error'),
  settingsTitle: $('settings-title'),
  settingsDescription: $('settings-description'),
  settingsGroupBlock: $('settings-group-block'),
  settingsTypeBtns: Array.from(document.querySelectorAll('[data-settings-type]')),
  settingsUsernameField: $('settings-username-field'),
  settingsUsername: $('settings-username'),

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
  search: { query: '', loading: false, users: [], groups: [], channels: [], localChats: [], messages: [] },
  searchFilters: { chatId: '', author: '', period: 'all' }, // фильтры поиска по сообщениям
  blocked: new Set(),       // uid пользователей в моём чёрном списке
  localDeleted: new Set(),  // «chatId/msgId» сообщений, удалённых только у меня
  composerMode: null,       // { type: 'edit'|'reply', message } — плашка над полем ввода
  msgMenuMessage: null,     // сообщение, открытое в контекстном меню
  msgMenuPos: null,         // { x, y } — точка открытия меню
  msgMenuExpanded: false,   // раскрыт ли полный набор реакций
  pendingDeleteMessage: null, // сообщение, ждущее выбора «у всех / только у меня»
  forwardMessage: null,     // сообщение, которое пересылаем
  pinIndex: 0,              // какой по счёту закреп показан в плашке

  // Личные настройки списка чатов: архив, закреп, папки
  chatMeta: new Map(),      // chatId -> { archived?, pinnedAt?, folders? }
  folders: new Map(),       // folderId -> { name, createdAt }
  activeFolder: 'all',      // 'all' или id папки — фильтр списка чатов
  chatCtxChatId: null,      // чат, открытый в меню ПКМ

  // Прочтения, присутствие и «печатает…»
  reads: new Map(),         // chatId -> мой последний прочитанный ts
  peerReadTs: 0,            // прочитано собеседником (активный личный чат)
  presence: new Map(),      // uid -> { online, lastSeen }
  peerSettings: {},         // настройки собеседника (приватность визита)
  typingMap: new Map(),     // uid -> { name, ts } в активном чате
  settings: { lastSeenPrivacy: 'all' }, // мои настройки

  // Опросы, комментарии, просмотры (активный чат)
  pollVotes: new Map(),     // msgId -> { uid: { optionId: true } }
  chatComments: new Map(),  // postId -> { commentId: { sender, text, timestamp } }
  chatViews: new Map(),     // msgId -> { uid: ts }
  viewedMessages: new Set(),// «chatId/msgId», по которым я уже учёл просмотр
  commentsPost: null,       // { chatId, msgId, message } — открытые комментарии

  // Кэш сообщений для полнотекстового поиска: chatId -> { ts, messages }
  msgCache: new Map(),

  subscriptions: {
    userChats: null,
    messages: null,
    messageDeletes: null,   // подписка /user_message_deletes/$uid
    chatMeta: new Map(),    // chatId -> unsubscribe для /chats/$chat_id
    userMeta: null,         // /user_chat_meta/$uid
    userFolders: null,      // /user_folders/$uid
    userReads: null,        // /user_reads/$uid
    userSettings: null,     // /user_settings/$uid
    presence: null,         // .info/connected
    chatScoped: [],         // подписки активного чата (typing, голоса, комментарии…)
    chatScopedId: null,     // id чата, для которого настроены подписки chatScoped
  },
};

let authMode = 'login';     // 'login' | 'register'
let modalTab = 'private';   // активная вкладка модального окна
let searchSeq = 0;          // защита от гонок при поиске
let searchTimer = null;
let groupTypeChoice = 'private';    // тип новой группы: 'private' | 'public'
let settingsTypeChoice = 'private'; // тип группы в окне настроек
let settingsChatId = null;          // чат, открытый в окне настроек
let typingTimer = null;             // таймер «печатает…» (сброс после паузы)
let typingLastSent = 0;             // когда последний раз писали «печатает…» (unix-секунды)
let typingTick = null;              // интервал пересчёта строки «печатает…»
let messagesObserver = null;        // IntersectionObserver просмотров постов

/* ============================================================
 *  Утилиты
 * ============================================================ */

/** Палитра аватарок-заглушек. */
const AVATAR_COLORS = ['#f0a24a', '#e06c75', '#61afef', '#98c379', '#c678dd', '#56b6c2', '#d19a66', '#8f9ff5'];

/** Шесть быстрых реакций в меню сообщения. */
const REACTIONS_TOP = ['👍', '❤️', '🔥', '😂', '😮', '😢'];

/** Полный набор реакций (раскрывается стрелочкой). */
const REACTIONS_ALL = [
  ...REACTIONS_TOP,
  '🎉', '🥰', '👎', '😡', '🤔', '💯', '🙏', '👀', '⚡', '🌊', '⚓', '💡',
];

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

/** unix-секунды -> «был(а) в сети недавно / ЧЧ:ММ / вчера / дата». */
function formatLastSeen(unixSecondsOrMs) {
  let value = Number(unixSecondsOrMs) || 0;
  if (!value) return 'недавно';
  if (value > 1e12) value = Math.floor(value / 1000); // серверное время приходит в мс
  const date = new Date(value * 1000);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  if (diffMin < 2) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const today = date.toDateString() === now.toDateString();
  if (today) return `сегодня в ${formatTime(value)}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `вчера в ${formatTime(value)}`;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Сенсорный ли ввод (мобильные): Enter в поле ввода переносит строку. */
function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/** Склонение: plural(3, ['участник', 'участника', 'участников']). */
function plural(count, forms) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** Склонение: plural(3, ['просмотр', 'просмотра', 'просмотров']). */
function pluralViews(count) {
  return plural(count, ['просмотр', 'просмотра', 'просмотров']);
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

/**
 * Аватарка профиля: кастомная (буква/эмодзи на цвете или градиенте)
 * либо стандартные инициалы на сгенерированном цвете.
 */
function applyProfileAvatar(node, profile, seed, fallbackLabel = undefined) {
  const avatar = profile?.avatar;
  if (avatar && avatar.value && avatar.bg1) {
    node.style.background = avatar.bgType === 'gradient'
      ? `linear-gradient(135deg, ${avatar.bg1}, ${avatar.bg2 || avatar.bg1})`
      : avatar.bg1;

    // Глиф в отдельном span: размер задаётся в em от базового кегля аватара.
    const glyph = createEl('span', 'avatar-glyph');
    if (avatar.kind === 'emoji') glyph.classList.add('avatar-emoji');
    const scale = Math.min(200, Math.max(50, Number(avatar.size) || 100)) / 100;
    glyph.style.fontSize = `${(avatar.kind === 'emoji' ? 1.4 : 1) * scale}em`;
    glyph.textContent = avatar.value;

    node.textContent = '';
    node.classList.remove('avatar-emoji');
    node.append(glyph);
    return;
  }
  node.classList.remove('avatar-emoji');
  applyAvatar(node, seed, fallbackLabel === undefined ? getProfileInitials(profile) : fallbackLabel);
}

/** Аватарка чата: личный — профиль собеседника, группа/канал — буква названия. */
function applyChatAvatar(node, chatId, chat) {
  if (chat?.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    const profile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
    applyProfileAvatar(node, profile, peerUid || chatId);
    return;
  }
  node.classList.remove('avatar-emoji');
  applyAvatar(node, chatId, (chat?.title || '?').trim().charAt(0).toUpperCase());
}

/** SVG-иконки типов чата. */
const CHAT_TYPE_ICONS = {
  private:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  group:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  channel:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  saved:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
};

/** Для личного чата — uid собеседника (все uid, кроме моего). */
function getPrivatePeerUid(chat) {
  if (!chat || chat.type !== 'private') return null;
  return Object.keys(chat.users || {}).find((uid) => uid !== state.user?.uid) || null;
}

/** Заголовок чата: для private — имя собеседника из /users. */
function getChatTitle(chat) {
  if (!chat) return 'Загрузка…';
  if (chat.type === 'saved') return 'Избранное';
  if (chat.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    const profile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
    return getProfileName(profile) || 'Личный чат';
  }
  return chat.title || 'Без названия';
}

/** Живые отметки «печатает…» (не старше TTL), кроме моей. */
function activeTypers() {
  const now = Date.now() / 1000;
  return [...state.typingMap.entries()]
    .filter(([uid, info]) => uid !== state.user?.uid && info && (now - Number(info.ts || 0)) < 7)
    .map(([uid, info]) => ({ uid, name: info.name || getSenderName(uid) }));
}

/**
 * Присутствие собеседника для шапки и меню личного чата.
 * @returns {{ text: string, className: string }|null}
 */
function getPeerPresenceInfo(chat) {
  const peerUid = chat?.type === 'private' ? getPrivatePeerUid(chat) : null;
  if (!peerUid) return null;

  const profile = Chat.getCachedUserProfile(peerUid);
  const handle = profile?.username ? '@' + profile.username : 'Личный чат';

  if (activeTypers().some((typer) => typer.uid === peerUid)) {
    return { text: 'печатает…', className: 'status-typing' };
  }

  const presence = state.presence.get(peerUid) || null;
  if (presence?.online) return { text: 'в сети', className: 'status-online' };
  if ((state.peerSettings?.lastSeenPrivacy || 'all') === 'nobody') {
    return { text: handle, className: '' };
  }
  if (presence?.lastSeen) {
    return { text: 'был(а) ' + formatLastSeen(presence.lastSeen), className: '' };
  }
  return { text: handle, className: '' };
}

/** Статус в шапке чата: тип + @юзернейм / участники / «печатает…» / «в сети». */
function getChatStatus(chat) {
  if (!chat) return '';
  if (chat.type === 'channel') {
    const count = Number(chat.subscribersCount) || 0;
    const handle = chat.username ? `@${chat.username} · ` : '';
    return `Канал · ${handle}${count} ${plural(count, ['подписчик', 'подписчика', 'подписчиков'])}`;
  }
  if (chat.type === 'group') {
    const typers = activeTypers();
    if (typers.length === 1) return `${typers[0].name} печатает…`;
    if (typers.length > 1) return `Печатают: ${typers.length}`;
    const count = Object.keys(chat.users || {}).length;
    return `Группа · ${count} ${plural(count, ['участник', 'участника', 'участников'])}`;
  }
  if (chat.type === 'saved') return 'Заметки и закладки';

  const info = getPeerPresenceInfo(chat);
  return info ? info.text : 'Личный чат';
}

/** Текст превью последнего сообщения для списка чатов. */
function getChatPreview(chat) {
  const last = chat?.lastMessage;
  if (!last || !last.text) return 'Нет сообщений';
  if (chat.type === 'private' || chat.type === 'saved') return last.text;
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
  applyProfileAvatar(dom.sidebarAvatar, state.profile, state.user?.uid || 'me');
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

/** Личные настройки чата (архив/закреп/папки) — или пустой объект. */
function getChatMeta(chatId) {
  return state.chatMeta.get(chatId) || {};
}

/** Есть ли в чате непрочитанные: последнее сообщение новее моего прочтения. */
function isChatUnread(chatId, chat) {
  const last = chat?.lastMessage;
  if (!last?.timestamp || last.sender === state.user?.uid) return false;
  if (chatId === state.activeChatId && state.stickToBottom) return false;
  const mineRead = Number(state.reads.get(chatId)) || 0;
  return last.timestamp > mineRead;
}

/** Чаты: закреплённые сверху (по времени закрепа), затем по свежести. */
function sortedChats() {
  const time = (chat) => chat?.lastMessage?.timestamp || chat?.createdAt || 0;
  return [...state.chats.entries()].sort((a, b) => {
    const pinA = Number(getChatMeta(a[0]).pinnedAt) || 0;
    const pinB = Number(getChatMeta(b[0]).pinnedAt) || 0;
    if (pinA && pinB) return pinB - pinA;
    if (pinA) return -1;
    if (pinB) return 1;
    return time(b[1]) - time(a[1]);
  });
}

/** Чаты основного списка: без архива, с учётом активной папки. */
function visibleChats() {
  return sortedChats().filter(([chatId]) => {
    const meta = getChatMeta(chatId);
    if (meta.archived) return false;
    if (state.activeFolder === 'all') return true;
    return Boolean(meta.folders?.[state.activeFolder]);
  });
}

/** Элемент списка чатов (используется и в сайдбаре, и в результатах поиска). */
function buildChatListItem(tag, chatId, chat) {
  const pinned = Boolean(getChatMeta(chatId).pinnedAt);
  const unread = isChatUnread(chatId, chat);
  const item = createEl(
    tag,
    `chat-item${chatId === state.activeChatId ? ' active' : ''}${pinned ? ' pinned' : ''}${unread ? ' unread' : ''}`,
  );
  item.dataset.chatId = chatId;
  item.tabIndex = 0; // фокус для клавиатуры и ТВ-пульта

  const avatar = createEl('div', 'avatar');
  applyChatAvatar(avatar, chatId, chat);

  const body = createEl('div', 'chat-item-body');

  const top = createEl('div', 'chat-item-top');
  top.append(createEl('span', 'chat-item-title', getChatTitle(chat)));
  if (pinned) top.append(createEl('span', 'chat-pin', '📌'));
  if (chat.lastMessage?.timestamp) {
    top.append(createEl('span', 'chat-item-time', formatListTime(chat.lastMessage.timestamp)));
  }

  const bottom = createEl('div', 'chat-item-bottom');
  bottom.append(createEl('span', 'chat-item-preview', getChatPreview(chat)));
  if (unread) bottom.append(createEl('span', 'unread-dot', ' '));
  const typeIcon = createEl('span', 'chat-type-icon');
  typeIcon.innerHTML = CHAT_TYPE_ICONS[chat.type] || '';
  bottom.append(typeIcon);

  body.append(top, bottom);
  item.append(avatar, body);
  item.addEventListener('click', () => selectChat(chatId));

  // Меню чата: ПКМ на десктопе, долгое нажатие на тач-экранах.
  item.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    openChatCtxMenu(chatId, event.clientX, event.clientY);
  });

  let longPressTimer = null;
  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };
  item.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      openChatCtxMenu(chatId, touch.clientX, touch.clientY);
    }, 480);
  }, { passive: true });
  item.addEventListener('touchend', cancelLongPress);
  item.addEventListener('touchmove', cancelLongPress, { passive: true });
  item.addEventListener('touchcancel', cancelLongPress);

  return item;
}

/** Отрисовать список диалогов (архив в него не попадает). */
function renderChatList() {
  const chats = visibleChats();
  dom.chatList.innerHTML = '';
  dom.chatListEmpty.classList.toggle('hidden', chats.length > 0);
  dom.chatListEmpty.innerHTML = state.activeFolder !== 'all' && state.myChatIds.size
    ? 'В этой папке пока нет чатов.<br />Добавить чат можно правым кликом по нему в «Все чаты».'
    : 'У вас пока нет чатов.<br />Создайте первый или найдите канал через поиск!';

  const uidsToHydrate = [];

  for (const [chatId, chat] of chats) {
    dom.chatList.append(buildChatListItem('li', chatId, chat));

    if (chat.type === 'private') uidsToHydrate.push(getPrivatePeerUid(chat));
    if (chat.type !== 'saved' && chat.lastMessage?.sender) uidsToHydrate.push(chat.lastMessage.sender);
  }

  renderFoldersBar();
  hydrateUsers(uidsToHydrate);
}

/** Полоса папок под поиском: «Все чаты» + пользовательские папки. */
function renderFoldersBar() {
  dom.foldersBar.innerHTML = '';

  const chips = [{ id: 'all', name: 'Все чаты' }];
  for (const [folderId, folder] of [...state.folders.entries()].sort((a, b) => (
    (Number(a[1]?.createdAt) || 0) - (Number(b[1]?.createdAt) || 0)
  ))) {
    chips.push({ id: folderId, name: folder?.name || 'Папка' });
  }

  for (const chip of chips) {
    const btn = createEl('button', `folder-chip${state.activeFolder === chip.id ? ' active' : ''}`, chip.name);
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.addEventListener('click', () => {
      state.activeFolder = chip.id;
      renderChatList();
    });
    dom.foldersBar.append(btn);
  }
}

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
  return state.search.messages.filter((item) => (
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
  const item = createEl('div', 'chat-item');
  item.tabIndex = 0;
  const avatar = createEl('div', 'avatar');
  applyProfileAvatar(avatar, user, user.uid);

  const body = createEl('div', 'chat-item-body');
  const top = createEl('div', 'chat-item-top');
  top.append(createEl('span', 'chat-item-title', getProfileName(user) || '@' + user.username));
  if (state.blocked.has(user.uid)) top.append(createEl('span', 'search-badge muted', 'в ЧС'));

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
  item.tabIndex = 0;

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

/** Строка результата «публичная группа». */
function buildGroupRow(group) {
  const member = state.myChatIds.has(group.chatId);
  const item = createEl('div', 'chat-item');
  item.tabIndex = 0;

  const avatar = createEl('div', 'avatar');
  applyAvatar(avatar, group.chatId, (group.title || '?').trim().charAt(0).toUpperCase());

  const body = createEl('div', 'chat-item-body');
  const top = createEl('div', 'chat-item-top');
  top.append(createEl('span', 'chat-item-title', group.title || 'Группа'));
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
  top.append(createEl('span', 'chat-item-title', author));
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

  const total = state.search.messages.length;
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
function renderSearchResults() {
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

function exitSearchMode() {
  searchSeq++; // результаты «в полёте» больше не перерисуют панель
  dom.searchInput.value = '';
  dom.searchClear.classList.add('hidden');
  dom.searchResults.classList.add('hidden');
  dom.chatListWrap.classList.remove('hidden');
  state.search = { query: '', loading: false, users: [], groups: [], channels: [], localChats: [] };
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

/** Снять подписки, привязанные к активному чату (typing, голоса, комментарии…). */
function clearChatScoped() {
  for (const unsubscribe of state.subscriptions.chatScoped) unsubscribe();
  state.subscriptions.chatScoped = [];
  state.subscriptions.chatScopedId = null;
  state.subscriptions.messages?.();
  state.subscriptions.messages = null;
  state.typingMap = new Map();
  state.peerReadTs = 0;
  state.pollVotes = new Map();
  state.chatComments = new Map();
  state.chatViews = new Map();
  state.peerSettings = {};
  state.commentsPost = null;
  clearInterval(typingTick);
  typingTick = null;
}

/** Сбросить «печатает…» для чата, из которого уходим. */
function clearOwnTyping() {
  clearTimeout(typingTimer);
  typingTimer = null;
  typingLastSent = 0;
  if (state.activeChatId && state.user) {
    Chat.clearTyping(state.activeChatId, state.user.uid).catch(() => {});
  }
}

/** Голоса опросов / комментарии / просмотры — подписки открытого чата. */
function setupChatScoped(chatId, chat) {
  if (state.subscriptions.chatScopedId === chatId) return;
  state.subscriptions.chatScopedId = chatId;
  const scope = state.subscriptions.chatScoped;

  // «Печатает…» — во всех типах чатов.
  scope.push(Chat.subscribeToTyping(chatId, (map) => {
    state.typingMap = new Map(Object.entries(map || {}));
    updateChatStatus();
  }));

  // Голоса во всех опросах чата.
  scope.push(Chat.subscribeToPollVotes(chatId, (map) => {
    state.pollVotes = new Map(Object.entries(map || {}));
    renderMessages();
  }));

  // Канал: комментарии (счётчики) и просмотры постов.
  if (chat?.type === 'channel') {
    scope.push(Chat.subscribeToChatComments(chatId, (map) => {
      state.chatComments = new Map(Object.entries(map || {}));
      renderMessages();
    }));
    scope.push(Chat.subscribeToChatViews(chatId, (map) => {
      state.chatViews = new Map(Object.entries(map || {}));
      renderMessages();
    }));
  }

  // Личный чат: прочтения собеседника (галочки) и его присутствие.
  if (chat?.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    if (peerUid) {
      scope.push(Chat.subscribeToChatReads(peerUid, chatId, (ts) => {
        state.peerReadTs = ts;
        renderMessages();
      }));
      scope.push(Chat.subscribeToPresence(peerUid, (presence) => {
        if (presence) state.presence.set(peerUid, presence);
        else state.presence.delete(peerUid);
        updateChatStatus();
        if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
      }));
      scope.push(Chat.subscribeToUserSettings(peerUid, (settings) => {
        state.peerSettings = settings || {};
        updateChatStatus();
        if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
      }));
    }
  }

  // Строка «печатает…» гаснет сама, когда запись устаревает.
  clearInterval(typingTick);
  typingTick = setInterval(() => {
    if (!state.activeChatId) return;
    if (state.typingMap.size || activeTypers().length) updateChatStatus();
  }, 2500);
}

/** Отметить активный чат прочитанным до последнего сообщения. */
function markActiveChatRead() {
  if (!state.activeChatId || !state.user) return;
  const chat = state.chats.get(state.activeChatId) || null;
  const lastTs = state.messages.length
    ? state.messages[state.messages.length - 1].timestamp
    : chat?.lastMessage?.timestamp;
  if (!lastTs) return;

  const mine = Number(state.reads.get(state.activeChatId)) || 0;
  if (lastTs <= mine) return;

  state.reads.set(state.activeChatId, lastTs);
  Chat.markChatRead(state.user.uid, state.activeChatId, lastTs).catch(() => {});
}

/** Обновить статус в шапке чата и строку присутствия в меню чата. */
function updateChatStatus() {
  const chat = state.chats.get(state.activeChatId) || null;
  if (!chat) return;

  const info = chat.type === 'private' ? getPeerPresenceInfo(chat) : null;
  dom.chatStatus.textContent = getChatStatus(chat);
  dom.chatStatus.classList.toggle(
    'status-typing',
    Boolean(info && info.className === 'status-typing') || (chat.type === 'group' && activeTypers().length > 0),
  );
  dom.chatStatus.classList.toggle('status-online', Boolean(info && info.className === 'status-online'));

  if (info) {
    dom.chatMenuPresence.textContent = info.text;
    dom.chatMenuPresence.classList.toggle('status-typing', info.className === 'status-typing');
    dom.chatMenuPresence.classList.toggle('status-online', info.className === 'status-online');
    dom.chatMenuPresence.classList.remove('hidden');
  } else {
    dom.chatMenuPresence.classList.add('hidden');
    dom.chatMenuPresence.textContent = '';
  }
}

/** Открыть чат: подписаться на сообщения, отрисовать панель. */
function selectChat(chatId) {
  state.channelPreview = null;
  closeChatMenu();
  closeMsgMenu();
  cancelComposerMode();
  state.pinIndex = 0;

  const chatChanged = state.activeChatId !== chatId;
  if (chatChanged) clearOwnTyping();
  state.activeChatId = chatId;
  document.body.classList.add('chat-open');

  if (chatChanged) {
    clearChatScoped();
    state.messages = [];
    state.stickToBottom = true;

    state.subscriptions.messages = Chat.subscribeToMessages(
      chatId,
      (messages) => {
        state.messages = messages;
        renderMessages();
        // Чат открыт и лента внизу — сразу отмечаем прочитанным.
        if (chatId === state.activeChatId && state.stickToBottom) {
          markActiveChatRead();
          renderChatList();
        }
      },
      { onError: () => toast('Не удалось загрузить сообщения', 'error') },
    );

    const chat = state.chats.get(chatId) || null;
    if (chat) setupChatScoped(chatId, chat);
  }

  markActiveChatRead();
  renderChatList();
  renderMainPanel();
  if (chatChanged && window.innerWidth > 768) dom.messageInput.focus();
}

/** Полностью снять активный чат (например, отписались от канала). */
function closeActiveChat() {
  closeChatMenu();
  closeMsgMenu();
  cancelComposerMode();
  clearOwnTyping();
  state.pinIndex = 0;
  clearChatScoped();
  state.activeChatId = null;
  state.messages = [];
  state.stickToBottom = true;
  renderChatList();
  renderMainPanel();
}

/** Открыть предпросмотр канала (из поиска) — с кнопкой «Подписаться». */
async function openChannelPreview(chatId) {
  closeChatMenu();
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
  applyChatAvatar(dom.chatHeaderAvatar, state.activeChatId, chat);
  updateChatStatus();

  // Правом на запись управляет role-логика: каналы — только админы.
  const canPost = Chat.canPostToChat(chat, state.user?.uid);
  dom.messageInput.disabled = !canPost;
  dom.sendBtn.disabled = !canPost;
  dom.pollBtn.disabled = !canPost;
  dom.messageInput.placeholder = canPost ? 'Сообщение...' : 'Просмотр';
  dom.channelLocked.classList.toggle('hidden', !(chat?.type === 'channel' && !canPost));

  // Личный чат: собеседник в чёрном списке — прячем его сообщения и композер.
  const peerUid = getPrivatePeerUid(chat);
  const peerBlocked = Boolean(peerUid && state.blocked.has(peerUid));
  dom.privateBlocked.classList.toggle('hidden', !peerBlocked);
  dom.messageForm.classList.toggle('hidden', peerBlocked);

  autoGrowComposer();
  renderMessages();
}

/** Отрисовать предпросмотр канала или публичной группы. */
function renderChannelPreview() {
  const { chatId, chat } = state.channelPreview;
  const member = state.myChatIds.has(chatId);
  const isGroup = chat?.type === 'group';

  dom.channelPreview.classList.remove('hidden');
  dom.chatView.classList.add('hidden');
  dom.chatPanelEmpty.classList.add('hidden');

  dom.previewHeading.textContent = isGroup ? 'Предпросмотр группы' : 'Предпросмотр канала';

  applyAvatar(dom.previewAvatar, chatId, (chat?.title || 'К').trim().charAt(0).toUpperCase());
  dom.previewTitle.textContent = chat?.title || 'Загрузка…';

  if (chat) {
    const handle = chat.username ? `@${chat.username} · ` : '';
    if (isGroup) {
      const count = Object.keys(chat.users || {}).length;
      dom.previewMeta.textContent = `${handle}${count} ${plural(count, ['участник', 'участника', 'участников'])}`;
    } else {
      const count = Number(chat.subscribersCount) || 0;
      dom.previewMeta.textContent = `${handle}${count} ${plural(count, ['подписчик', 'подписчика', 'подписчиков'])}`;
    }
  } else {
    dom.previewMeta.textContent = '';
  }

  dom.previewDescription.textContent = chat?.description || '';
  dom.previewDescription.classList.toggle('hidden', !chat?.description);

  if (member) dom.previewSubscribe.textContent = isGroup ? 'Открыть группу' : 'Открыть канал';
  else dom.previewSubscribe.textContent = isGroup ? 'Присоединиться' : 'Подписаться';
  dom.previewSubscribe.disabled = !chat;
}

/** Перерисовать область сообщений активного чата. */
function renderMessages() {
  const chat = state.chats.get(state.activeChatId) || null;
  const showSender = Boolean(chat) && (chat.type === 'group' || chat.type === 'channel');
  const container = dom.messages;
  const wasStick = state.stickToBottom;
  const prevScrollTop = container.scrollTop;

  container.innerHTML = '';

  // Не показываем сообщения из чёрного списка и «удалённые у меня».
  const visible = state.messages.filter((message) => (
    !state.blocked.has(message.sender)
    && !state.localDeleted.has(`${state.activeChatId}/${message.id}`)
  ));
  if (!visible.length) {
    container.append(createEl('p', 'messages-empty', state.messages.length
      ? 'Сообщения скрыты'
      : 'В этом чате пока нет сообщений'));
    renderPinBar();
    return;
  }

  let lastDay = null;
  const senderUids = [];

  for (const message of visible) {
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

  setupViewsObserver(chat, visible);
  renderPinBar();
  hydrateUsers(senderUids);
}

/**
 * Просмотры постов канала: пост считается просмотренным,
 * если пробыл в зоне видимости ~700 мс (и это не моё сообщение).
 */
function setupViewsObserver(chat, visible) {
  messagesObserver?.disconnect();
  messagesObserver = null;
  if (chat?.type !== 'channel') return;

  const pendingTimers = new Map();
  messagesObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const msgId = entry.target.dataset.msgId;
      if (!msgId) continue;

      if (entry.isIntersecting) {
        if (pendingTimers.has(msgId)) continue;
        pendingTimers.set(msgId, window.setTimeout(() => {
          pendingTimers.delete(msgId);
          recordMessageView(msgId);
        }, 700));
      } else {
        clearTimeout(pendingTimers.get(msgId));
        pendingTimers.delete(msgId);
      }
    }
  }, { threshold: 0.6 });

  for (const message of visible) {
    if (message.sender === state.user?.uid) continue; // свои посты в статистику не идут
    const el = findMessageElement(message.id);
    if (el) messagesObserver.observe(el);
  }

  // Страховка: если IntersectionObserver не доставил событие (фоновая вкладка,
  // ленивый рендер), учитываем посты, которые уже попали в видимую зону ленты.
  const containerRect = dom.messages.getBoundingClientRect();
  for (const message of visible) {
    if (message.sender === state.user?.uid) continue;
    if (pendingTimers.has(message.id)) continue;
    const el = findMessageElement(message.id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) continue;

    pendingTimers.set(message.id, window.setTimeout(() => {
      pendingTimers.delete(message.id);
      const nowEl = findMessageElement(message.id);
      if (!nowEl) return;
      const nowRect = nowEl.getBoundingClientRect();
      const nowContainer = dom.messages.getBoundingClientRect();
      // Пост всё ещё в ленте на виду — засчитываем просмотр.
      if (nowRect.bottom > nowContainer.top && nowRect.top < nowContainer.bottom) {
        recordMessageView(message.id);
      }
    }, 700));
  }
}

/** Учесть уникальный просмотр поста (один раз за сессию). */
function recordMessageView(msgId) {
  const chatId = state.activeChatId;
  if (!chatId || !state.user) return;
  const key = `${chatId}/${msgId}`;
  if (state.viewedMessages.has(key)) return;
  state.viewedMessages.add(key);
  Chat.recordView(chatId, msgId, state.user.uid).catch(() => {});
}

/** Найти DOM-элемент сообщения в ленте по id. */
function findMessageElement(msgId) {
  return dom.messages.querySelector(`[data-msg-id="${CSS.escape(String(msgId))}"]`);
}

/** Прокрутить к сообщению и подсветить его. false — сообщение не загружено. */
function flashMessage(msgId) {
  const el = findMessageElement(msgId);
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('flash');
  void el.offsetWidth; // перезапуск анимации
  el.classList.add('flash');
  window.setTimeout(() => el.classList.remove('flash'), 1200);
  return true;
}

/** Регулярка @упоминаний и #хэштегов в тексте сообщения. */
const MESSAGE_LINK_REGEX = /([@#][A-Za-z0-9_А-Яа-яЁё]{2,32})/g;

/** Текст сообщения с кнопками-ссылками на упоминания и хэштеги. */
function buildMessageText(text) {
  const span = createEl('span', 'bubble-text');
  for (const part of String(text || '').split(MESSAGE_LINK_REGEX)) {
    if (!part) continue;
    if (/^[@#][A-Za-z0-9_А-Яа-яЁё]{2,32}$/.test(part)) {
      const link = createEl('button', 'msg-link', part);
      link.type = 'button';
      link.addEventListener('click', (event) => {
        event.stopPropagation();
        openMentionOrHashtag(part);
      });
      span.append(link);
    } else {
      span.append(document.createTextNode(part));
    }
  }
  return span;
}

/** Клик по @упоминанию / #хэштегу: открыть поиск по этому токену. */
function openMentionOrHashtag(token) {
  exitSearchMode();
  dom.searchInput.value = token;
  dom.searchClear.classList.remove('hidden');
  enterSearchMode();
  runSearch(token);
  if (window.innerWidth <= 768) dom.searchInput.blur();
}

/** Блок опроса внутри сообщения: живые результаты и голосование. */
function buildPollBlock(message) {
  const poll = message.poll || {};
  const options = Array.isArray(poll.options) ? poll.options : [];
  const votes = state.pollVotes.get(message.id) || {};

  const voteCounts = {};
  for (const option of options) voteCounts[option.id] = 0;

  let voterCount = 0;
  for (const userVotes of Object.values(votes)) {
    let votedAny = false;
    for (const optionId of Object.keys(userVotes || {})) {
      if (optionId in voteCounts) {
        voteCounts[optionId] += 1;
        votedAny = true;
      }
    }
    if (votedAny) voterCount += 1;
  }

  const myVotes = votes[state.user?.uid] || {};
  const chat = state.chats.get(state.activeChatId) || null;
  const canVote = Chat.canPostToChat(chat, state.user?.uid);

  const block = createEl('div', 'bubble-poll');
  block.append(createEl('div', 'bubble-poll-question', poll.question || 'Опрос'));
  if (poll.multiple) block.append(createEl('div', 'bubble-poll-hint', 'Можно выбрать несколько ответов'));

  for (const option of options) {
    const count = voteCounts[option.id] || 0;
    const percent = voterCount ? Math.round((count / voterCount) * 100) : 0;
    const mine = Boolean(myVotes[option.id]);

    const btn = createEl('button', `bubble-poll-option${mine ? ' mine' : ''}`);
    btn.type = 'button';
    btn.disabled = !canVote;
    btn.title = canVote ? (mine ? 'Убрать голос' : 'Голосовать') : 'Голосовать могут участники';

    const fill = createEl('span', 'bubble-poll-fill');
    fill.style.width = `${percent}%`;
    btn.append(fill);
    btn.append(createEl('span', 'bubble-poll-label', option.text || '…'));
    btn.append(createEl('span', 'bubble-poll-count', `${count} · ${percent}%`));
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      handlePollVote(message, option.id);
    });
    block.append(btn);
  }

  block.append(createEl('div', 'bubble-poll-footer', `Всего голосов: ${voterCount}`));
  return block;
}

/** Проголосовать или отозвать голос в опросе. */
async function handlePollVote(message, optionId) {
  if (!state.activeChatId || !state.user) return;
  const multiple = Boolean(message.poll?.multiple);
  try {
    await Chat.votePoll(state.activeChatId, message.id, state.user.uid, optionId, multiple);
  } catch (error) {
    console.error(error);
    toast('Не удалось проголосовать', 'error');
  }
}

/** Перейти к исходному сообщению закладки из «Избранного». */
function openSavedSource(savedFrom) {
  if (!savedFrom?.chatId) return;
  if (!state.myChatIds.has(savedFrom.chatId)) {
    toast('Исходный чат больше недоступен');
    return;
  }
  selectChat(savedFrom.chatId);
  window.setTimeout(() => {
    if (state.activeChatId === savedFrom.chatId && !flashMessage(savedFrom.msgId)) {
      toast('Исходное сообщение не подгружено в историю');
    }
  }, 450);
}

/** Собрать DOM одного сообщения. */
function buildMessageElement(message, showSender) {
  const own = message.sender === state.user?.uid;
  const chat = state.chats.get(state.activeChatId) || null;
  const wrap = createEl('div', `message ${own ? 'own' : 'other'}`);
  wrap.dataset.msgId = message.id;
  wrap.tabIndex = 0; // ТВ-пульт и клавиатура: Enter открывает меню

  if (showSender) {
    wrap.append(createEl('div', 'message-sender', own ? 'Вы' : getSenderName(message.sender)));
  }

  const bubble = createEl('div', 'bubble');

  // Пересланное сообщение.
  if (message.forwardedFrom) {
    const fwd = createEl('div', 'bubble-forward');
    fwd.append(createEl('span', 'bubble-forward-icon', '↪'));
    fwd.append(createEl('span', '', `Пересланное от ${message.forwardedFrom.name || 'пользователя'}`));
    bubble.append(fwd);
  }

  // Закладка из «Избранного»: цитата исходного сообщения с переходом.
  if (message.savedFrom) {
    const quote = createEl('button', 'bubble-reply bubble-saved');
    quote.type = 'button';
    quote.append(createEl('span', 'bubble-reply-name', message.savedFrom.chatTitle || 'Избранное'));
    quote.append(createEl('span', 'bubble-reply-text', message.savedFrom.text || ''));
    quote.addEventListener('click', () => openSavedSource(message.savedFrom));
    bubble.append(quote);
  }

  // Цитата: ответ на сообщение.
  if (message.replyTo) {
    const quote = createEl('button', 'bubble-reply');
    quote.type = 'button';
    quote.append(createEl('span', 'bubble-reply-name', getSenderName(message.replyTo.sender)));
    quote.append(createEl('span', 'bubble-reply-text', message.replyTo.text || ''));
    quote.addEventListener('click', () => {
      if (!flashMessage(message.replyTo.msgId)) toast('Сообщение не подгружено в историю');
    });
    bubble.append(quote);
  }

  // Текст с @упоминаниями и #хэштегами либо опрос (идеи 11, 18).
  if (message.poll) bubble.append(buildPollBlock(message));
  else bubble.append(buildMessageText(message.text || ''));

  // Служебная строка: закреп, «изм.», галочки/просмотры, время.
  const meta = createEl('span', 'bubble-meta');
  if (chat?.pinned?.[message.id]) meta.append(createEl('span', 'bubble-pin', '📌'));
  if (message.editedAt) meta.append(createEl('span', 'bubble-edited', 'изм.'));

  // Галочки прочтения в личных чатах — у своих сообщений (идея 6).
  if (own && chat?.type === 'private') {
    const read = Number(message.timestamp) <= state.peerReadTs;
    meta.append(createEl('span', `bubble-ticks${read ? ' read' : ''}`, read ? '✓✓' : '✓'));
  }

  // Просмотры постов канала (идея 14).
  if (chat?.type === 'channel') {
    const views = Object.keys(state.chatViews.get(message.id) || {}).length;
    if (views > 0) meta.append(createEl('span', 'bubble-views', `👁 ${views}`));
  }

  meta.append(createEl('span', 'bubble-time', formatTime(message.timestamp)));
  bubble.append(meta);

  // Кнопка комментариев под постом канала (идея 13).
  if (chat?.type === 'channel') {
    const comments = state.chatComments.get(message.id) || {};
    const count = Object.keys(comments).length;
    const btn = createEl('button', 'bubble-comments');
    btn.type = 'button';
    btn.title = 'Комментарии';
    btn.append(createEl('span', '', '💬'));
    btn.append(createEl('span', 'bubble-comments-count', String(count)));
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openCommentsModal(message);
    });
    bubble.append(btn);
  }

  // Реакции под сообщением.
  const reactions = Object.entries(message.reactions || {})
    .map(([emoji, users]) => ({
      emoji,
      count: Object.keys(users || {}).length,
      mine: Boolean(users?.[state.user?.uid]),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  if (reactions.length) {
    const row = createEl('div', 'bubble-reactions');
    for (const item of reactions) {
      const pill = createEl('button', `reaction-pill${item.mine ? ' mine' : ''}`);
      pill.type = 'button';
      pill.title = item.mine ? 'Убрать реакцию' : 'Поставить реакцию';
      pill.append(createEl('span', 'reaction-emoji', item.emoji));
      pill.append(createEl('span', 'reaction-count', String(item.count)));
      pill.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleReaction(message, item.emoji);
      });
      row.append(pill);
    }
    bubble.append(row);
  }

  wrap.append(bubble);

  // Меню сообщения: ПКМ на десктопе, долгое нажатие на тач-экранах.
  wrap.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    openMsgMenu(message, event.clientX, event.clientY);
  });

  let longPressTimer = null;
  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };
  wrap.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      openMsgMenu(message, touch.clientX, touch.clientY);
    }, 480);
  }, { passive: true });
  wrap.addEventListener('touchend', cancelLongPress);
  wrap.addEventListener('touchmove', cancelLongPress, { passive: true });
  wrap.addEventListener('touchcancel', cancelLongPress);

  // ТВ-пульт и клавиатура: Enter на сообщении открывает меню.
  wrap.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const rect = wrap.getBoundingClientRect();
    openMsgMenu(message, rect.left + 40, rect.bottom - 6);
  });

  return wrap;
}

/* ============================================================
 *  Закреплённые сообщения
 * ============================================================ */

/** Закрепы активного чата: свежие сверху. */
function sortedPins() {
  const chat = state.chats.get(state.activeChatId) || null;
  return Object.entries(chat?.pinned || {})
    .map(([msgId, pin]) => ({
      msgId,
      ts: Number(pin?.ts) || 0,
      text: pin?.text || '',
      sender: pin?.sender || '',
    }))
    .sort((a, b) => b.ts - a.ts);
}

/** Перерисовать плашку закрепа (показываем один, клик листает по кругу). */
function renderPinBar() {
  const pins = sortedPins();
  if (!pins.length) {
    dom.pinBar.classList.add('hidden');
    dom.pinBarTitle.textContent = '';
    dom.pinBarText.textContent = '';
    dom.pinBarCount.textContent = '';
    return;
  }

  state.pinIndex = ((state.pinIndex % pins.length) + pins.length) % pins.length;
  const pin = pins[state.pinIndex];

  dom.pinBar.classList.remove('hidden');
  dom.pinBarTitle.textContent = pin.sender ? getSenderName(pin.sender) : 'Закреплённое сообщение';
  dom.pinBarText.textContent = pin.text || 'Без текста';
  dom.pinBarCount.textContent = `${state.pinIndex + 1}/${pins.length}`;

  hydrateUsers(pins.map((item) => item.sender).filter(Boolean));
}

/** Клик по плашке: перейти к текущему закрепу и показать следующий. */
function cyclePin() {
  const pins = sortedPins();
  if (!pins.length) return;

  const pin = pins[state.pinIndex % pins.length];
  if (!flashMessage(pin.msgId)) toast('Сообщение не подгружено в историю');

  state.pinIndex = (state.pinIndex + 1) % pins.length;
  renderPinBar();
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

        // Данные чата могли прийти после открытия — донастраиваем подписки чата.
        if (chatId === state.activeChatId && chat && state.subscriptions.chatScopedId !== chatId) {
          setupChatScoped(chatId, chat);
        }

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
  const uid = state.user.uid;

  state.subscriptions.userChats = Chat.subscribeToUserChats(
    uid,
    handleUserChatsUpdate,
    () => toast('Не удалось загрузить список чатов', 'error'),
  );
  state.subscriptions.messageDeletes = Chat.subscribeToUserMessageDeletes(
    uid,
    (map) => {
      state.localDeleted = new Set();
      for (const [chatId, msgs] of Object.entries(map)) {
        for (const msgId of Object.keys(msgs || {})) state.localDeleted.add(`${chatId}/${msgId}`);
      }
      if (state.activeChatId) renderMessages();
    },
  );

  // Архив, закреп и папки — личные настройки списка чатов.
  state.subscriptions.userMeta = Chat.subscribeToUserChatMeta(uid, (map) => {
    state.chatMeta = new Map(Object.entries(map || {}));
    renderChatList();
    if (!dom.archiveOverlay.classList.contains('hidden')) renderArchiveList();
    if (!dom.chatCtxOverlay.classList.contains('hidden')) renderChatCtxMenu();
    dom.prefsArchiveCount.textContent = String(archivedChats().length);
  });

  state.subscriptions.userFolders = Chat.subscribeToUserFolders(uid, (map) => {
    state.folders = new Map(Object.entries(map || {}));
    if (!state.folders.has(state.activeFolder)) state.activeFolder = 'all';
    renderChatList();
    if (!dom.chatCtxOverlay.classList.contains('hidden')) renderChatCtxFolders();
  });

  // Мои прочтения — точки непрочитанного в списке чатов.
  state.subscriptions.userReads = Chat.subscribeToUserReads(uid, (map) => {
    state.reads = new Map(Object.entries(map || {}).map(([chatId, ts]) => [chatId, Number(ts) || 0]));
    renderChatList();
  });

  // Мои настройки (приватность последнего визита) и присутствие.
  state.subscriptions.userSettings = Chat.subscribeToUserSettings(uid, (settings) => {
    state.settings = { lastSeenPrivacy: 'all', ...(settings || {}) };
    renderPrefsModal();
  });
  state.subscriptions.presence = Chat.startPresence(uid);

  // «Избранное» — чат с самим собой; создаётся при первом входе.
  Chat.ensureSavedChat(uid).catch((error) => console.error('Не удалось создать «Избранное»:', error));
}

/** Снять все подписки и очистить состояние (при выходе). */
function teardownSubscriptions() {
  const uid = state.user?.uid || null;

  state.subscriptions.userChats?.();
  state.subscriptions.messages?.();
  state.subscriptions.messageDeletes?.();
  state.subscriptions.userMeta?.();
  state.subscriptions.userFolders?.();
  state.subscriptions.userReads?.();
  state.subscriptions.userSettings?.();
  state.subscriptions.presence?.();
  for (const unsubscribe of state.subscriptions.chatMeta.values()) unsubscribe();
  clearChatScoped();
  clearInterval(typingTick);
  typingTick = null;
  if (uid) Chat.setOfflinePresence(uid).catch(() => {});

  state.subscriptions.userChats = null;
  state.subscriptions.messages = null;
  state.subscriptions.messageDeletes = null;
  state.subscriptions.userMeta = null;
  state.subscriptions.userFolders = null;
  state.subscriptions.userReads = null;
  state.subscriptions.userSettings = null;
  state.subscriptions.presence = null;
  state.subscriptions.chatMeta.clear();
  state.chats.clear();
  state.myChatIds = new Set();
  state.activeChatId = null;
  state.messages = [];
  state.stickToBottom = true;
  state.channelPreview = null;
  state.blocked = new Set();
  state.localDeleted = new Set();
  state.chatMeta = new Map();
  state.folders = new Map();
  state.activeFolder = 'all';
  state.reads = new Map();
  state.presence = new Map();
  state.msgCache = new Map();
  state.viewedMessages = new Set();
  closeMsgMenu();
  cancelComposerMode();
  closeChatCtxMenu();
  closePrefsModal();
  closeArchiveModal();
  closePollModal();
  closeCommentsModal();
  closeStatsModal();

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

/* Показать мессенджер (профиль заполнен). */
function enterMessenger() {
  dom.authScreen.classList.add('hidden');
  dom.onboardingScreen.classList.add('hidden');
  dom.messengerScreen.classList.remove('hidden');
  updateSidebarUser();
  renderChatList();
  startSubscriptions();

  // Чёрный список пользователя (сообщения и композер учитывают его).
  state.blocked = new Set();
  Chat.getBlockedUids(state.user.uid)
    .then((uids) => {
      if (!state.user) return; // успели выйти, пока грузили
      state.blocked = new Set(uids);
      renderChatList();
      renderMainPanel();
      if (state.search.query) renderSearchResults();
      if (!dom.blockedOverlay.classList.contains('hidden')) renderBlockedList();
    })
    .catch((error) => console.error('Не удалось загрузить чёрный список:', error));
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
async function saveProfileForm({ usernameEl, firstNameEl, lastNameEl, bioEl, errorEl, submitEl, avatar = undefined, onSuccess }) {
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
        avatar: avatar === undefined ? (state.profile?.avatar || null) : avatar,
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
  initAvatarEditor();
  dom.profileError.classList.add('hidden');
  dom.pfUsername.focus();
}

function closeProfileModal() {
  dom.profileOverlay.classList.add('hidden');
}

/* ============================================================
 *  Аватарка в профиле: буква или эмодзи на цвете/градиенте
 * ============================================================ */

/** Черновик аватарки в окне профиля. */
const avatarDraft = {
  custom: false,        // трогал ли пользователь редактор в этот раз
  kind: 'letter',       // 'letter' | 'emoji'
  value: '',
  bgType: 'solid',      // 'solid' | 'gradient'
  bg1: AVATAR_COLORS[0],
  bg2: AVATAR_COLORS[2],
  size: 100,            // размер буквы/эмодзи в процентах (50–200)
};

/** Разрешённый формат цвета: #rrggbb. */
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/;

/**
 * Нормализовать hex-цвет из поля ввода: добавить «#», раскрыть #abc,
 * привести к нижнему регистру. null — невалидный цвет.
 */
function normalizeHex(raw) {
  let value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!value.startsWith('#')) value = '#' + value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    value = '#' + [...value.slice(1)].map((char) => char + char).join('');
  }
  return HEX_COLOR_REGEX.test(value) ? value : null;
}

/** Собрать аватарку из черновика (null — если значение пустое). */
function draftAvatar() {
  const value = avatarDraft.kind === 'letter'
    ? avatarDraft.value.replace(/[^0-9A-Za-zА-Яа-яЁё]/g, '').charAt(0).toUpperCase()
    : [...avatarDraft.value].slice(0, 4).join('');
  if (!value) return null;
  return avatarDraft.bgType === 'gradient'
    ? { kind: avatarDraft.kind, value, bgType: 'gradient', bg1: avatarDraft.bg1, bg2: avatarDraft.bg2, size: avatarDraft.size }
    : { kind: avatarDraft.kind, value, bgType: 'solid', bg1: avatarDraft.bg1, size: avatarDraft.size };
}

/** Залить черновик данными текущего профиля и перерисовать редактор. */
function initAvatarEditor() {
  const avatar = state.profile?.avatar || null;
  avatarDraft.custom = false;
  avatarDraft.kind = avatar?.kind === 'emoji' ? 'emoji' : 'letter';
  avatarDraft.value = avatar?.value
    || (state.profile?.firstName || state.profile?.username || '').trim().charAt(0).toUpperCase();
  avatarDraft.bgType = avatar?.bgType === 'gradient' ? 'gradient' : 'solid';
  avatarDraft.bg1 = avatar?.bg1 || AVATAR_COLORS[0];
  avatarDraft.bg2 = avatar?.bg2 || AVATAR_COLORS[2];
  avatarDraft.size = Math.min(200, Math.max(50, Number(avatar?.size) || 100));
  renderAvatarEditor();
}

/** Изменить размер буквы/эмодзи на delta процентов (шаг 10). */
function adjustAvatarSize(delta) {
  avatarDraft.custom = true;
  avatarDraft.size = Math.min(200, Math.max(50, avatarDraft.size + delta));
  renderAvatarEditor();
}

/** Перерисовать контролы редактора и превью (syncInput=false — не трогать поле ввода). */
function renderAvatarEditor(syncInput = true) {
  dom.avatarKindBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.avatarKind === avatarDraft.kind);
  });
  dom.avatarBgBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.avatarBg === avatarDraft.bgType);
  });

  if (syncInput) {
    if (dom.avatarValue.value !== avatarDraft.value) dom.avatarValue.value = avatarDraft.value;
    dom.avatarValue.maxLength = avatarDraft.kind === 'letter' ? 1 : 4;
    dom.avatarValue.placeholder = avatarDraft.kind === 'letter' ? 'С' : '💡';
    if (normalizeHex(dom.avatarHex1.value) !== avatarDraft.bg1) dom.avatarHex1.value = avatarDraft.bg1;
    if (normalizeHex(dom.avatarHex2.value) !== avatarDraft.bg2) dom.avatarHex2.value = avatarDraft.bg2;
    dom.avatarHex1.classList.remove('invalid');
    dom.avatarHex2.classList.remove('invalid');
  }

  dom.avatarSizeValue.textContent = `${avatarDraft.size}%`;
  dom.avatarColorRow2.classList.toggle('hidden', avatarDraft.bgType !== 'gradient');
  dom.avatarPalette2.classList.toggle('hidden', avatarDraft.bgType !== 'gradient');
  dom.avatarPalette1.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color === avatarDraft.bg1);
  });
  dom.avatarPalette2.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color === avatarDraft.bg2);
  });

  // Превью: своя аватарка (если есть или её начали настраивать), иначе стандартная.
  const showDraft = avatarDraft.custom || Boolean(state.profile?.avatar);
  if (showDraft) {
    applyProfileAvatar(
      dom.avatarPreview,
      { avatar: draftAvatar() },
      state.user?.uid || 'me',
      getProfileInitials(state.profile),
    );
  } else {
    dom.avatarPreview.classList.remove('avatar-emoji');
    applyAvatar(dom.avatarPreview, state.user?.uid || 'me', getProfileInitials(state.profile));
  }
}

/** Собрать ряд кнопок-цветов. */
function buildPalette(container, onPick) {
  container.innerHTML = '';
  AVATAR_COLORS.forEach((color) => {
    const swatch = createEl('button', 'swatch');
    swatch.type = 'button';
    swatch.dataset.color = color;
    swatch.style.background = color;
    swatch.title = color;
    swatch.addEventListener('click', () => onPick(color));
    container.append(swatch);
  });
}

buildPalette(dom.avatarPalette1, (color) => {
  avatarDraft.custom = true;
  avatarDraft.bg1 = color;
  renderAvatarEditor();
});
buildPalette(dom.avatarPalette2, (color) => {
  avatarDraft.custom = true;
  avatarDraft.bg2 = color;
  renderAvatarEditor();
});

dom.avatarKindBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    avatarDraft.custom = true;
    avatarDraft.kind = btn.dataset.avatarKind === 'emoji' ? 'emoji' : 'letter';
    if (avatarDraft.kind === 'letter' && avatarDraft.value) {
      avatarDraft.value = avatarDraft.value.charAt(0).toUpperCase();
    }
    renderAvatarEditor();
  });
});
dom.avatarBgBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    avatarDraft.custom = true;
    avatarDraft.bgType = btn.dataset.avatarBg === 'gradient' ? 'gradient' : 'solid';
    renderAvatarEditor();
  });
});
dom.avatarValue.addEventListener('input', () => {
  avatarDraft.custom = true;
  avatarDraft.value = dom.avatarValue.value;
  renderAvatarEditor(false); // не трогаем само поле, чтобы не прыгал курсор
});

// Размер буквы/эмодзи: шаг 10% в диапазоне 50–200%.
dom.avatarSizeMinus.addEventListener('click', () => adjustAvatarSize(-10));
dom.avatarSizePlus.addEventListener('click', () => adjustAvatarSize(10));

// Свои hex-цвета для фона и градиента.
function bindHexInput(inputEl, key) {
  inputEl.addEventListener('input', () => {
    const hex = normalizeHex(inputEl.value);
    inputEl.classList.toggle('invalid', !hex && inputEl.value.trim() !== '');
    if (!hex) return;
    avatarDraft.custom = true;
    avatarDraft[key] = hex;
    renderAvatarEditor(false); // не трогаем поля, чтобы не прыгал курсор
  });
  inputEl.addEventListener('blur', () => {
    inputEl.classList.remove('invalid');
    inputEl.value = avatarDraft[key];
  });
}
bindHexInput(dom.avatarHex1, 'bg1');
bindHexInput(dom.avatarHex2, 'bg2');

/* ============================================================
 *  Модальное окно «Новый чат»
 * ============================================================ */

function openModal() {
  dom.modalOverlay.classList.remove('hidden');
  setModalTab('private');
  setGroupTypeChoice('private');
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

/** Переключить тип новой группы: приватная (участники) / публичная (юзернейм). */
function setGroupTypeChoice(type) {
  groupTypeChoice = type === 'public' ? 'public' : 'private';
  dom.groupTypeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.groupType === groupTypeChoice);
  });
  dom.groupUsernameField.classList.toggle('hidden', groupTypeChoice !== 'public');
  dom.groupMembersField.classList.toggle('hidden', groupTypeChoice !== 'private');
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

      // Публичная группа: обязателен юзернейм, участники присоединяются сами.
      if (groupTypeChoice === 'public') {
        const username = Chat.normalizeUsername(dom.groupUsername.value);
        if (!Chat.isValidUsername(username)) {
          throw new Error('Юзернейм группы: 3–32 символа (a–z, 0–9, «_»)');
        }
        const chatId = await Chat.createGroupChat(myUid, {
          title,
          description: dom.groupDescription.value,
          type: 'public',
          username,
        });
        closeModal();
        dom.createChatForm.reset();
        selectChat(chatId);
        toast(`Публичная группа @${username} создана`, 'success');
        return;
      }

      // Приватная группа: участники — по юзернеймам.
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

      const chatId = await Chat.createGroupChat(myUid, {
        title,
        description: dom.groupDescription.value,
        type: 'private',
        memberUids: [...members],
      });
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
 *  Отправка, ответ и редактирование сообщений
 * ============================================================ */

/** Плашка над полем ввода: обычный режим / «ответ» / «редактирование». */
function setComposerMode(mode) {
  state.composerMode = mode;

  if (!mode) {
    dom.composerContext.classList.add('hidden');
    dom.messageInput.value = '';
    autoGrowComposer();
    return;
  }

  dom.composerContext.classList.remove('hidden');
  if (mode.type === 'edit') {
    dom.composerContextTitle.textContent = 'Редактирование';
    dom.messageInput.value = mode.message.text || '';
  } else {
    dom.composerContextTitle.textContent = `Ответ ${getSenderName(mode.message.sender)}`;
    dom.messageInput.value = '';
  }
  dom.composerContextText.textContent = Chat.messageSnippet(mode.message.text, 90);
  autoGrowComposer();
  dom.messageInput.focus();
}

/** Сбросить режим ответа/правки (например, при смене чата). */
function cancelComposerMode() {
  state.composerMode = null;
  dom.composerContext.classList.add('hidden');
  dom.messageInput.value = '';
  autoGrowComposer();
}

/** Авторастягивание поля ввода: от одной строки до 148 px. */
function autoGrowComposer() {
  const el = dom.messageInput;
  el.style.height = 'auto';
  const height = el.scrollHeight;
  if (!height) {
    // Панель чата скрыта — высоту не запоминаем, посчитаем при показе.
    el.style.height = '';
    el.style.overflowY = '';
    return;
  }
  el.style.height = `${Math.min(height, 148)}px`;
  el.style.overflowY = height > 148 ? 'auto' : 'hidden';
}

/** Сообщить в RTDB «печатает…» (не чаще раза в 3 секунды, сброс после паузы). */
function notifyTyping() {
  if (!state.activeChatId || !state.user || state.composerMode?.type === 'edit') return;

  const now = Date.now() / 1000;
  if (now - typingLastSent > 3) {
    typingLastSent = now;
    Chat.setTyping(state.activeChatId, state.user.uid, getOwnDisplayName()).catch(() => {});
  }

  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    typingTimer = null;
    typingLastSent = 0;
    if (state.activeChatId && state.user) {
      Chat.clearTyping(state.activeChatId, state.user.uid).catch(() => {});
    }
  }, 2600);
}

async function handleSendMessage(event) {
  event.preventDefault();
  if (!state.activeChatId || !state.user) return;

  const text = dom.messageInput.value;
  if (!text.trim()) return;

  const chat = state.chats.get(state.activeChatId);
  if (!Chat.canPostToChat(chat, state.user.uid)) return;

  const mode = state.composerMode;

  // Оптимистично очищаем поле; при ошибке вернём текст обратно.
  dom.messageInput.value = '';
  autoGrowComposer();
  clearOwnTyping();
  dom.composerContext.classList.add('hidden');
  state.composerMode = null;
  state.stickToBottom = true;

  try {
    if (mode?.type === 'edit') {
      await Chat.editMessage(state.activeChatId, mode.message.id, state.user.uid, text);
    } else if (mode?.type === 'reply') {
      await Chat.sendMessage(state.activeChatId, state.user.uid, text, {
        replyTo: {
          msgId: mode.message.id,
          sender: mode.message.sender,
          text: Chat.messageSnippet(mode.message.text),
        },
      });
    } else {
      await Chat.sendMessage(state.activeChatId, state.user.uid, text);
    }
  } catch (error) {
    console.error(error);
    toast(mode?.type === 'edit' ? 'Не удалось изменить сообщение' : 'Не удалось отправить сообщение', 'error');
    dom.messageInput.value = text;
    autoGrowComposer();
    if (mode) {
      state.composerMode = mode;
      dom.composerContext.classList.remove('hidden');
    }
  }

  dom.messageInput.focus();
}

/* ============================================================
 *  Меню сообщения: реакции, ответ, правка, пересылка, закреп
 * ============================================================ */

/** Поставить/снять реакцию (из меню или кликом по пилюле под сообщением). */
async function toggleReaction(message, emoji) {
  if (!state.activeChatId || !state.user) return;
  const mine = Boolean(message.reactions?.[emoji]?.[state.user.uid]);
  try {
    await Chat.setReaction(state.activeChatId, message.id, emoji, state.user.uid, !mine);
  } catch (error) {
    console.error(error);
    toast('Не удалось поставить реакцию', 'error');
  }
}

/** Позиционировать меню сообщения в границах окна. */
function positionMsgMenu() {
  const { x = 0, y = 0 } = state.msgMenuPos || {};
  const rect = dom.msgMenu.getBoundingClientRect();
  const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
  dom.msgMenu.style.left = `${left}px`;
  dom.msgMenu.style.top = `${top}px`;
}

/** Открыть меню сообщения рядом с точкой (x, y). */
function openMsgMenu(message, x, y) {
  if (!message || !state.activeChatId) return;
  state.msgMenuMessage = message;
  state.msgMenuPos = { x, y };
  state.msgMenuExpanded = false;

  renderMsgMenuReactions(message);
  renderMsgMenuActions(message);

  dom.msgMenuAll.classList.add('hidden');
  dom.msgMenuMore.classList.remove('expanded');
  dom.msgMenuOverlay.classList.remove('hidden');
  positionMsgMenu();
}

/** Закрыть меню сообщения. */
function closeMsgMenu() {
  dom.msgMenuOverlay.classList.add('hidden');
  state.msgMenuMessage = null;
}

/** Кнопка-эмодзи для меню. */
function buildReactionButton(message, emoji) {
  const btn = createEl('button', 'msg-reaction-btn', emoji);
  btn.type = 'button';
  if (message.reactions?.[emoji]?.[state.user?.uid]) btn.classList.add('active');
  btn.addEventListener('click', () => {
    closeMsgMenu();
    toggleReaction(message, emoji);
  });
  return btn;
}

/** Ряд из шести быстрых реакций + полный набор под стрелочкой. */
function renderMsgMenuReactions(message) {
  dom.msgMenuReactions.innerHTML = '';
  REACTIONS_TOP.forEach((emoji) => dom.msgMenuReactions.append(buildReactionButton(message, emoji)));

  dom.msgMenuAll.innerHTML = '';
  REACTIONS_ALL.forEach((emoji) => dom.msgMenuAll.append(buildReactionButton(message, emoji)));
}

/** Действия в меню сообщения: ответ, правка, копия, пересылка, закреп, удаление. */
function renderMsgMenuActions(message) {
  const chat = state.chats.get(state.activeChatId) || null;
  const own = message.sender === state.user?.uid;
  const canPost = Chat.canPostToChat(chat, state.user?.uid);
  const pinned = Boolean(chat?.pinned?.[message.id]);

  dom.msgMenuActions.innerHTML = '';
  const add = (label, handler, className = 'msg-menu-action') => {
    const btn = createEl('button', className, label);
    btn.type = 'button';
    btn.addEventListener('click', handler);
    dom.msgMenuActions.append(btn);
    return btn;
  };

  if (canPost) {
    add('Ответить', () => {
      closeMsgMenu();
      setComposerMode({ type: 'reply', message });
    });
  }
  if (own && !message.poll) {
    add('Изменить', () => {
      closeMsgMenu();
      setComposerMode({ type: 'edit', message });
    });
  }
  add('Копировать', () => {
    closeMsgMenu();
    copyMessageText(message);
  });
  add('Переслать', () => {
    closeMsgMenu();
    openForwardModal(message);
  });

  // «Избранное»: закладка на сообщение (идея 20).
  if (chat?.type !== 'saved' && (message.text || message.poll)) {
    add('В избранное', () => {
      closeMsgMenu();
      saveMessageToFavorites(message);
    });
  }

  // Комментарии к посту канала (идея 13).
  if (chat?.type === 'channel') {
    add('Комментарии', () => {
      closeMsgMenu();
      openCommentsModal(message);
    });
  }

  if (canPost) {
    add(pinned ? 'Открепить' : 'Закрепить', async () => {
      closeMsgMenu();
      try {
        await Chat.setPinned(state.activeChatId, message.id, !pinned, message);
        toast(pinned ? 'Закреп снят' : 'Сообщение закреплено');
      } catch (error) {
        console.error(error);
        toast('Не удалось обновить закреп', 'error');
      }
    });
  }
  add('Удалить', () => {
    closeMsgMenu();
    requestDeleteMessage(message);
  }, 'msg-menu-action danger');
}

/** Скопировать текст сообщения в буфер обмена (с запасным способом). */
async function copyMessageText(message) {
  const text = message.text || '';
  let copied = false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (error) {
    console.error(error);
  }

  if (!copied) {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      copied = document.execCommand('copy');
      area.remove();
    } catch (error) {
      console.error(error);
    }
  }

  toast(copied ? 'Скопировано' : 'Не удалось скопировать', copied ? 'success' : 'error');
}

/** Удаление: чужое — сразу «у меня», своё — с выбором «у всех / только у меня». */
function requestDeleteMessage(message) {
  if (message.sender !== state.user?.uid) {
    removeMessageLocally(message);
    return;
  }
  state.pendingDeleteMessage = message;
  dom.deleteChoiceOverlay.classList.remove('hidden');
}

/** Закрыть диалог выбора удаления. */
function closeDeleteChoice() {
  dom.deleteChoiceOverlay.classList.add('hidden');
  state.pendingDeleteMessage = null;
}

/** «Удалить у меня»: сообщение исчезает только у текущего пользователя. */
async function removeMessageLocally(message) {
  if (!state.activeChatId || !state.user) return;
  try {
    await Chat.deleteMessageLocally(state.user.uid, state.activeChatId, message.id);
    toast('Сообщение удалено у вас');
  } catch (error) {
    console.error(error);
    toast('Не удалось удалить сообщение', 'error');
  }
}

/** «Удалить у всех»: настоящее удаление своего сообщения из БД. */
async function removeMessageForEveryone(message) {
  if (!state.activeChatId || !state.user) return;
  try {
    await Chat.deleteMessage(state.activeChatId, message.id, state.user.uid);
    toast('Сообщение удалено у всех');
  } catch (error) {
    console.error(error);
    toast('Не удалось удалить сообщение', 'error');
  }
}

/* --- Пересылка сообщения --- */

/** Открыть окно выбора чата для пересылки. */
function openForwardModal(message) {
  state.forwardMessage = message;

  const targets = sortedChats().filter(([chatId, chat]) => (
    chatId !== state.activeChatId && Chat.canPostToChat(chat, state.user?.uid)
  ));

  dom.forwardList.innerHTML = '';
  dom.forwardEmpty.classList.toggle('hidden', targets.length > 0);

  for (const [chatId, chat] of targets) {
    const item = createEl('div', 'chat-item');
    item.dataset.chatId = chatId;
    item.tabIndex = 0;

    const avatar = createEl('div', 'avatar');
    applyChatAvatar(avatar, chatId, chat);

    const body = createEl('div', 'chat-item-body');
    const top = createEl('div', 'chat-item-top');
    top.append(createEl('span', 'chat-item-title', getChatTitle(chat)));
    const bottom = createEl('div', 'chat-item-bottom');
    const kind = chat.type === 'channel' ? 'Канал' : chat.type === 'group' ? 'Группа' : 'Личный чат';
    bottom.append(createEl('span', 'chat-item-preview', kind));
    body.append(top, bottom);

    item.append(avatar, body);
    item.addEventListener('click', () => forwardMessageTo(chatId));
    dom.forwardList.append(item);
  }

  dom.forwardOverlay.classList.remove('hidden');
}

/** Закрыть окно пересылки. */
function closeForwardModal() {
  dom.forwardOverlay.classList.add('hidden');
  state.forwardMessage = null;
}

/** Переслать выбранное сообщение в чат chatId. */
async function forwardMessageTo(chatId) {
  const message = state.forwardMessage;
  if (!message || !state.user) return;
  closeForwardModal();

  try {
    await Chat.sendMessage(chatId, state.user.uid, message.text, {
      forwardedFrom: { uid: message.sender, name: getSenderName(message.sender) },
    });
    toast('Переслано', 'success');
  } catch (error) {
    console.error(error);
    toast('Не удалось переслать сообщение', 'error');
  }
}

/** Сохранить сообщение в «Избранное» с ссылкой на источник (идея 20). */
async function saveMessageToFavorites(message) {
  if (!state.user || !state.activeChatId) return;
  const chat = state.chats.get(state.activeChatId) || null;
  const text = message.text || (message.poll ? '📊 ' + (message.poll.question || '') : '');

  try {
    await Chat.saveToFavorites(
      state.user.uid,
      {
        chatId: state.activeChatId,
        chatTitle: getChatTitle(chat),
        msgId: message.id,
        sender: message.sender,
        text: Chat.messageSnippet(text, 90),
      },
      text,
    );
    toast('Сохранено в «Избранное»', 'success');
  } catch (error) {
    console.error(error);
    toast('Не удалось сохранить в «Избранное»', 'error');
  }
}

/* ============================================================
 *  Чёрный список и настройки группы/канала
 * ============================================================ */

/**
 * Заблокировать (blocked=true) или разблокировать пользователя.
 * Обновляет state.blocked и перерисовывает затронутые части UI.
 */
async function setBlocked(peerUid, blocked) {
  if (!peerUid || !state.user) return;
  if (blocked && !window.confirm('Заблокировать пользователя? Его сообщения станут скрыты, а писать ему будет нельзя.')) return;

  try {
    if (blocked) {
      await Chat.blockUser(state.user.uid, peerUid);
      state.blocked.add(peerUid);
      toast('Пользователь заблокирован');
    } else {
      await Chat.unblockUser(state.user.uid, peerUid);
      state.blocked.delete(peerUid);
      toast('Пользователь разблокирован');
    }
    renderChatList();
    renderMainPanel();
    if (state.search.query) renderSearchResults();
    if (!dom.blockedOverlay.classList.contains('hidden')) renderBlockedList();
    if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
  } catch (error) {
    console.error(error);
    toast('Не удалось обновить чёрный список', 'error');
  }
}

/** Список заблокированных в модальном окне. */
function renderBlockedList() {
  const uids = [...state.blocked];
  dom.blockedList.innerHTML = '';
  dom.blockedEmpty.classList.toggle('hidden', uids.length > 0);

  const missing = [];
  for (const uid of uids) {
    const profile = Chat.getCachedUserProfile(uid);
    if (profile === undefined) missing.push(uid);

    const item = createEl('div', 'chat-item');

    const avatar = createEl('div', 'avatar avatar-sm');
    applyProfileAvatar(avatar, profile, uid);

    const body = createEl('div', 'chat-item-body');
    const top = createEl('div', 'chat-item-top');
    top.append(createEl('span', 'chat-item-title', getProfileName(profile) || 'Пользователь'));
    const bottom = createEl('div', 'chat-item-bottom');
    bottom.append(createEl('span', 'chat-item-preview', profile?.username ? '@' + profile.username : '…'));
    body.append(top, bottom);

    const unblockBtn = createEl('button', 'unsubscribe-btn', 'Разблокировать');
    unblockBtn.type = 'button';
    unblockBtn.addEventListener('click', () => setBlocked(uid, false));

    item.append(avatar, body, unblockBtn);
    dom.blockedList.append(item);
  }

  // Профили могли ещё не загрузиться — догружаем и перерисовываем.
  if (missing.length) {
    hydrateUsers(missing).then(() => {
      if (!dom.blockedOverlay.classList.contains('hidden')) renderBlockedList();
    });
  }
}

function openBlockedModal() {
  dom.blockedOverlay.classList.remove('hidden');
  renderBlockedList();
}

/** Открыть настройки чата (действие «Настройки» в меню чата). */
function openSettingsModal() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) return;

  settingsChatId = state.activeChatId;
  dom.settingsHeading.textContent = chat.type === 'group' ? 'Настройки группы' : 'Настройки канала';
  dom.settingsTitle.value = chat.title || '';
  dom.settingsDescription.value = chat.description || '';
  dom.settingsGroupBlock.classList.toggle('hidden', chat.type !== 'group');
  setSettingsTypeChoice(chat.groupType === 'public' ? 'public' : 'private');
  dom.settingsUsername.value = chat.username || '';
  dom.settingsError.classList.add('hidden');
  dom.settingsOverlay.classList.remove('hidden');
}

/** Переключить тип группы в настройках (приватная/публичная). */
function setSettingsTypeChoice(type) {
  settingsTypeChoice = type === 'public' ? 'public' : 'private';
  dom.settingsTypeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.settingsType === settingsTypeChoice);
  });
  dom.settingsUsernameField.classList.toggle('hidden', settingsTypeChoice !== 'public');
}

function closeSettingsModal() {
  dom.settingsOverlay.classList.add('hidden');
}

/* ============================================================
 *  Всплывающее меню чата (клик по аватарке в шапке)
 * ============================================================ */

/** Открыть меню: аватарка, описание, действия, участники/админы. */
function openChatMenu() {
  if (!state.activeChatId) return;
  renderChatMenu();
  dom.chatMenuOverlay.classList.remove('hidden');
}

function closeChatMenu() {
  dom.chatMenuOverlay.classList.add('hidden');
}

/** Кнопка-действие в меню чата. */
function addChatMenuAction(label, onClick) {
  const btn = createEl('button', 'btn ghost menu-action', label);
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  dom.chatMenuActions.append(btn);
  return btn;
}

/** Перерисовать содержимое меню для активного чата. */
function renderChatMenu() {
  const chat = state.chats.get(state.activeChatId) || null;
  if (!chat) return;

  const myUid = state.user?.uid;
  const isOwner = Boolean(chat.owner && chat.owner === myUid);
  const peerUid = chat.type === 'private' ? getPrivatePeerUid(chat) : null;
  const missing = [];

  applyChatAvatar(dom.chatMenuAvatar, state.activeChatId, chat);
  dom.chatMenuTitle.textContent = getChatTitle(chat);
  dom.chatMenuType.textContent = chat.type === 'channel'
    ? 'Канал'
    : chat.type === 'group' ? 'Группа' : 'Личный чат';

  // Описание канала/группы; для личного чата — био собеседника.
  let description = chat.description || '';
  let handle = chat.username ? '@' + chat.username : '';
  if (chat.type === 'private') {
    const peerProfile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
    if (peerUid && peerProfile === undefined) missing.push(peerUid);
    description = peerProfile?.bio || '';
    handle = peerProfile?.username ? '@' + peerProfile.username : '';
  }
  dom.chatMenuDescription.textContent = description;
  dom.chatMenuDescription.classList.toggle('hidden', !description);
  dom.chatMenuUsername.textContent = handle;
  dom.chatMenuUsername.classList.toggle('hidden', !handle);
  updateChatStatus(); // строка «в сети / был(а)…» под юзернеймом

  // Кнопки действий.
  dom.chatMenuActions.innerHTML = '';

  if (chat.type === 'private') {
    if (peerUid) {
      const blocked = state.blocked.has(peerUid);
      addChatMenuAction(blocked ? 'Разблокировать' : 'Заблокировать', () => {
        setBlocked(peerUid, !blocked);
      });
    }
  } else if (isOwner) {
    addChatMenuAction('Настройки', () => {
      closeChatMenu();
      openSettingsModal();
    });
  }
  if (chat.type === 'channel' && !chat.admins?.[myUid] && state.myChatIds.has(state.activeChatId)) {
    addChatMenuAction('Отписаться от канала', unsubscribeFromActiveChannel);
  }

  // Статистика канала — только для администраторов (идея 14).
  if (chat.type === 'channel' && chat.admins?.[myUid]) {
    addChatMenuAction('📊 Статистика канала', () => {
      closeChatMenu();
      openStatsModal();
    });
  }

  // Участники группы либо администраторы канала.
  const uids = chat.type === 'group'
    ? Object.keys(chat.users || {})
    : chat.type === 'channel' ? Object.keys(chat.admins || {}) : [];
  dom.chatMenuMembersBlock.classList.toggle('hidden', uids.length === 0);
  dom.chatMenuMembers.innerHTML = '';

  if (uids.length) {
    dom.chatMenuMembersTitle.textContent = chat.type === 'group'
      ? `Участники · ${uids.length}`
      : `Администраторы · ${uids.length}`;

    for (const uid of uids) {
      const profile = Chat.getCachedUserProfile(uid);
      if (profile === undefined) missing.push(uid);

      const item = createEl('div', 'chat-item');
      const avatar = createEl('div', 'avatar avatar-sm');
      applyProfileAvatar(avatar, profile, uid);

      const body = createEl('div', 'chat-item-body');
      const top = createEl('div', 'chat-item-top');
      top.append(createEl('span', 'chat-item-title', getProfileName(profile) || 'Пользователь'));
      if (uid === chat.owner) top.append(createEl('span', 'search-badge muted', 'владелец'));
      else if (chat.type === 'channel') top.append(createEl('span', 'search-badge muted', 'админ'));
      if (uid === myUid) top.append(createEl('span', 'search-badge', 'вы'));

      const bottom = createEl('div', 'chat-item-bottom');
      bottom.append(createEl('span', 'chat-item-preview', profile?.username ? '@' + profile.username : '…'));
      body.append(top, bottom);
      item.append(avatar, body);
      dom.chatMenuMembers.append(item);
    }
  }

  // Профили могли ещё не загрузиться — догружаем и перерисовываем.
  if (missing.length) {
    hydrateUsers(missing).then(() => {
      if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
    });
  }
}

/** Отписаться от канала (действие в меню чата). */
async function unsubscribeFromActiveChannel() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat || chat.type !== 'channel') return;
  if (!window.confirm(`Отписаться от канала «${getChatTitle(chat)}»?`)) return;

  try {
    await Chat.unsubscribeFromChannel(state.user.uid, state.activeChatId);
    closeChatMenu();
    toast('Вы отписались от канала');
  } catch (error) {
    console.error(error);
    toast('Не удалось отписаться от канала', 'error');
  }
}

/* ============================================================
 *  Меню чата в списке (ПКМ / долгое нажатие): закрепить, архив, папки
 * ============================================================ */

let chatCtxPos = null; // точка открытия меню чата в списке

/** Чаты в архиве (для окна «Архив» и счётчика в настройках). */
function archivedChats() {
  return sortedChats().filter(([chatId]) => getChatMeta(chatId).archived);
}

/** Расположить меню чата в границах окна. */
function positionChatCtxMenu() {
  const rect = dom.chatCtxMenu.getBoundingClientRect();
  const x = Math.max(8, Math.min(chatCtxPos?.x || 0, window.innerWidth - rect.width - 8));
  const y = Math.max(8, Math.min(chatCtxPos?.y || 0, window.innerHeight - rect.height - 8));
  dom.chatCtxMenu.style.left = `${x}px`;
  dom.chatCtxMenu.style.top = `${y}px`;
}

/** Открыть меню чата рядом с точкой (x, y): ПКМ или долгое нажатие. */
function openChatCtxMenu(chatId, x, y) {
  if (!state.myChatIds.has(chatId)) return;
  state.chatCtxChatId = chatId;
  chatCtxPos = { x, y };
  renderChatCtxMenu();
  dom.chatCtxOverlay.classList.remove('hidden');
}

/** Закрыть меню чата. */
function closeChatCtxMenu() {
  dom.chatCtxOverlay.classList.add('hidden');
  state.chatCtxChatId = null;
  chatCtxPos = null;
}

/** Действия меню: закрепить, в архив, папки (+ создание новой). */
function renderChatCtxMenu() {
  const chatId = state.chatCtxChatId;
  const chat = state.chats.get(chatId) || null;
  if (!chatId || !chat) {
    closeChatCtxMenu();
    return;
  }

  const meta = getChatMeta(chatId);
  dom.chatCtxActions.innerHTML = '';

  const addAction = (label, handler) => {
    const btn = createEl('button', 'ctx-action', label);
    btn.type = 'button';
    btn.addEventListener('click', handler);
    dom.chatCtxActions.append(btn);
  };

  addAction(`📌 ${meta.pinnedAt ? 'Открепить' : 'Закрепить'}`, async () => {
    closeChatCtxMenu();
    try {
      await Chat.setChatPinned(state.user.uid, chatId, !meta.pinnedAt);
      toast(meta.pinnedAt ? 'Чат откреплён' : 'Чат закреплён');
    } catch (error) {
      console.error(error);
      toast('Не удалось закрепить чат', 'error');
    }
  });

  addAction(`🗄 ${meta.archived ? 'Вернуть из архива' : 'Архивировать'}`, async () => {
    closeChatCtxMenu();
    try {
      await Chat.setChatArchived(state.user.uid, chatId, !meta.archived);
      toast(meta.archived ? 'Чат возвращён из архива' : 'Чат убран в архив');
    } catch (error) {
      console.error(error);
      toast('Не удалось обновить архив', 'error');
    }
  });

  dom.chatCtxFolders.classList.remove('hidden');
  renderChatCtxFolders();
  positionChatCtxMenu();
}

/** Список папок в меню чата: отметки и создание новой папки. */
function renderChatCtxFolders() {
  const chatId = state.chatCtxChatId;
  if (!chatId) return;

  const meta = getChatMeta(chatId);
  dom.chatCtxFolders.innerHTML = '';
  dom.chatCtxFolders.append(createEl('div', 'ctx-title', 'Переместить в папку'));

  const folders = [...state.folders.entries()].sort((a, b) => (
    (Number(a[1]?.createdAt) || 0) - (Number(b[1]?.createdAt) || 0)
  ));

  for (const [folderId, folder] of folders) {
    const member = Boolean(meta.folders?.[folderId]);
    const btn = createEl('button', 'ctx-action');
    btn.type = 'button';
    btn.append(createEl('span', 'ctx-check', member ? '✓' : ''));
    btn.append(createEl('span', '', folder?.name || 'Папка'));
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await Chat.toggleChatFolder(state.user.uid, chatId, folderId, !member);
      } catch (error) {
        console.error(error);
        toast('Не удалось изменить папку', 'error');
        btn.disabled = false;
      }
      // Подписка на папки перерисует меню (если оно ещё открыто).
    });
    dom.chatCtxFolders.append(btn);
  }

  // Создание новой папки и сразу добавление в неё чата.
  const row = createEl('div', 'ctx-create-row');
  const input = createEl('input', '');
  input.type = 'text';
  input.placeholder = 'Новая папка…';
  input.maxLength = 40;
  const createBtn = createEl('button', 'ctx-mini-btn', 'Создать');
  createBtn.type = 'button';

  const createFolder = async () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    createBtn.disabled = true;
    try {
      const folderId = await Chat.createUserFolder(state.user.uid, name);
      await Chat.toggleChatFolder(state.user.uid, chatId, folderId, true);
      input.value = '';
      toast(`Папка «${name}» создана`, 'success');
    } catch (error) {
      console.error(error);
      toast(error.message || 'Не удалось создать папку', 'error');
    } finally {
      createBtn.disabled = false;
    }
  };

  createBtn.addEventListener('click', createFolder);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      createFolder();
    }
  });
  input.addEventListener('click', (event) => event.stopPropagation());

  row.append(input, createBtn);
  dom.chatCtxFolders.append(row);
  positionChatCtxMenu();
}

/* ============================================================
 *  Настройки пользователя (клик по логотипу): тема, приватность, архив
 * ============================================================ */

function openPrefsModal() {
  renderPrefsModal();
  dom.prefsOverlay.classList.remove('hidden');
}

function closePrefsModal() {
  dom.prefsOverlay.classList.add('hidden');
}

/** Синхронизировать контролы настроек с текущими значениями. */
function renderPrefsModal() {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  dom.prefsThemeToggle.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeChoice === theme);
  });

  const privacy = state.settings?.lastSeenPrivacy === 'nobody' ? 'nobody' : 'all';
  dom.prefsPrivacyToggle.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.privacyChoice === privacy);
  });

  dom.prefsArchiveCount.textContent = String(archivedChats().length);
}

/** Переключить тему оформления (тёмная по умолчанию). */
function setTheme(theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  try {
    localStorage.setItem('beacon-theme', theme);
  } catch (error) { /* приватный режим — тема просто не сохранится */ }
  renderPrefsModal();
}

/* ============================================================
 *  Архив чатов (открывается из настроек)
 * ============================================================ */

function openArchiveModal() {
  renderArchiveList();
  dom.archiveOverlay.classList.remove('hidden');
  dom.prefsArchiveCount.textContent = String(archivedChats().length);
}

function closeArchiveModal() {
  dom.archiveOverlay.classList.add('hidden');
}

/** Список архивированных чатов с кнопкой «Вернуть». */
function renderArchiveList() {
  const chats = archivedChats();
  dom.archiveList.innerHTML = '';
  dom.archiveEmpty.classList.toggle('hidden', chats.length > 0);

  for (const [chatId, chat] of chats) {
    const item = buildChatListItem('div', chatId, chat);
    const restoreBtn = createEl('button', 'unsubscribe-btn', 'Вернуть');
    restoreBtn.type = 'button';
    restoreBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      restoreBtn.disabled = true;
      try {
        await Chat.setChatArchived(state.user.uid, chatId, false);
        toast('Чат возвращён из архива');
      } catch (error) {
        console.error(error);
        toast('Не удалось вернуть чат из архива', 'error');
        restoreBtn.disabled = false;
      }
    });
    item.append(restoreBtn);
    dom.archiveList.append(item);
  }

  hydrateUsers(chats.map(([, chat]) => getPrivatePeerUid(chat)).filter(Boolean));
}

/* ============================================================
 *  Создание опроса (идея 11)
 * ============================================================ */

/** Одна строка варианта ответа в форме опроса. */
function addPollOptionRow(value = '') {
  const row = createEl('div', 'poll-option-row');
  const input = createEl('input', 'input');
  input.type = 'text';
  input.placeholder = 'Вариант ответа';
  input.maxLength = 100;
  input.value = value;

  const remove = createEl('button', 'poll-option-remove', '✕');
  remove.type = 'button';
  remove.title = 'Удалить вариант';
  remove.addEventListener('click', () => {
    if (dom.pollOptions.children.length <= 2) {
      toast('Нужно минимум два варианта');
      return;
    }
    row.remove();
  });

  row.append(input, remove);
  dom.pollOptions.append(row);
}

function openPollModal() {
  if (!state.activeChatId || !state.user) return;
  dom.pollForm.reset();
  dom.pollOptions.innerHTML = '';
  addPollOptionRow();
  addPollOptionRow();
  dom.pollError.classList.add('hidden');
  dom.pollOverlay.classList.remove('hidden');
  dom.pollQuestion.focus();
}

function closePollModal() {
  dom.pollOverlay.classList.add('hidden');
}

/** Отправка опроса: вопрос + 2–10 вариантов, флаг «несколько ответов». */
async function handlePollSubmit(event) {
  event.preventDefault();
  dom.pollError.classList.add('hidden');

  const question = dom.pollQuestion.value.trim();
  const options = [...dom.pollOptions.querySelectorAll('input')]
    .map((input) => input.value.trim())
    .filter(Boolean);

  if (question.length < 3) {
    dom.pollError.textContent = 'Вопрос должен быть длиннее двух символов';
    dom.pollError.classList.remove('hidden');
    return;
  }
  if (options.length < 2) {
    dom.pollError.textContent = 'Добавьте минимум два варианта ответа';
    dom.pollError.classList.remove('hidden');
    return;
  }

  dom.pollSubmit.disabled = true;
  try {
    await Chat.sendPollMessage(state.activeChatId, state.user.uid, {
      question,
      options,
      multiple: dom.pollMultiple.checked,
    });
    closePollModal();
    state.stickToBottom = true;
    toast('Опрос создан', 'success');
  } catch (error) {
    console.error(error);
    dom.pollError.textContent = error.message || 'Не удалось создать опрос';
    dom.pollError.classList.remove('hidden');
  } finally {
    dom.pollSubmit.disabled = false;
  }
}

/* ============================================================
 *  Комментарии к постам канала (идея 13)
 * ============================================================ */

let commentsUnsubscribe = null;

/** Открыть окно комментариев к посту: подписка на /comments/$chat_id/$post_id. */
function openCommentsModal(message) {
  if (!state.activeChatId || !state.user) return;
  state.commentsPost = { chatId: state.activeChatId, msgId: message.id, message };

  // Цитата поста в шапке окна.
  dom.commentsPost.innerHTML = '';
  dom.commentsPost.append(createEl('span', 'comments-post-author', getSenderName(message.sender)));
  dom.commentsPost.append(createEl('span', 'comments-post-text',
    message.poll ? '📊 ' + (message.poll.question || '') : (message.text || '')));

  dom.commentsInput.value = '';
  dom.commentsList.innerHTML = '';
  dom.commentsEmpty.classList.add('hidden');
  dom.commentsOverlay.classList.remove('hidden');
  window.setTimeout(() => dom.commentsInput.focus(), 50);

  commentsUnsubscribe?.();
  commentsUnsubscribe = Chat.subscribeToPostComments(
    state.commentsPost.chatId,
    state.commentsPost.msgId,
    (map) => {
      if (!state.commentsPost || state.commentsPost.msgId !== message.id) return;
      renderComments(map || {});
    },
  );
}

function closeCommentsModal() {
  dom.commentsOverlay.classList.add('hidden');
  commentsUnsubscribe?.();
  commentsUnsubscribe = null;
  state.commentsPost = null;
}

/** Отрисовать список комментариев поста. */
function renderComments(map) {
  const comments = Object.entries(map)
    .map(([id, comment]) => ({ id, ...comment }))
    .sort((a, b) => (a.timestamp - b.timestamp) || String(a.id).localeCompare(String(b.id)));

  dom.commentsList.innerHTML = '';
  dom.commentsEmpty.classList.toggle('hidden', comments.length > 0);

  const senderUids = [];
  for (const comment of comments) {
    const item = createEl('div', 'comment-item');

    const avatar = createEl('div', 'avatar');
    applyProfileAvatar(avatar, Chat.getCachedUserProfile(comment.sender), comment.sender);

    const body = createEl('div', 'comment-body');
    const head = createEl('div', 'comment-head');
    head.append(createEl('span', 'comment-author', comment.sender === state.user?.uid ? 'Вы' : getSenderName(comment.sender)));
    head.append(createEl('span', 'comment-time', formatListTime(comment.timestamp)));
    body.append(head);
    body.append(createEl('div', 'comment-text', comment.text || ''));

    item.append(avatar, body);

    if (comment.sender === state.user?.uid) {
      const del = createEl('button', 'comment-delete', '✕');
      del.type = 'button';
      del.title = 'Удалить комментарий';
      del.addEventListener('click', async () => {
        del.disabled = true;
        try {
          await Chat.deleteComment(state.commentsPost.chatId, state.commentsPost.msgId, comment.id);
        } catch (error) {
          console.error(error);
          toast('Не удалось удалить комментарий', 'error');
          del.disabled = false;
        }
      });
      item.append(del);
    }

    dom.commentsList.append(item);
    senderUids.push(comment.sender);
  }

  hydrateUsers(senderUids);
  dom.commentsList.scrollTop = dom.commentsList.scrollHeight;
}

/* ============================================================
 *  Статистика канала (идея 14, только для админов)
 * ============================================================ */

/** Открыть статистику канала: карточки, график 14 дней, топ постов. */
async function openStatsModal() {
  const chatId = state.activeChatId;
  const chat = state.chats.get(chatId) || null;
  if (!chat || chat.type !== 'channel' || !chat.admins?.[state.user?.uid]) return;

  dom.statsHeading.textContent = `Статистика · ${getChatTitle(chat)}`;
  dom.statsCards.innerHTML = createEl('p', 'stats-empty', 'Считаем…').outerHTML;
  dom.statsChart.innerHTML = '';
  dom.statsTop.innerHTML = '';
  dom.statsOverlay.classList.remove('hidden');

  try {
    const [messages, viewsMap] = await Promise.all([
      Chat.getChatMessages(chatId),
      Chat.getChatViews(chatId),
    ]);
    if (dom.statsOverlay.classList.contains('hidden')) return; // закрыли, пока грузили
    renderStats(chatId, chat, messages || {}, viewsMap || {});
  } catch (error) {
    console.error(error);
    dom.statsCards.innerHTML = '';
    dom.statsCards.append(createEl('p', 'stats-empty', 'Не удалось загрузить статистику'));
  }
}

function closeStatsModal() {
  dom.statsOverlay.classList.add('hidden');
}

/** Карточки (подписчики/посты/просмотры), график за 14 дней и топ постов. */
function renderStats(chatId, chat, messages, viewsMap) {
  const messageList = Object.entries(messages).map(([id, message]) => ({ id, ...message }));
  const subscribers = Number(chat.subscribersCount) || 0;

  const viewCount = (msgId) => Object.keys(viewsMap[msgId] || {}).length;
  const totalViews = messageList.reduce((sum, message) => sum + viewCount(message.id), 0);
  const avgViews = messageList.length ? Math.round(totalViews / messageList.length) : 0;

  // Карточки.
  dom.statsCards.innerHTML = '';
  const cards = [
    [subscribers, plural(subscribers, ['подписчик', 'подписчика', 'подписчиков'])],
    [messageList.length, plural(messageList.length, ['пост', 'поста', 'постов'])],
    [totalViews, pluralViews(totalViews).replace(/^п/, 'П')],
    [`${avgViews}`, 'в среднем на пост'],
  ];
  for (const [value, label] of cards) {
    const card = createEl('div', 'stats-card');
    card.append(createEl('div', 'stats-card-value', String(value)));
    card.append(createEl('div', 'stats-card-label', String(label)));
    dom.statsCards.append(card);
  }

  // График: просмотры за последние 14 дней (по времени просмотра).
  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    days.push({ key: day.toDateString(), label: `${day.getDate()}.${day.getMonth() + 1}`, count: 0 });
  }
  const dayIndex = new Map(days.map((day) => [day.key, day]));

  for (const msgViews of Object.values(viewsMap)) {
    for (const ts of Object.values(msgViews || {})) {
      const key = new Date(Number(ts) * 1000).toDateString();
      const day = dayIndex.get(key);
      if (day) day.count += 1;
    }
  }

  const max = Math.max(1, ...days.map((day) => day.count));
  dom.statsChart.innerHTML = '';
  for (const day of days) {
    const col = createEl('div', 'stats-bar-col');
    const bar = createEl('div', `stats-bar${day.count ? '' : ' empty'}`);
    bar.style.height = `${Math.max(3, Math.round((day.count / max) * 82))}px`;
    bar.title = `${day.label}: ${day.count} ${pluralViews(day.count)}`;
    col.append(bar);
    col.append(createEl('span', 'stats-bar-label', day.label));
    dom.statsChart.append(col);
  }

  // Топ-5 постов по просмотрам.
  const top = messageList
    .map((message) => ({ ...message, views: viewCount(message.id) }))
    .filter((message) => message.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  dom.statsTop.innerHTML = '';
  if (!top.length) {
    dom.statsTop.append(createEl('p', 'stats-empty', 'Просмотров пока нет'));
    return;
  }

  top.forEach((message, index) => {
    const item = createEl('div', 'stats-top-item');
    item.append(createEl('span', 'stats-top-rank', `${index + 1}`));

    const body = createEl('div', 'stats-top-body');
    const snippet = message.poll
      ? '📊 ' + (message.poll.question || '')
      : Chat.messageSnippet(message.text || '', 70);
    body.append(createEl('div', 'stats-top-text', snippet || 'Без текста'));
    body.append(createEl('div', 'stats-top-meta',
      `${formatListTime(message.timestamp)} · ${message.views} ${pluralViews(message.views)}`));
    item.append(body);

    item.addEventListener('click', () => {
      closeStatsModal();
      if (state.activeChatId === chatId && !flashMessage(message.id)) {
        toast('Пост не подгружен в историю');
      }
    });
    dom.statsTop.append(item);
  });
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
[dom.obUsername, dom.pfUsername, dom.privateUsername, dom.channelUsername, dom.groupUsername, dom.settingsUsername].forEach(bindUsernameInput);

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
  if (state.user) Chat.setOfflinePresence(state.user.uid).catch(() => {});
  Auth.logout().catch((error) => {
    console.error(error);
    toast('Не удалось выйти из аккаунта', 'error');
  });
});

// --- Боковая панель ---
dom.logoutBtn.addEventListener('click', () => {
  if (state.user) Chat.setOfflinePresence(state.user.uid).catch(() => {});
  Auth.logout().catch((error) => {
    console.error(error);
    toast('Не удалось выйти из аккаунта', 'error');
  });
});

// --- Настройки (клик по логотипу): тема, приватность визита, архив ---
dom.settingsBtn.addEventListener('click', openPrefsModal);
dom.prefsClose.addEventListener('click', closePrefsModal);
dom.prefsOverlay.addEventListener('click', (event) => {
  if (event.target === dom.prefsOverlay) closePrefsModal();
});
dom.prefsThemeToggle.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-theme-choice]');
  if (btn) setTheme(btn.dataset.themeChoice);
});
dom.prefsPrivacyToggle.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-privacy-choice]');
  if (!btn || !state.user) return;
  const value = btn.dataset.privacyChoice === 'nobody' ? 'nobody' : 'all';
  try {
    await Chat.setLastSeenPrivacy(state.user.uid, value);
    state.settings.lastSeenPrivacy = value;
    renderPrefsModal();
    toast(value === 'nobody' ? 'Последний визит скрыт' : 'Последний визит виден всем');
  } catch (error) {
    console.error(error);
    toast('Не удалось сохранить настройку', 'error');
  }
});
dom.prefsArchiveBtn.addEventListener('click', () => {
  closePrefsModal();
  openArchiveModal();
});

// --- Архив чатов ---
dom.archiveClose.addEventListener('click', closeArchiveModal);
dom.archiveOverlay.addEventListener('click', (event) => {
  if (event.target === dom.archiveOverlay) closeArchiveModal();
});

// --- Меню чата в списке (ПКМ / долгое нажатие) ---
dom.chatCtxOverlay.addEventListener('click', (event) => {
  if (event.target === dom.chatCtxOverlay) closeChatCtxMenu();
});
dom.chatCtxOverlay.addEventListener('contextmenu', (event) => event.preventDefault());

// --- Опросы ---
dom.pollBtn.addEventListener('click', openPollModal);
dom.pollClose.addEventListener('click', closePollModal);
dom.pollCancel.addEventListener('click', closePollModal);
dom.pollOverlay.addEventListener('click', (event) => {
  if (event.target === dom.pollOverlay) closePollModal();
});
dom.pollAddOption.addEventListener('click', () => {
  if (dom.pollOptions.children.length >= 10) {
    toast('Не больше 10 вариантов');
    return;
  }
  addPollOptionRow();
  const inputs = dom.pollOptions.querySelectorAll('input');
  inputs[inputs.length - 1]?.focus();
});
dom.pollForm.addEventListener('submit', handlePollSubmit);

// --- Комментарии к постам канала ---
dom.commentsClose.addEventListener('click', closeCommentsModal);
dom.commentsOverlay.addEventListener('click', (event) => {
  if (event.target === dom.commentsOverlay) closeCommentsModal();
});
dom.commentsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const post = state.commentsPost;
  if (!post || !state.user) return;
  const text = dom.commentsInput.value.trim();
  if (!text) return;

  dom.commentsInput.value = '';
  try {
    await Chat.sendComment(post.chatId, post.msgId, state.user.uid, text);
  } catch (error) {
    console.error(error);
    toast('Не удалось отправить комментарий', 'error');
    dom.commentsInput.value = text;
  }
});

// --- Статистика канала ---
dom.statsClose.addEventListener('click', closeStatsModal);
dom.statsOverlay.addEventListener('click', (event) => {
  if (event.target === dom.statsOverlay) closeStatsModal();
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
dom.groupTypeBtns.forEach((btn) => {
  btn.addEventListener('click', () => setGroupTypeChoice(btn.dataset.groupType));
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
    avatar: avatarDraft.custom ? draftAvatar() : (state.profile?.avatar || null),
    onSuccess: () => {
      closeProfileModal();
      updateSidebarUser();
      renderChatList();
      toast('Профиль сохранён', 'success');
    },
  });
});

// --- Модальное окно «Чёрный список» ---
dom.blockedClose.addEventListener('click', () => dom.blockedOverlay.classList.add('hidden'));
dom.blockedOverlay.addEventListener('click', (event) => {
  if (event.target === dom.blockedOverlay) dom.blockedOverlay.classList.add('hidden');
});
dom.profileBlockedBtn.addEventListener('click', () => {
  closeProfileModal();
  openBlockedModal();
});

// --- Модальное окно «Настройки чата» (открывается из меню чата) ---
dom.settingsClose.addEventListener('click', closeSettingsModal);
dom.settingsCancel.addEventListener('click', closeSettingsModal);
dom.settingsOverlay.addEventListener('click', (event) => {
  if (event.target === dom.settingsOverlay) closeSettingsModal();
});
dom.settingsTypeBtns.forEach((btn) => {
  btn.addEventListener('click', () => setSettingsTypeChoice(btn.dataset.settingsType));
});
dom.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const chat = state.chats.get(settingsChatId);
  if (!chat) return;

  dom.settingsError.classList.add('hidden');
  dom.settingsSubmit.disabled = true;
  dom.settingsSubmit.textContent = 'Сохраняем…';
  try {
    await Chat.updateChatSettings(settingsChatId, state.user.uid, {
      title: dom.settingsTitle.value,
      description: dom.settingsDescription.value,
      groupType: chat.type === 'group' ? settingsTypeChoice : undefined,
      username: dom.settingsUsername.value,
    });
    closeSettingsModal();
    toast('Настройки сохранены', 'success');
  } catch (error) {
    console.error(error);
    dom.settingsError.textContent = error.message || 'Не удалось сохранить настройки';
    dom.settingsError.classList.remove('hidden');
  } finally {
    dom.settingsSubmit.disabled = false;
    dom.settingsSubmit.textContent = 'Сохранить';
  }
});
dom.settingsDelete.addEventListener('click', async () => {
  const chat = state.chats.get(settingsChatId);
  if (!chat) return;

  const kind = chat.type === 'channel' ? 'канал' : 'группу';
  if (!window.confirm(`Удалить ${kind} «${getChatTitle(chat)}»? Это действие необратимо.`)) return;

  dom.settingsDelete.disabled = true;
  try {
    await Chat.deleteChat(settingsChatId, state.user.uid);
    closeSettingsModal();
    closeActiveChat();
    toast(chat.type === 'channel' ? 'Канал удалён' : 'Группа удалена');
  } catch (error) {
    console.error(error);
    dom.settingsError.textContent = error.message || 'Не удалось удалить чат';
    dom.settingsError.classList.remove('hidden');
  } finally {
    dom.settingsDelete.disabled = false;
  }
});

// --- Escape закрывает верхнюю открытую модалку ---
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!dom.chatCtxOverlay.classList.contains('hidden')) {
    closeChatCtxMenu();
    return;
  }
  if (!dom.statsOverlay.classList.contains('hidden')) {
    closeStatsModal();
    return;
  }
  if (!dom.commentsOverlay.classList.contains('hidden')) {
    closeCommentsModal();
    return;
  }
  if (!dom.pollOverlay.classList.contains('hidden')) {
    closePollModal();
    return;
  }
  if (!dom.archiveOverlay.classList.contains('hidden')) {
    closeArchiveModal();
    return;
  }
  if (!dom.prefsOverlay.classList.contains('hidden')) {
    closePrefsModal();
    return;
  }
  if (!dom.msgMenuOverlay.classList.contains('hidden')) {
    closeMsgMenu();
    return;
  }
  if (!dom.deleteChoiceOverlay.classList.contains('hidden')) {
    closeDeleteChoice();
    return;
  }
  if (!dom.forwardOverlay.classList.contains('hidden')) {
    closeForwardModal();
    return;
  }
  if (!dom.chatMenuOverlay.classList.contains('hidden')) {
    closeChatMenu();
    return;
  }
  if (!dom.settingsOverlay.classList.contains('hidden')) {
    closeSettingsModal();
    return;
  }
  if (!dom.blockedOverlay.classList.contains('hidden')) {
    dom.blockedOverlay.classList.add('hidden');
    return;
  }
  if (!dom.profileOverlay.classList.contains('hidden')) {
    closeProfileModal();
    return;
  }
  if (!dom.modalOverlay.classList.contains('hidden')) closeModal();
});

// --- Панель чата ---
dom.messageForm.addEventListener('submit', handleSendMessage);

// Поле ввода: Enter отправляет (на тач-устройствах — перенос строки), Shift+Enter — перенос.
dom.messageInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  if (event.shiftKey || event.ctrlKey || event.metaKey || isTouchDevice()) return;
  event.preventDefault();
  dom.messageForm.requestSubmit();
});
dom.messageInput.addEventListener('input', () => {
  autoGrowComposer();
  if (dom.messageInput.value.trim()) notifyTyping();
});
dom.messageInput.addEventListener('paste', () => {
  window.setTimeout(autoGrowComposer, 0);
});

dom.backBtn.addEventListener('click', () => document.body.classList.remove('chat-open'));
dom.previewBackBtn.addEventListener('click', closeChannelPreview);
dom.messages.addEventListener('scroll', () => {
  const el = dom.messages;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  // Пользователь дочитал до конца — снимаем непрочитанное.
  if (atBottom && !state.stickToBottom && state.activeChatId) {
    markActiveChatRead();
    renderChatList();
  }
  state.stickToBottom = atBottom;
});

// Подписка на канал / вступление в публичную группу из предпросмотра.
dom.previewSubscribe.addEventListener('click', async () => {
  const preview = state.channelPreview;
  if (!preview) return;
  const { chatId, chat } = preview;
  const isGroup = chat?.type === 'group';

  if (state.myChatIds.has(chatId)) {
    closeChannelPreview();
    selectChat(chatId);
    return;
  }

  dom.previewSubscribe.disabled = true;
  try {
    if (isGroup) {
      await Chat.joinGroup(state.user.uid, chatId);
      toast('Вы присоединились к группе', 'success');
    } else {
      await Chat.subscribeToChannel(state.user.uid, chatId);
      toast('Вы подписались на канал', 'success');
    }
    closeChannelPreview();
    selectChat(chatId);
  } catch (error) {
    console.error(error);
    toast(isGroup ? 'Не удалось присоединиться к группе' : 'Не удалось подписаться на канал', 'error');
    dom.previewSubscribe.disabled = false;
  }
});

// Меню чата: открывается по клику на аватарку в шапке.
dom.chatMenuBtn.addEventListener('click', openChatMenu);
dom.chatMenuClose.addEventListener('click', closeChatMenu);
dom.chatMenuOverlay.addEventListener('click', (event) => {
  if (event.target === dom.chatMenuOverlay) closeChatMenu();
});

// Меню сообщения: ПКМ / долгое нажатие; стрелочка раскрывает все реакции.
dom.msgMenuOverlay.addEventListener('click', (event) => {
  if (event.target === dom.msgMenuOverlay) closeMsgMenu();
});
dom.msgMenu.addEventListener('contextmenu', (event) => event.preventDefault());
dom.msgMenuMore.addEventListener('click', () => {
  state.msgMenuExpanded = !state.msgMenuExpanded;
  dom.msgMenuAll.classList.toggle('hidden', !state.msgMenuExpanded);
  dom.msgMenuMore.classList.toggle('expanded', state.msgMenuExpanded);
  positionMsgMenu();
});

// Плашка ответа/редактирования над полем ввода.
dom.composerContextCancel.addEventListener('click', cancelComposerMode);

// Плашка закрепа: клик листает закрепы и прыгает к сообщению.
dom.pinBar.addEventListener('click', cyclePin);

// Диалог выбора «удалить у всех / только у меня».
dom.deleteChoiceClose.addEventListener('click', closeDeleteChoice);
dom.deleteChoiceOverlay.addEventListener('click', (event) => {
  if (event.target === dom.deleteChoiceOverlay) closeDeleteChoice();
});
dom.deleteChoiceAll.addEventListener('click', async () => {
  const message = state.pendingDeleteMessage;
  closeDeleteChoice();
  if (message) await removeMessageForEveryone(message);
});
dom.deleteChoiceLocal.addEventListener('click', async () => {
  const message = state.pendingDeleteMessage;
  closeDeleteChoice();
  if (message) await removeMessageLocally(message);
});

// Пересылка: окно выбора чата.
dom.forwardClose.addEventListener('click', closeForwardModal);
dom.forwardOverlay.addEventListener('click', (event) => {
  if (event.target === dom.forwardOverlay) closeForwardModal();
});

// ТВ-пульт и клавиатура: Enter/Space на строке чата открывают её.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target;
  if (target instanceof HTMLElement && target.classList.contains('chat-item')) {
    event.preventDefault();
    target.click();
  }
});

// Разблокировка из плашки над композером.
dom.privateUnblockBtn.addEventListener('click', () => {
  const chat = state.chats.get(state.activeChatId);
  const peerUid = getPrivatePeerUid(chat);
  if (peerUid) setBlocked(peerUid, false);
});

// --- Роутинг по состоянию авторизации ---
Auth.watchAuthState(async (user) => {
  if (!user) {
    teardownSubscriptions();
    state.user = null;
    state.profile = null;
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
