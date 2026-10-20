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
import * as Auth from './services/auth.js?v=24';
import * as Chat from './services/chat.js?v=24';

/* ============================================================
 *  DOM
 * ============================================================ */

const $ = (id) => document.getElementById(id);

const dom = {
  // Экран авторизации
  authScreen: $('auth-screen'),
  authForm: $('auth-form'),
  authEmail: $('auth-email'),
  authIdentifierLabel: $('auth-identifier-label'),
  authIdentifierHint: $('auth-identifier-hint'),
  authPassword: $('auth-password'),
  authError: $('auth-error'),
  authSubmit: $('auth-submit'),
  authToggleMode: $('auth-toggle-mode'),
  authLinkPanel: $('auth-link-panel'),
  authLinkPassword: $('auth-link-password'),
  authLinkSubmit: $('auth-link-submit'),
  authLinkCancel: $('auth-link-cancel'),
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

  // Промо-канал @dev: «подписаться или скрыть»
  devPromoOverlay: $('dev-promo-overlay'),
  devPromoClose: $('dev-promo-close'),
  devPromoAvatar: $('dev-promo-avatar'),
  devPromoTitle: $('dev-promo-title'),
  devPromoMeta: $('dev-promo-meta'),
  devPromoSubscribe: $('dev-promo-subscribe'),
  devPromoHide: $('dev-promo-hide'),

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
  prefsAdminField: $('prefs-admin-field'),
  prefsAdminToggle: $('prefs-admin-toggle'),
  prefsBlockedBtn: $('prefs-blocked-btn'),
  prefsBlockedCount: $('prefs-blocked-count'),
  prefsProviders: $('prefs-providers'),
  prefsPasswordField: $('prefs-password-field'),
  prefsPasswordBtn: $('prefs-password-btn'),

  // Смена пароля (отдельное окно)
  passwordOverlay: $('password-overlay'),
  passwordClose: $('password-close'),
  passwordForm: $('password-form'),
  passwordCurrent: $('password-current'),
  passwordNew: $('password-new'),
  passwordRepeat: $('password-repeat'),
  passwordError: $('password-error'),
  passwordCancel: $('password-cancel'),
  passwordSubmit: $('password-submit'),

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
  settingsAdminsBlock: $('settings-admins-block'),
  settingsAdminsList: $('settings-admins-list'),
  settingsAdminInput: $('settings-admin-input'),
  settingsAdminAdd: $('settings-admin-add'),
  settingsMembersBlock: $('settings-members-block'),
  settingsMembersList: $('settings-members-list'),
  settingsMemberAddRow: $('settings-member-add-row'),
  settingsMemberInput: $('settings-member-input'),
  settingsMemberAdd: $('settings-member-add'),
  settingsAvatarBlock: $('settings-avatar-block'),
  settingsAvatarPreview: $('settings-avatar-preview'),
  settingsAvatarKindBtns: Array.from(document.querySelectorAll('[data-sa-kind]')),
  settingsAvatarValue: $('settings-avatar-value'),
  settingsAvatarBgBtns: Array.from(document.querySelectorAll('[data-sa-bg]')),
  settingsAvatarHex1: $('settings-avatar-hex1'),
  settingsAvatarHex2: $('settings-avatar-hex2'),
  settingsAvatarColorRow2: $('settings-avatar-color-row2'),
  settingsAvatarPalette1: $('settings-avatar-palette1'),
  settingsAvatarPalette2: $('settings-avatar-palette2'),
  settingsAvatarReset: $('settings-avatar-reset'),

  // Уведомления
  toast: $('toast'),

  // Экран блокировки (бан)
  bannedScreen: $('banned-screen'),
  bannedLogout: $('banned-logout'),
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
  unreadDivider: null,      // { chatId, ts } — граница «новых сообщений» при входе в чат
  dividerScrollPending: false, // прокрутить к разделителю после первой отрисовки
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
  devPromoChat: null,       // данные канала @dev для промо-строки вверху списка

  // Супер-админ (тестовые права) и баны
  rootAdmins: new Set(),    // uid из /root_admins
  bannedUsers: new Set(),   // uid из /banned_users (метки в меню чата)
  myBan: null,              // моя запись бана { by, at } или null

  // Счётчики непрочитанных сообщений: chatId -> { key, count }
  unreadCounts: new Map(),
  unreadFetches: new Set(),

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
    devPromo: null,         // /chats/$devChannelId — данные промо-канала @dev
    presence: null,         // .info/connected
    myBan: null,            // /banned_users/$uid
    bans: null,             // /banned_users
    rootAdmins: null,       // /root_admins
    chatScoped: [],         // подписки активного чата (typing, голоса, комментарии…)
    chatScopedId: null,     // id чата, для которого настроены подписки chatScoped
  },
};

let authMode = 'login';     // 'login' | 'register'
let pendingGoogleLink = null; // { email, pendingCredential } — ждём пароль для привязки Google
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

/** Канал-промо @dev: показывается вверху списка, пока пользователь не подписан и не скрыл его. */
const DEV_CHANNEL_ID = '-P4EgAjn7KM6VFk2-rc_';

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

/** Аватарка чата: личный — профиль собеседника, группа/канал — лого или буква названия. */
function applyChatAvatar(node, chatId, chat) {
  if (chat?.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    const profile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
    applyProfileAvatar(node, profile, peerUid || chatId);
    return;
  }
  const fallback = (chat?.title || '?').trim().charAt(0).toUpperCase();
  if (chat?.avatar && chat.avatar.value && chat.avatar.bg1) {
    applyProfileAvatar(node, { avatar: chat.avatar }, chatId, fallback);
    return;
  }
  node.classList.remove('avatar-emoji');
  applyAvatar(node, chatId, fallback);
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

/** Векторные иконки интерфейса (24×24, штрих — currentColor). */
const ICONS = {
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6.5 9.5 17 4 11.5"/></svg>',
  checks:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="17.5 6.5 8 16 3 11"/><polyline points="21 9.5 14.5 16"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-.5 5.2 2.2 3.3a1 1 0 0 1-.83 1.55H7.13a1 1 0 0 1-.83-1.55l2.2-3.3z"/><path d="M12 14v7"/></svg>',
  archive:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v11h16V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg>',
  folder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  eye:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  comment:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
  forward:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>',
  chart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="9"/></svg>',
  ban:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  key:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  google:
    '<svg viewBox="0 0 48 48" fill="none"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  back:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
};

/** Собрать span с SVG-иконкой из набора ICONS. */
function createIcon(name, className = '') {
  const span = createEl('span', className ? `svg-icon ${className}` : 'svg-icon');
  span.innerHTML = ICONS[name] || '';
  return span;
}

/** Включены ли у меня админ-права: супер-админ + переключатель в настройках. */
function adminRightsOn() {
  const uid = state.user?.uid;
  return Boolean(uid && state.rootAdmins.has(uid) && state.settings?.adminMode !== false);
}

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

/** Ключ кэша счётчика непрочитанных: меняется при новом сообщении/прочтении. */
function unreadKey(chatId, chat) {
  return `${chat?.lastMessage?.timestamp || 0}:${Number(state.reads.get(chatId)) || 0}`;
}

/** Обновить значок непрочитанных в конкретном элементе списка. */
function applyUnreadBadge(item, count) {
  if (!item) return;
  const bottom = item.querySelector('.chat-item-bottom');
  if (!bottom) return;
  const old = bottom.querySelector('.unread-dot, .unread-badge');

  if (count > 0) {
    const badge = createEl('span', 'unread-badge', count > 99 ? '99+' : String(count));
    if (old) old.replaceWith(badge);
    else bottom.prepend(badge);
  } else {
    if (old) old.remove();
    item.classList.remove('unread');
  }
}

/** Догрузить точный счётчик непрочитанных (с кэшем по последнему сообщению). */
function ensureUnreadCount(item, chatId, chat) {
  if (!state.user || !isChatUnread(chatId, chat)) return;

  const key = unreadKey(chatId, chat);
  const cached = state.unreadCounts.get(chatId);
  if (cached && cached.key === key) {
    applyUnreadBadge(item, cached.count);
    return;
  }

  const fetchKey = `${chatId}:${key}`;
  if (state.unreadFetches.has(fetchKey)) return;
  state.unreadFetches.add(fetchKey);

  Chat.countUnreadMessages(chatId, state.user.uid, Number(state.reads.get(chatId)) || 0)
    .then((count) => {
      state.unreadCounts.set(chatId, { key, count });
      document.querySelectorAll(`.chat-item[data-chat-id="${CSS.escape(chatId)}"]`)
        .forEach((el) => applyUnreadBadge(el, count));
    })
    .catch((error) => console.error('Не удалось посчитать непрочитанные:', error))
    .finally(() => state.unreadFetches.delete(fetchKey));
}

/** Показывать ли промо-строку @dev: канал загружен, я не подписан и не скрыл его. */
function isDevPromoVisible() {
  if (!state.user || !state.devPromoChat) return false;
  if (state.myChatIds.has(DEV_CHANNEL_ID)) return false;
  return !state.settings?.hideDevPromo;
}

/** Промо-строка канала @dev вверху списка: до выбора «подписаться / скрыть». */
function buildDevPromoItem() {
  const chat = state.devPromoChat;
  const item = createEl('li', 'chat-item dev-promo');
  item.dataset.chatId = DEV_CHANNEL_ID;
  item.tabIndex = 0; // фокус для клавиатуры и ТВ-пульта

  const avatar = createEl('div', 'avatar');
  applyChatAvatar(avatar, DEV_CHANNEL_ID, chat);

  const body = createEl('div', 'chat-item-body');

  const top = createEl('div', 'chat-item-top');
  top.append(createEl('span', 'chat-item-title', getChatTitle(chat)));
  top.append(createEl('span', 'dev-promo-badge', 'Канал'));

  const bottom = createEl('div', 'chat-item-bottom');
  bottom.append(createEl('span', 'chat-item-preview', chat.description || 'Официальный канал проекта — подпишитесь или скройте'));
  const typeIcon = createEl('span', 'chat-type-icon');
  typeIcon.innerHTML = CHAT_TYPE_ICONS.channel || '';
  bottom.append(typeIcon);

  body.append(top, bottom);
  item.append(avatar, body);
  item.addEventListener('click', openDevPromoModal);
  // Промо-строка — не обычный чат: контекстное меню (закрепить/архив/папки) ей не нужно.
  item.addEventListener('contextmenu', (event) => event.preventDefault());

  return item;
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
  if (pinned) top.append(createIcon('pin', 'chat-pin'));
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

  if (unread) ensureUnreadCount(item, chatId, chat);

  return item;
}

/** Отрисовать список диалогов (архив в него не попадает). */
function renderChatList() {
  const chats = visibleChats();
  const showPromo = isDevPromoVisible();
  dom.chatList.innerHTML = '';
  dom.chatListEmpty.classList.toggle('hidden', chats.length > 0 || showPromo);
  dom.chatListEmpty.innerHTML = state.activeFolder !== 'all' && state.myChatIds.size
    ? 'В этой папке пока нет чатов.<br />Добавить чат можно правым кликом по нему в «Все чаты».'
    : 'У вас пока нет чатов.<br />Создайте первый или найдите канал через поиск!';

  const uidsToHydrate = [];

  // Канал @dev — самым верхним, пока пользователь не подписан и не скрыл его.
  if (showPromo) dom.chatList.append(buildDevPromoItem());

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
  state.unreadDivider = null;
  state.dividerScrollPending = false;
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

/**
 * Граница непрочитанных при входе в чат: время моего последнего прочтения.
 * null — новых сообщений нет (последнее сообщение моё или уже прочитано).
 * @returns {{chatId: string, ts: number}|null}
 */
function computeUnreadDivider(chatId) {
  const chat = state.chats.get(chatId) || null;
  const last = chat?.lastMessage;
  if (!last?.timestamp || last.sender === state.user?.uid) return null;
  const mine = Number(state.reads.get(chatId)) || 0;
  if (last.timestamp <= mine) return null;
  return { chatId, ts: mine };
}

/** Разделитель «Новые сообщения» в ленте. */
function buildUnreadDivider() {
  return createEl('div', 'message-unread-divider', 'Новые сообщения');
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
    // Вход в чат с непрочитанными: встаём на границу новых сообщений,
    // а не прокручиваем сразу в самый низ.
    state.unreadDivider = computeUnreadDivider(chatId);
    state.dividerScrollPending = Boolean(state.unreadDivider);
    state.stickToBottom = !state.unreadDivider;

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

  restoreDraftIntoComposer(); // черновик этого чата — в поле ввода
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
  const divider = state.unreadDivider && state.unreadDivider.chatId === state.activeChatId
    ? state.unreadDivider
    : null;

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
  let dividerEl = null;

  for (const message of visible) {
    const dayKey = new Date(message.timestamp * 1000).toDateString();
    if (dayKey !== lastDay) {
      container.append(createEl('div', 'message-day', formatDayLabel(message.timestamp)));
      lastDay = dayKey;
    }
    // Линия «Новые сообщения» — перед первым сообщением после моего прочтения.
    if (!dividerEl && divider && message.timestamp > divider.ts) {
      dividerEl = buildUnreadDivider();
      container.append(dividerEl);
    }
    container.append(buildMessageElement(message, showSender));
    senderUids.push(message.sender);
  }

  // При входе в чат с непрочитанными — прокручиваем к разделителю, а не вниз.
  // Синхронно: rAF в фоновой вкладке может не сработать.
  if (state.dividerScrollPending) {
    state.dividerScrollPending = false;
    if (dividerEl) {
      const containerRect = container.getBoundingClientRect();
      const dividerRect = dividerEl.getBoundingClientRect();
      container.scrollTop += (dividerRect.top - containerRect.top) - 12;
    } else {
      container.scrollTop = container.scrollHeight;
    }
  } else if (wasStick) {
    // Автопрокрутка вниз при новых сообщениях, если пользователь у нижнего края.
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
  const canVote = Chat.canVoteInChat(chat, state.user?.uid, state.myChatIds.has(state.activeChatId));

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
    btn.title = canVote ? (mine ? 'Убрать голос' : 'Голосовать') : 'Голосовать могут только участники и подписчики';

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
    fwd.append(createIcon('forward', 'bubble-forward-icon'));
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
  if (chat?.pinned?.[message.id]) meta.append(createIcon('pin', 'bubble-pin'));
  if (message.editedAt) meta.append(createEl('span', 'bubble-edited', 'изм.'));

  // Галочки прочтения в личных чатах — у своих сообщений (идея 6).
  if (own && chat?.type === 'private') {
    const read = Number(message.timestamp) <= state.peerReadTs;
    const ticks = createIcon(read ? 'checks' : 'check', 'bubble-ticks');
    if (read) ticks.classList.add('read');
    ticks.title = read ? 'Прочитано' : 'Отправлено';
    meta.append(ticks);
  }

  // Просмотры постов канала (идея 14).
  if (chat?.type === 'channel') {
    const views = Object.keys(state.chatViews.get(message.id) || {}).length;
    if (views > 0) {
      const viewsEl = createEl('span', 'bubble-views');
      viewsEl.append(createIcon('eye', 'bubble-views-icon'));
      viewsEl.append(createEl('span', '', String(views)));
      viewsEl.title = `Просмотры: ${views}`;
      meta.append(viewsEl);
    }
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
    btn.append(createIcon('comment', 'bubble-comments-icon'));
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
        // Открыты настройки чата — обновляем списки администраторов/участников.
        if (chatId === settingsChatId && !dom.settingsOverlay.classList.contains('hidden')) {
          if (chat) {
            if (chat.type === 'channel') renderSettingsAdmins(chat);
            if (chat.type === 'group') renderSettingsMembers(chat);
          } else closeSettingsModal();
        }
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

  // Промо-канал @dev: данные для верхней строки списка (пока не подписан).
  state.subscriptions.devPromo = Chat.subscribeToChat(DEV_CHANNEL_ID, (chat) => {
    state.devPromoChat = chat || null;
    renderChatList();
  });

  // Архив, закреп и папки — личные настройки списка чатов.
  state.subscriptions.userMeta = Chat.subscribeToUserChatMeta(uid, (map) => {
    state.chatMeta = new Map(Object.entries(map || {}));
    renderChatList();
    if (!dom.archiveOverlay.classList.contains('hidden')) renderArchiveList();
    if (!dom.chatCtxOverlay.classList.contains('hidden')) {
      // Если открыто подменю папок — остаёмся в нём (обновляем галочки).
      if (!dom.chatCtxFolders.classList.contains('hidden')) renderChatCtxFolders();
      else renderChatCtxMenu();
    }
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
    renderChatList(); // скрытие промо-канала @dev могло измениться с другого устройства
  });
  state.subscriptions.presence = Chat.startPresence(uid);

  // Супер-администраторы и баны (тестовые права модерации).
  state.subscriptions.rootAdmins = Chat.subscribeToRootAdmins((map) => {
    state.rootAdmins = new Set(Object.keys(map || {}).filter((key) => map[key]));
    renderPrefsModal();
    if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
  });
  state.subscriptions.bans = Chat.subscribeToBans((map) => {
    state.bannedUsers = new Set(Object.keys(map || {}).filter((key) => map[key]));
    if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
  });

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
  state.subscriptions.devPromo?.();
  state.subscriptions.presence?.();
  state.subscriptions.myBan?.();
  state.subscriptions.bans?.();
  state.subscriptions.rootAdmins?.();
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
  state.subscriptions.devPromo = null;
  state.subscriptions.presence = null;
  state.subscriptions.myBan = null;
  state.subscriptions.bans = null;
  state.subscriptions.rootAdmins = null;
  state.subscriptions.chatMeta.clear();
  state.chats.clear();
  state.myChatIds = new Set();
  state.activeChatId = null;
  state.messages = [];
  state.stickToBottom = true;
  state.channelPreview = null;
  state.devPromoChat = null;
  state.blocked = new Set();
  state.localDeleted = new Set();
  state.chatMeta = new Map();
  state.folders = new Map();
  state.activeFolder = 'all';
  state.reads = new Map();
  state.presence = new Map();
  state.rootAdmins = new Set();
  state.bannedUsers = new Set();
  state.myBan = null;
  state.unreadCounts = new Map();
  state.unreadFetches = new Set();
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
  hideBannedScreen();

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
  hideBannedScreen();
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
  dom.authEmail.autocomplete = isRegister ? 'email' : 'username';
  dom.authIdentifierLabel.textContent = isRegister ? 'Email' : 'Email или юзернейм';
  dom.authIdentifierHint.textContent = isRegister
    ? 'Для регистрации нужна почта.'
    : 'Можно войти по почте или по @username.';
  dom.authEmail.placeholder = isRegister
    ? 'smotritel@mayak.ru'
    : 'smotritel@mayak.ru или @smotritel_mayaka';

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
function draftAvatar(from = avatarDraft) {
  const value = from.kind === 'letter'
    ? from.value.replace(/[^0-9A-Za-zА-Яа-яЁё]/g, '').charAt(0).toUpperCase()
    : [...from.value].slice(0, 4).join('');
  if (!value) return null;
  return from.bgType === 'gradient'
    ? { kind: from.kind, value, bgType: 'gradient', bg1: from.bg1, bg2: from.bg2, size: from.size }
    : { kind: from.kind, value, bgType: 'solid', bg1: from.bg1, size: from.size };
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

/* --- Черновики: localStorage, отдельный для каждого чата --- */

const DRAFT_PREFIX = 'beacon-draft:';

/** Ключ черновика чата в localStorage. */
function draftKey(chatId) {
  return `${DRAFT_PREFIX}${chatId}`;
}

/** Сохранить черновик чата (пустой текст — удаляем запись). */
function saveDraft(chatId, value) {
  if (!chatId) return;
  try {
    const text = String(value ?? '');
    if (text.trim()) localStorage.setItem(draftKey(chatId), text);
    else localStorage.removeItem(draftKey(chatId));
  } catch (error) { /* приватный режим — черновик просто не сохранится */ }
}

/** Черновик чата ('' — черновика нет). */
function loadDraft(chatId) {
  if (!chatId) return '';
  try {
    return localStorage.getItem(draftKey(chatId)) || '';
  } catch (error) {
    return '';
  }
}

/** Убрать черновик чата (после отправки). */
function clearDraft(chatId) {
  if (!chatId) return;
  try {
    localStorage.removeItem(draftKey(chatId));
  } catch (error) { /* ignore */ }
}

/** Подставить черновик активного чата в поле ввода. */
function restoreDraftIntoComposer() {
  dom.messageInput.value = loadDraft(state.activeChatId);
  autoGrowComposer();
}

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
  restoreDraftIntoComposer(); // вернуть в поле черновик чата
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
  if (mode?.type !== 'edit') clearDraft(state.activeChatId);
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
    if (mode?.type !== 'edit') saveDraft(state.activeChatId, text);
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

/** Удаление: своё — выбор «у всех / только у меня»; чужое — сразу «у меня» (супер-админ может удалить у всех). */
function requestDeleteMessage(message) {
  const own = message.sender === state.user?.uid;
  if (!own && !adminRightsOn()) {
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

/** Забанить/разбанить пользователя — супер-админ, режим тестирования. */
async function setUserBanned(targetUid, banned) {
  if (!targetUid || !state.user) return;
  const name = getSenderName(targetUid);

  if (banned && !window.confirm(`Забанить ${name}? Пользователь не сможет пользоваться мессенджером.`)) return;

  try {
    if (banned) await Chat.banUser(targetUid, state.user.uid);
    else await Chat.unbanUser(targetUid);
    toast(banned ? `${name} забанен` : `${name} разбанен`);
    if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
  } catch (error) {
    console.error(error);
    toast('Не удалось изменить бан', 'error');
  }
}

/** Показать экран блокировки (бан). */
function showBannedScreen() {
  dom.bannedScreen.classList.remove('hidden');
}

/** Скрыть экран блокировки. */
function hideBannedScreen() {
  dom.bannedScreen.classList.add('hidden');
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

/* ============================================================
 *  Промо-канал @dev: верхняя строка списка чатов
 * ============================================================ */

/** Открыть диалог «подписаться или скрыть» для канала @dev. */
function openDevPromoModal() {
  renderDevPromoModal();
  dom.devPromoOverlay.classList.remove('hidden');
}

/** Закрыть диалог промо-канала (крестик, клик по фону, Escape). */
function closeDevPromoModal() {
  dom.devPromoOverlay.classList.add('hidden');
  dom.devPromoSubscribe.disabled = false;
  dom.devPromoHide.disabled = false;
}

/** Наполнить диалог данными канала @dev. */
function renderDevPromoModal() {
  const chat = state.devPromoChat || {};
  applyChatAvatar(dom.devPromoAvatar, DEV_CHANNEL_ID, chat);
  dom.devPromoTitle.textContent = getChatTitle(chat);
  dom.devPromoMeta.textContent = getChatStatus(chat);
}

/** Открыть настройки чата (действие «Настройки» в меню чата). */
function openSettingsModal() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) return;

  settingsChatId = state.activeChatId;
  const myUid = state.user?.uid;
  const isOwner = Boolean(chat.owner && chat.owner === myUid);
  const isGroup = chat.type === 'group';
  const isChannel = chat.type === 'channel';
  const isGroupAdmin = isGroup && Boolean(chat.admins?.[myUid]);
  const rootAdmin = adminRightsOn();
  // Тип, юзернейм и удаление — только владелец (или супер-админ).
  const canManageGroupMeta = isOwner || rootAdmin;
  // Добавлять участников могут владелец, админы группы и супер-админ.
  const canManageMembers = isGroup && (isOwner || isGroupAdmin || rootAdmin);

  dom.settingsHeading.textContent = isGroup ? 'Настройки группы' : 'Настройки канала';
  dom.settingsTitle.value = chat.title || '';
  dom.settingsDescription.value = chat.description || '';
  dom.settingsGroupBlock.classList.toggle('hidden', !isGroup || !canManageGroupMeta);
  setSettingsTypeChoice(chat.groupType === 'public' ? 'public' : 'private');
  // Админ группы не меняет тип и юзернейм — скрываем поле от него.
  dom.settingsUsernameField.classList.toggle(
    'hidden',
    !isGroup || !canManageGroupMeta || settingsTypeChoice !== 'public',
  );
  dom.settingsUsername.value = chat.username || '';

  // Участники группы: список + добавление по @username или ID.
  dom.settingsMembersBlock.classList.toggle('hidden', !isGroup);
  dom.settingsMemberAddRow.classList.toggle('hidden', !canManageMembers);
  dom.settingsMemberInput.value = '';
  if (isGroup) renderSettingsMembers(chat);

  // Администраторы канала: блок виден только для каналов.
  dom.settingsAdminsBlock.classList.toggle('hidden', !isChannel);
  dom.settingsAdminInput.value = '';
  if (isChannel) renderSettingsAdmins(chat);

  // Аватар группы / логотип канала — у обоих типов.
  const hasAvatarEditor = isGroup || isChannel;
  dom.settingsAvatarBlock.classList.toggle('hidden', !hasAvatarEditor);
  const avatarLabel = dom.settingsAvatarBlock.querySelector('label');
  if (avatarLabel) avatarLabel.textContent = isChannel ? 'Логотип канала' : 'Аватар группы';
  dom.settingsAvatarReset.textContent = isChannel ? 'Убрать логотип' : 'Убрать аватар';
  if (hasAvatarEditor) initChatAvatarEditor(chat);

  // Удалять чат может только владелец (или супер-админ).
  dom.settingsDelete.classList.toggle('hidden', !canManageGroupMeta);

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

/**
 * Список администраторов канала в окне настроек: владелец помечен,
 * у остальных — кнопка снятия.
 */
function renderSettingsAdmins(chat) {
  dom.settingsAdminsList.innerHTML = '';
  const adminUids = Object.keys(chat.admins || {});
  if (!adminUids.length) {
    dom.settingsAdminsList.append(createEl('div', 'admin-empty', 'Администраторов пока нет.'));
    return;
  }

  // Владелец канала — всегда первым в списке.
  adminUids.sort((a, b) => (a === chat.owner ? -1 : b === chat.owner ? 1 : 0));

  const missing = [];
  for (const uid of adminUids) {
    const profile = Chat.getCachedUserProfile(uid);
    if (profile === undefined) missing.push(uid);

    const item = createEl('div', 'chat-item');

    const avatar = createEl('div', 'avatar avatar-sm');
    applyProfileAvatar(avatar, profile, uid);

    const body = createEl('div', 'chat-item-body');
    const top = createEl('div', 'chat-item-top');
    top.append(createEl('span', 'chat-item-title', getProfileName(profile) || 'Пользователь'));
    const bottom = createEl('div', 'chat-item-bottom');
    bottom.append(createEl('span', 'chat-item-preview',
      uid === chat.owner ? 'владелец канала' : (profile?.username ? '@' + profile.username : 'администратор')));
    body.append(top, bottom);
    item.append(avatar, body);

    if (uid !== chat.owner) {
      const remove = createEl('button', 'unsubscribe-btn', 'Снять');
      remove.type = 'button';
      remove.addEventListener('click', () => removeSettingsAdmin(uid, remove));
      item.append(remove);
    }

    dom.settingsAdminsList.append(item);
  }

  // Профили могли ещё не загрузиться — догружаем и перерисовываем.
  if (missing.length) {
    hydrateUsers(missing).then(() => {
      if (!settingsChatId || dom.settingsOverlay.classList.contains('hidden')) return;
      const live = state.chats.get(settingsChatId);
      if (live) renderSettingsAdmins(live);
    });
  }
}

/** Снять администратора канала (кнопка «×» в списке настроек). */
async function removeSettingsAdmin(uid, buttonEl) {
  if (!settingsChatId || !state.user) return;
  buttonEl.disabled = true;
  try {
    await Chat.removeChannelAdmin(settingsChatId, state.user.uid, uid);
    toast('Администратор снят');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось снять администратора', 'error');
  } finally {
    buttonEl.disabled = false;
  }
}

/** Добавить администратора канала по @username или ID (кнопка в настройках). */
async function addSettingsAdmin() {
  const chat = state.chats.get(settingsChatId);
  if (!chat || chat.type !== 'channel' || !state.user) return;
  const query = dom.settingsAdminInput.value.trim();
  if (!query) {
    dom.settingsAdminInput.focus();
    return;
  }

  dom.settingsAdminAdd.disabled = true;
  try {
    // Сначала ищем по @username, затем пробуем как ID пользователя.
    let targetUid = null;
    const byUsername = await Chat.getUserByUsername(query).catch(() => null);
    if (byUsername) targetUid = byUsername.uid;
    else targetUid = query;

    await Chat.addChannelAdmin(settingsChatId, state.user.uid, targetUid);
    dom.settingsAdminInput.value = '';
    toast('Администратор добавлен', 'success');
    renderSettingsAdmins(state.chats.get(settingsChatId) || chat);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось добавить администратора', 'error');
  } finally {
    dom.settingsAdminAdd.disabled = false;
  }
}

/**
 * Список участников группы в окне настроек. Владелец и супер-админ могут
 * назначать и снимать администраторов прямо из списка.
 */
function renderSettingsMembers(chat) {
  dom.settingsMembersList.innerHTML = '';
  const uids = Object.keys(chat.users || {});
  if (!uids.length) {
    dom.settingsMembersList.append(createEl('div', 'admin-empty', 'В группе пока нет участников.'));
    return;
  }

  const myUid = state.user?.uid;
  const canManageAdmins = Boolean(chat.owner && chat.owner === myUid) || adminRightsOn();
  const rank = (uid) => (uid === chat.owner ? 0 : chat.admins?.[uid] ? 1 : 2);
  const cachedName = (uid) => getProfileName(Chat.getCachedUserProfile(uid)) || '';
  uids.sort((a, b) => rank(a) - rank(b) || cachedName(a).localeCompare(cachedName(b), 'ru') || a.localeCompare(b));

  const missing = [];
  for (const uid of uids) {
    const profile = Chat.getCachedUserProfile(uid);
    if (profile === undefined) missing.push(uid);

    const item = createEl('div', 'chat-item');

    const avatar = createEl('div', 'avatar avatar-sm');
    applyProfileAvatar(avatar, profile, uid);

    const isAdmin = Boolean(chat.admins?.[uid]);
    const body = createEl('div', 'chat-item-body');
    const top = createEl('div', 'chat-item-top');
    top.append(createEl('span', 'chat-item-title', getProfileName(profile) || 'Пользователь'));
    const bottom = createEl('div', 'chat-item-bottom');
    bottom.append(createEl('span', 'chat-item-preview',
      uid === chat.owner
        ? 'владелец группы'
        : isAdmin
          ? 'администратор'
          : (profile?.username ? '@' + profile.username : 'участник')));
    body.append(top, bottom);
    item.append(avatar, body);

    if (canManageAdmins && uid !== chat.owner) {
      const toggle = createEl(
        'button',
        isAdmin ? 'unsubscribe-btn' : 'make-admin-btn',
        isAdmin ? 'Снять' : 'Админ',
      );
      toggle.type = 'button';
      toggle.title = isAdmin ? 'Снять администратора' : 'Сделать администратором';
      toggle.addEventListener('click', () => toggleSettingsGroupAdmin(uid, !isAdmin, toggle));
      item.append(toggle);
    }

    dom.settingsMembersList.append(item);
  }

  // Профили могли ещё не загрузиться — догружаем и перерисовываем.
  if (missing.length) {
    hydrateUsers(missing).then(() => {
      if (!settingsChatId || dom.settingsOverlay.classList.contains('hidden')) return;
      const live = state.chats.get(settingsChatId);
      if (live) renderSettingsMembers(live);
    });
  }
}

/** Назначить или снять администратора группы из списка участников. */
async function toggleSettingsGroupAdmin(uid, makeAdmin, buttonEl) {
  if (!settingsChatId || !state.user) return;
  buttonEl.disabled = true;
  try {
    if (makeAdmin) await Chat.addGroupAdmin(settingsChatId, state.user.uid, uid);
    else await Chat.removeGroupAdmin(settingsChatId, state.user.uid, uid);
    toast(makeAdmin ? 'Администратор назначен' : 'Администратор снят');

    // Подписка на чат обновит state.chats; перечитываем для мгновенного отклика.
    const live = await Chat.getChat(settingsChatId);
    if (live) {
      state.chats.set(settingsChatId, live);
      if (!dom.settingsOverlay.classList.contains('hidden')) renderSettingsMembers(live);
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось изменить администратора', 'error');
  } finally {
    buttonEl.disabled = false;
  }
}

/** Добавить участника в группу по @username или ID (кнопка в настройках). */
async function addSettingsMember() {
  const chat = state.chats.get(settingsChatId);
  if (!chat || chat.type !== 'group' || !state.user) return;
  const query = dom.settingsMemberInput.value.trim();
  if (!query) {
    dom.settingsMemberInput.focus();
    return;
  }

  dom.settingsMemberAdd.disabled = true;
  try {
    // Сначала ищем по @username, затем пробуем как ID пользователя.
    let targetUid = null;
    const byUsername = await Chat.getUserByUsername(query).catch(() => null);
    if (byUsername) targetUid = byUsername.uid;
    else targetUid = query;

    const result = await Chat.addGroupMember(settingsChatId, state.user.uid, targetUid);
    dom.settingsMemberInput.value = '';
    if (result?.added === false) {
      toast('Пользователь уже в группе');
    } else {
      toast('Участник добавлен', 'success');
    }

    const live = await Chat.getChat(settingsChatId);
    if (live) {
      state.chats.set(settingsChatId, live);
      if (!dom.settingsOverlay.classList.contains('hidden')) renderSettingsMembers(live);
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось добавить участника', 'error');
  } finally {
    dom.settingsMemberAdd.disabled = false;
  }
}

/* ============================================================
 *  Логотип канала (редактор в окне настроек канала)
 * ============================================================ */

/** Черновик логотипа канала в окне настроек. */
const chatAvatarDraft = {
  touched: false,     // трогал ли пользователь редактор за этот заход
  removed: false,     // «Убрать логотип» — вернуть стандартную букву названия
  kind: 'letter',     // 'letter' | 'emoji'
  value: '',
  bgType: 'solid',    // 'solid' | 'gradient'
  bg1: AVATAR_COLORS[0],
  bg2: AVATAR_COLORS[2],
  size: 100,
};

/** Залить черновик логотипа данными канала и перерисовать редактор. */
function initChatAvatarEditor(chat) {
  const avatar = chat.avatar || null;
  chatAvatarDraft.touched = false;
  chatAvatarDraft.removed = false;
  chatAvatarDraft.kind = avatar?.kind === 'emoji' ? 'emoji' : 'letter';
  chatAvatarDraft.value = avatar?.value || (chat.title || '?').trim().charAt(0).toUpperCase();
  chatAvatarDraft.bgType = avatar?.bgType === 'gradient' ? 'gradient' : 'solid';
  chatAvatarDraft.bg1 = avatar?.bg1 || AVATAR_COLORS[0];
  chatAvatarDraft.bg2 = avatar?.bg2 || AVATAR_COLORS[2];
  chatAvatarDraft.size = Math.min(200, Math.max(50, Number(avatar?.size) || 100));
  renderChatAvatarEditor();
}

/** Пользователь изменил логотип — черновик считается тронутым. */
function touchChatAvatar() {
  chatAvatarDraft.touched = true;
  chatAvatarDraft.removed = false;
}

/** Перерисовать контролы логотипа и превью (syncInput=false — не трогать поля ввода). */
function renderChatAvatarEditor(syncInput = true) {
  dom.settingsAvatarKindBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.saKind === chatAvatarDraft.kind);
  });
  dom.settingsAvatarBgBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.saBg === chatAvatarDraft.bgType);
  });

  if (syncInput) {
    if (dom.settingsAvatarValue.value !== chatAvatarDraft.value) dom.settingsAvatarValue.value = chatAvatarDraft.value;
    dom.settingsAvatarValue.maxLength = chatAvatarDraft.kind === 'letter' ? 1 : 4;
    dom.settingsAvatarValue.placeholder = chatAvatarDraft.kind === 'letter' ? 'А' : '💡';
    if (normalizeHex(dom.settingsAvatarHex1.value) !== chatAvatarDraft.bg1) dom.settingsAvatarHex1.value = chatAvatarDraft.bg1;
    if (normalizeHex(dom.settingsAvatarHex2.value) !== chatAvatarDraft.bg2) dom.settingsAvatarHex2.value = chatAvatarDraft.bg2;
    dom.settingsAvatarHex1.classList.remove('invalid');
    dom.settingsAvatarHex2.classList.remove('invalid');
  }

  dom.settingsAvatarColorRow2.classList.toggle('hidden', chatAvatarDraft.bgType !== 'gradient');
  dom.settingsAvatarPalette2.classList.toggle('hidden', chatAvatarDraft.bgType !== 'gradient');
  dom.settingsAvatarPalette1.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color === chatAvatarDraft.bg1);
  });
  dom.settingsAvatarPalette2.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color === chatAvatarDraft.bg2);
  });

  // Превью: кастомный логотип либо стандартная буква названия.
  const chat = state.chats.get(settingsChatId) || { title: dom.settingsTitle.value };
  const draft = chatAvatarDraft.removed ? null : draftAvatar(chatAvatarDraft);
  if (draft) {
    applyProfileAvatar(
      dom.settingsAvatarPreview,
      { avatar: draft },
      settingsChatId || 'chat',
      (chat.title || '?').trim().charAt(0).toUpperCase(),
    );
  } else {
    applyChatAvatar(dom.settingsAvatarPreview, settingsChatId || 'chat', { type: chat.type || 'channel', title: chat.title });
  }
}

buildPalette(dom.settingsAvatarPalette1, (color) => {
  touchChatAvatar();
  chatAvatarDraft.bg1 = color;
  renderChatAvatarEditor();
});
buildPalette(dom.settingsAvatarPalette2, (color) => {
  touchChatAvatar();
  chatAvatarDraft.bg2 = color;
  renderChatAvatarEditor();
});

dom.settingsAvatarKindBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    touchChatAvatar();
    chatAvatarDraft.kind = btn.dataset.saKind === 'emoji' ? 'emoji' : 'letter';
    if (chatAvatarDraft.kind === 'letter' && chatAvatarDraft.value) {
      chatAvatarDraft.value = chatAvatarDraft.value.charAt(0).toUpperCase();
    }
    renderChatAvatarEditor();
  });
});
dom.settingsAvatarBgBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    touchChatAvatar();
    chatAvatarDraft.bgType = btn.dataset.saBg === 'gradient' ? 'gradient' : 'solid';
    renderChatAvatarEditor();
  });
});
dom.settingsAvatarValue.addEventListener('input', () => {
  touchChatAvatar();
  chatAvatarDraft.value = dom.settingsAvatarValue.value;
  renderChatAvatarEditor(false); // не трогаем само поле, чтобы не прыгал курсор
});
dom.settingsAvatarReset.addEventListener('click', () => {
  chatAvatarDraft.touched = true;
  chatAvatarDraft.removed = true;
  chatAvatarDraft.kind = 'letter';
  chatAvatarDraft.value = '';
  chatAvatarDraft.bgType = 'solid';
  chatAvatarDraft.bg1 = AVATAR_COLORS[0];
  chatAvatarDraft.bg2 = AVATAR_COLORS[2];
  renderChatAvatarEditor();
});

/** Свои hex-цвета для фона логотипа (окно настроек канала). */
function bindChatAvatarHexInput(inputEl, key) {
  inputEl.addEventListener('input', () => {
    const hex = normalizeHex(inputEl.value);
    inputEl.classList.toggle('invalid', !hex && inputEl.value.trim() !== '');
    if (!hex) return;
    touchChatAvatar();
    chatAvatarDraft[key] = hex;
    renderChatAvatarEditor(false); // не трогаем поля, чтобы не прыгал курсор
  });
  inputEl.addEventListener('blur', () => {
    inputEl.classList.remove('invalid');
    inputEl.value = chatAvatarDraft[key];
  });
}
bindChatAvatarHexInput(dom.settingsAvatarHex1, 'bg1');
bindChatAvatarHexInput(dom.settingsAvatarHex2, 'bg2');

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

/** Кнопка-действие в меню чата (опционально с SVG-иконкой). */
function addChatMenuAction(label, onClick, iconName = null) {
  const btn = createEl('button', 'btn ghost menu-action');
  btn.type = 'button';
  if (iconName) btn.append(createIcon(iconName, 'menu-action-icon'));
  btn.append(document.createTextNode(label));
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
  const isGroupAdmin = chat.type === 'group' && Boolean(chat.admins?.[myUid]);
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
  const rootAdmin = adminRightsOn();

  if (chat.type === 'private') {
    if (peerUid) {
      const blocked = state.blocked.has(peerUid);
      addChatMenuAction(blocked ? 'Разблокировать' : 'Заблокировать', () => {
        setBlocked(peerUid, !blocked);
      });

      // Бан пользователя: только супер-админ с включёнными админ-правами.
      if (rootAdmin && peerUid !== myUid) {
        const banned = state.bannedUsers.has(peerUid);
        addChatMenuAction(banned ? 'Разбанить пользователя' : 'Забанить пользователя', () => {
          setUserBanned(peerUid, !banned);
        }, 'ban');
      }
    }
  } else if (isOwner || rootAdmin || isGroupAdmin) {
    addChatMenuAction('Настройки', () => {
      closeChatMenu();
      openSettingsModal();
    });
  }
  if (chat.type === 'channel' && chat.owner !== myUid && state.myChatIds.has(state.activeChatId)) {
    addChatMenuAction('Отписаться от канала', unsubscribeFromActiveChannel);
  }

  // Статистика канала — администраторам канала и супер-админу (идея 14).
  if (chat.type === 'channel' && (chat.admins?.[myUid] || rootAdmin)) {
    addChatMenuAction('Статистика канала', () => {
      closeChatMenu();
      openStatsModal();
    }, 'chart');
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

/** Отписаться от канала (действие в меню чата). Админ при выходе теряет права. */
async function unsubscribeFromActiveChannel() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat || chat.type !== 'channel') return;
  if (chat.owner === state.user.uid) return;

  const isAdmin = Boolean(chat.admins?.[state.user.uid]);
  const question = isAdmin
    ? `Покинуть канал «${getChatTitle(chat)}»? Права администратора будут сняты.`
    : `Отписаться от канала «${getChatTitle(chat)}»?`;
  if (!window.confirm(question)) return;

  try {
    await Chat.unsubscribeFromChannel(state.user.uid, state.activeChatId);
    closeChatMenu();
    toast(isAdmin ? 'Вы покинули канал' : 'Вы отписались от канала');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось отписаться от канала', 'error');
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

  const addAction = (icon, label, handler) => {
    const btn = createEl('button', 'ctx-action');
    btn.type = 'button';
    if (icon) btn.append(createIcon(icon, 'ctx-icon'));
    btn.append(createEl('span', 'ctx-label', label));
    btn.addEventListener('click', handler);
    dom.chatCtxActions.append(btn);
    return btn;
  };

  addAction('pin', meta.pinnedAt ? 'Открепить' : 'Закрепить', async () => {
    closeChatCtxMenu();
    try {
      await Chat.setChatPinned(state.user.uid, chatId, !meta.pinnedAt);
      toast(meta.pinnedAt ? 'Чат откреплён' : 'Чат закреплён');
    } catch (error) {
      console.error(error);
      toast('Не удалось закрепить чат', 'error');
    }
  });

  addAction('archive', meta.archived ? 'Вернуть из архива' : 'Архивировать', async () => {
    closeChatCtxMenu();
    try {
      await Chat.setChatArchived(state.user.uid, chatId, !meta.archived);
      toast(meta.archived ? 'Чат возвращён из архива' : 'Чат убран в архив');
    } catch (error) {
      console.error(error);
      toast('Не удалось обновить архив', 'error');
    }
  });

  addAction('folder', 'Переместить в папку', openChatCtxFolders);

  // Основной вид — действия; папки открываются кнопкой «Переместить в папку».
  dom.chatCtxActions.classList.remove('hidden');
  dom.chatCtxFolders.classList.add('hidden');
  positionChatCtxMenu();
}

/** Показать подменю «Переместить в папку». */
function openChatCtxFolders() {
  dom.chatCtxActions.classList.add('hidden');
  dom.chatCtxFolders.classList.remove('hidden');
  renderChatCtxFolders();
}

/** Вернуться к списку действий меню. */
function closeChatCtxFolders() {
  dom.chatCtxFolders.classList.add('hidden');
  dom.chatCtxActions.classList.remove('hidden');
  positionChatCtxMenu();
}

/** Список папок в меню чата: отметки, удаление папки и создание новой. */
function renderChatCtxFolders() {
  const chatId = state.chatCtxChatId;
  if (!chatId) return;

  const meta = getChatMeta(chatId);
  dom.chatCtxFolders.innerHTML = '';

  // Шапка подменю: кнопка «Назад» + заголовок.
  const head = createEl('div', 'ctx-subhead');
  const backBtn = createEl('button', 'ctx-back-btn');
  backBtn.type = 'button';
  backBtn.title = 'Назад';
  backBtn.append(createIcon('back'));
  backBtn.addEventListener('click', closeChatCtxFolders);
  head.append(backBtn, createEl('span', 'ctx-title', 'Переместить в папку'));
  dom.chatCtxFolders.append(head);

  const folders = [...state.folders.entries()].sort((a, b) => (
    (Number(a[1]?.createdAt) || 0) - (Number(b[1]?.createdAt) || 0)
  ));

  if (!folders.length) {
    dom.chatCtxFolders.append(createEl('div', 'ctx-empty', 'Папок пока нет — создайте первую ниже.'));
  }

  for (const [folderId, folder] of folders) {
    const member = Boolean(meta.folders?.[folderId]);
    const row = createEl('div', 'ctx-folder-row');

    const btn = createEl('button', `ctx-action${member ? ' ctx-action-active' : ''}`);
    btn.type = 'button';
    const check = createEl('span', 'ctx-check');
    if (member) check.append(createIcon('check'));
    btn.append(check);
    btn.append(createEl('span', 'ctx-label', folder?.name || 'Папка'));
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

    const del = createEl('button', 'ctx-folder-del');
    del.type = 'button';
    del.title = 'Удалить папку';
    del.append(createIcon('trash'));
    del.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteFolderWithConfirm(folderId, folder?.name || 'Папка');
    });

    row.append(btn, del);
    dom.chatCtxFolders.append(row);
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

/** Удалить папку после подтверждения (чат остаётся в «Все чаты»). */
async function deleteFolderWithConfirm(folderId, name) {
  if (!window.confirm(`Удалить папку «${name}»? Чаты из неё останутся в «Все чаты».`)) return;
  try {
    await Chat.deleteUserFolder(state.user.uid, folderId);
    toast(`Папка «${name}» удалена`);
  } catch (error) {
    console.error(error);
    toast('Не удалось удалить папку', 'error');
  }
}

/* ============================================================
 *  Настройки пользователя (клик по логотипу): тема, приватность, архив
 * ============================================================ */

function openPrefsModal() {
  renderPrefsModal();
  dom.prefsOverlay.classList.remove('hidden');
}

function closePrefsModal() {
  closePasswordModal();
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
  dom.prefsBlockedCount.textContent = String(state.blocked.size);
  renderPrefsProviders();

  // Админ-права: поле видно только супер-администраторам.
  const isRoot = Boolean(state.user && state.rootAdmins.has(state.user.uid));
  dom.prefsAdminField.classList.toggle('hidden', !isRoot);
  dom.prefsAdminToggle.checked = isRoot && state.settings?.adminMode !== false;
}

/** Способы входа (пароль / Google): строки со статусом и кнопками. */
function renderPrefsProviders() {
  dom.prefsProviders.innerHTML = '';
  const providers = Auth.getLinkedProviders();
  const canUnlink = providers.length > 1;

  const rows = [
    { id: 'password', label: 'Пароль (email)', icon: 'key' },
    { id: 'google.com', label: 'Google', icon: 'google' },
  ];

  rows.forEach(({ id, label, icon }) => {
    const linked = providers.includes(id);
    const row = createEl('div', 'provider-row');

    const info = createEl('div', 'provider-info');
    const name = createEl('span', 'provider-name', label);
    name.prepend(createIcon(icon, 'provider-icon'));
    info.append(name);
    info.append(createEl('span', 'provider-status', linked ? 'Привязан' : 'Не привязан'));
    row.append(info);

    if (linked) {
      if (canUnlink) {
        const btn = createEl('button', 'btn ghost provider-btn', 'Отвязать');
        btn.type = 'button';
        btn.addEventListener('click', () => unlinkProviderClick(id, label));
        row.append(btn);
      } else {
        row.append(createEl('span', 'provider-hint', 'единственный способ'));
      }
    } else if (id === 'google.com') {
      const btn = createEl('button', 'btn ghost provider-btn', 'Привязать');
      btn.type = 'button';
      btn.addEventListener('click', () => linkGoogleClick(btn));
      row.append(btn);
    } else if (id === 'password') {
      // Аккаунт без пароля (например, только Google): можно задать пароль —
      // после этого вход доступен любым из привязанных способов.
      const input = createEl('input', 'provider-pass-input');
      input.type = 'password';
      input.placeholder = 'Новый пароль';
      input.autocomplete = 'new-password';
      const btn = createEl('button', 'btn ghost provider-btn', 'Задать пароль');
      btn.type = 'button';
      btn.addEventListener('click', () => linkPasswordClick(input, btn));
      row.append(input, btn);
    } else {
      row.append(createEl('span', 'provider-hint', 'не привязан'));
    }

    dom.prefsProviders.append(row);
  });

  // Кнопка смены пароля — только аккаунтам с привязанным паролем.
  dom.prefsPasswordField.classList.toggle('hidden', !providers.includes('password'));
}

/** Привязать Google к текущему аккаунту (кнопка в настройках). */
async function linkGoogleClick(btn) {
  btn.disabled = true;
  try {
    await Auth.linkGoogle();
    toast('Google привязан — можно входить любым способом', 'success');
    renderPrefsProviders();
  } catch (error) {
    console.error(error);
    toast(Auth.getAuthErrorMessage(error), 'error');
  } finally {
    btn.disabled = false;
  }
}

/** Задать пароль аккаунту без пароля (например, созданному через Google). */
async function linkPasswordClick(input, btn) {
  const password = String(input.value || '');
  if (password.length < 6) {
    toast('Пароль — минимум 6 символов', 'error');
    input.focus();
    return;
  }

  btn.disabled = true;
  input.disabled = true;
  try {
    await Auth.linkPassword(password);
    toast('Пароль привязан — можно входить любым способом', 'success');
    renderPrefsProviders();
  } catch (error) {
    console.error(error);
    toast(Auth.getAuthErrorMessage(error), 'error');
  } finally {
    btn.disabled = false;
    input.disabled = false;
  }
}

/** Открыть отдельное окно смены пароля. */
function openPasswordModal() {
  if (!Auth.getLinkedProviders().includes('password')) {
    toast('Сначала задайте пароль в разделе «Способы входа»', 'error');
    return;
  }
  resetPasswordForm();
  dom.passwordOverlay.classList.remove('hidden');
  dom.passwordCurrent.focus();
}

/** Закрыть окно смены пароля и очистить поля. */
function closePasswordModal() {
  dom.passwordOverlay.classList.add('hidden');
  resetPasswordForm();
}

/** Привести окно смены пароля в исходное состояние. */
function resetPasswordForm() {
  dom.passwordCurrent.value = '';
  dom.passwordNew.value = '';
  dom.passwordRepeat.value = '';
  dom.passwordError.textContent = '';
  dom.passwordError.classList.add('hidden');
  dom.passwordSubmit.disabled = false;
  dom.passwordSubmit.textContent = 'Сменить пароль';
}

/** Показать ошибку в окне смены пароля. */
function showPasswordError(message, focusEl = null) {
  dom.passwordError.textContent = message;
  dom.passwordError.classList.remove('hidden');
  if (focusEl) focusEl.focus();
}

/** Отправить форму смены пароля. */
async function submitPasswordChange(event) {
  event.preventDefault();
  const current = String(dom.passwordCurrent.value || '');
  const next = String(dom.passwordNew.value || '');
  const repeat = String(dom.passwordRepeat.value || '');

  dom.passwordError.classList.add('hidden');
  if (!current) {
    showPasswordError('Введите текущий пароль', dom.passwordCurrent);
    return;
  }
  if (next.length < 6) {
    showPasswordError('Новый пароль — минимум 6 символов', dom.passwordNew);
    return;
  }
  if (next !== repeat) {
    showPasswordError('Пароли не совпадают', dom.passwordRepeat);
    return;
  }

  dom.passwordSubmit.disabled = true;
  dom.passwordSubmit.textContent = 'Меняем…';
  try {
    await Auth.changePassword(current, next);
    closePasswordModal();
    toast('Пароль изменён — входите с новым', 'success');
  } catch (error) {
    console.error(error);
    const wrong = error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential';
    showPasswordError(Auth.getAuthErrorMessage(error), wrong ? dom.passwordCurrent : null);
  } finally {
    dom.passwordSubmit.disabled = false;
    dom.passwordSubmit.textContent = 'Сменить пароль';
  }
}

/** Отвязать способ входа (кнопка в настройках). */
async function unlinkProviderClick(providerId, label) {
  if (!window.confirm(`Отвязать способ входа «${label}»?`)) return;
  try {
    await Auth.unlinkProvider(providerId);
    toast('Способ входа отвязан');
    renderPrefsProviders();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось отвязать способ входа', 'error');
  }
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

  const remove = createEl('button', 'poll-option-remove');
  remove.type = 'button';
  remove.title = 'Удалить вариант';
  remove.append(createIcon('close'));
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

    if (comment.sender === state.user?.uid || adminRightsOn()) {
      const del = createEl('button', 'comment-delete');
      del.type = 'button';
      del.title = 'Удалить комментарий';
      del.append(createIcon('close'));
      del.addEventListener('click', async () => {
        del.disabled = true;
        try {
          await Chat.deleteComment(state.commentsPost.chatId, state.commentsPost.msgId, comment.id, state.user.uid);
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

  const identifier = dom.authEmail.value.trim();
  const password = dom.authPassword.value;

  try {
    if (authMode === 'register') {
      if (!Auth.isEmailAddress(identifier)) {
        showAuthError('Для регистрации укажите email');
        return;
      }
      await Auth.registerWithEmail(identifier, password);
    } else {
      await Auth.loginWithIdentifier(identifier, password);
    }
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
    const result = await Auth.loginWithGoogle();
    // Email уже занят аккаунтом с паролем: просим пароль и привязываем Google.
    if (result?.needsLink) {
      pendingGoogleLink = { email: result.email, pendingCredential: result.pendingCredential };
      dom.authLinkPanel.classList.remove('hidden');
      dom.authLinkPassword.value = '';
      dom.authLinkPassword.focus();
    }
  } catch (error) {
    showAuthError(Auth.getAuthErrorMessage(error));
  } finally {
    setAuthLoading(false);
  }
});

// Завершение привязки Google к существующему аккаунту (пароль + link).
dom.authLinkSubmit.addEventListener('click', async () => {
  if (!pendingGoogleLink) return;
  hideAuthError();
  dom.authLinkSubmit.disabled = true;
  try {
    await Auth.completeGoogleLink(pendingGoogleLink.email, dom.authLinkPassword.value, pendingGoogleLink.pendingCredential);
    pendingGoogleLink = null;
    dom.authLinkPanel.classList.add('hidden');
    // Дальше сработает watchAuthState и откроет мессенджер.
  } catch (error) {
    showAuthError(Auth.getAuthErrorMessage(error));
  } finally {
    dom.authLinkSubmit.disabled = false;
  }
});
dom.authLinkCancel.addEventListener('click', () => {
  pendingGoogleLink = null;
  dom.authLinkPanel.classList.add('hidden');
  hideAuthError();
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

// Полоса папок: колесо мыши прокручивает её по горизонтали.
dom.foldersBar.addEventListener('wheel', (event) => {
  const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  if (!delta) return;
  const before = dom.foldersBar.scrollLeft;
  dom.foldersBar.scrollLeft = before + delta;
  if (dom.foldersBar.scrollLeft !== before) event.preventDefault();
}, { passive: false });

// Экран блокировки (бан): выход из аккаунта.
dom.bannedLogout.addEventListener('click', () => {
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
dom.prefsPasswordBtn.addEventListener('click', openPasswordModal);
dom.passwordClose.addEventListener('click', closePasswordModal);
dom.passwordCancel.addEventListener('click', closePasswordModal);
dom.passwordOverlay.addEventListener('click', (event) => {
  if (event.target === dom.passwordOverlay) closePasswordModal();
});
dom.passwordForm.addEventListener('submit', submitPasswordChange);
dom.prefsArchiveBtn.addEventListener('click', () => {
  closePrefsModal();
  openArchiveModal();
});
dom.prefsAdminToggle.addEventListener('change', async () => {
  if (!state.user) return;
  const enabled = dom.prefsAdminToggle.checked;
  try {
    await Chat.setAdminMode(state.user.uid, enabled);
    state.settings.adminMode = enabled;
    toast(enabled ? 'Админ-права включены' : 'Админ-права выключены');
  } catch (error) {
    console.error(error);
    toast('Не удалось изменить админ-права', 'error');
    renderPrefsModal();
  }
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
dom.prefsBlockedBtn.addEventListener('click', () => {
  closePrefsModal();
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
dom.settingsAdminAdd.addEventListener('click', addSettingsAdmin);
dom.settingsAdminInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault(); // не отправляем форму настроек
    addSettingsAdmin();
  }
});
dom.settingsMemberAdd.addEventListener('click', addSettingsMember);
dom.settingsMemberInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault(); // не отправляем форму настроек
    addSettingsMember();
  }
});
dom.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const chat = state.chats.get(settingsChatId);
  if (!chat) return;

  dom.settingsError.classList.add('hidden');
  dom.settingsSubmit.disabled = true;
  dom.settingsSubmit.textContent = 'Сохраняем…';
  try {
    // Тип и юзернейм группы отправляем только владельцу/супер-админу:
    // админ группы может менять лишь название, описание и аватар.
    const canManageGroupMeta = chat.owner === state.user.uid || adminRightsOn();
    await Chat.updateChatSettings(settingsChatId, state.user.uid, {
      title: dom.settingsTitle.value,
      description: dom.settingsDescription.value,
      groupType: chat.type === 'group' && canManageGroupMeta ? settingsTypeChoice : undefined,
      username: canManageGroupMeta ? dom.settingsUsername.value : undefined,
    });
    // Аватар группы/канала: сохраняем, только если его трогали.
    if ((chat.type === 'channel' || chat.type === 'group') && chatAvatarDraft.touched) {
      const avatar = chatAvatarDraft.removed ? null : draftAvatar(chatAvatarDraft);
      await Chat.updateChatAvatar(settingsChatId, state.user.uid, avatar);
    }
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
  if (!dom.devPromoOverlay.classList.contains('hidden')) {
    closeDevPromoModal();
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
  if (!state.composerMode) saveDraft(state.activeChatId, dom.messageInput.value);
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

// Промо-канал @dev: «подписаться» или «скрыть» прямо из списка чатов.
dom.devPromoClose.addEventListener('click', closeDevPromoModal);
dom.devPromoOverlay.addEventListener('click', (event) => {
  if (event.target === dom.devPromoOverlay) closeDevPromoModal();
});
dom.devPromoSubscribe.addEventListener('click', async () => {
  if (!state.user) return;
  dom.devPromoSubscribe.disabled = true;
  dom.devPromoHide.disabled = true;
  try {
    await Chat.subscribeToChannel(state.user.uid, DEV_CHANNEL_ID);
    toast('Вы подписались на канал', 'success');
    closeDevPromoModal();
    selectChat(DEV_CHANNEL_ID);
  } catch (error) {
    console.error(error);
    toast('Не удалось подписаться на канал', 'error');
    dom.devPromoSubscribe.disabled = false;
    dom.devPromoHide.disabled = false;
  }
});
dom.devPromoHide.addEventListener('click', async () => {
  if (!state.user) return;
  dom.devPromoSubscribe.disabled = true;
  dom.devPromoHide.disabled = true;
  try {
    await Chat.setDevPromoHidden(state.user.uid, true);
    state.settings = { ...state.settings, hideDevPromo: true };
    renderChatList();
    closeDevPromoModal();
    toast('Канал скрыт — найти его можно через поиск', 'success');
  } catch (error) {
    console.error(error);
    toast('Не удалось скрыть канал', 'error');
    dom.devPromoSubscribe.disabled = false;
    dom.devPromoHide.disabled = false;
  }
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

  // Супер-админ дозаполняет публичный индекс входа для существующих аккаунтов.
  Chat.isRootAdmin(user.uid)
    .then((isRoot) => (isRoot ? Chat.backfillLoginIndex() : 0))
    .catch((error) => console.warn('Не удалось дозаполнить индекс входа:', error));

  // Бан администратором: состояние + живая подписка
  // (снятие бана возвращает пользователя в мессенджер).
  state.subscriptions.myBan?.();
  state.myBan = await Chat.getBan(user.uid).catch(() => null);
  if (state.user !== user) return;
  state.subscriptions.myBan = Chat.subscribeToMyBan(user.uid, (record) => {
    const wasBanned = Boolean(state.myBan);
    state.myBan = record;
    if (record) {
      showBannedScreen();
    } else {
      hideBannedScreen();
      if (wasBanned && state.user && Chat.isProfileComplete(state.profile)) enterMessenger();
    }
  });

  // Профиль ещё не заполнен — онбординг; забанен — экран блокировки.
  if (!Chat.isProfileComplete(state.profile)) showOnboardingScreen();
  else if (state.myBan) showBannedScreen();
  else enterMessenger();
});
