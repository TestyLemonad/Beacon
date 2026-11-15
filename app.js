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
import * as Auth from './services/auth.js?v=70';
import * as Chat from './services/chat.js?v=70';
import * as Sessions from './services/sessions.js?v=70';
import * as Invites from './services/invites.js?v=70';
import * as Emoji from './emoji.js?v=70';
import * as ColorPicker from './color-picker.js?v=70';

/* ============================================================
 *  DOM
 * ============================================================ */

const $ = (id) => document.getElementById(id);

const dom = {
  // Экран загрузки: виден, пока Firebase восстанавливает сессию
  bootScreen: $('boot-screen'),
  bootStatus: $('boot-status'),
  bootLogoutBtn: $('boot-logout-btn'),

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
  googleBtnLabel: $('google-btn-label'),
  authInviteField: $('auth-invite-field'),
  authInvite: $('auth-invite'),

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
  emojiBtn: $('emoji-btn'),
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
  chatMenuAliases: $('chat-menu-aliases'),
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
  prefsProfileBtn: $('prefs-profile-btn'),
  prefsProfileHint: $('prefs-profile-hint'),
  prefsAppearanceBtn: $('prefs-appearance-btn'),
  prefsAppearanceHint: $('prefs-appearance-hint'),
  prefsPrivacyBtn: $('prefs-privacy-btn'),
  prefsPrivacyHint: $('prefs-privacy-hint'),
  prefsSecurityBtn: $('prefs-security-btn'),
  prefsSecurityHint: $('prefs-security-hint'),
  prefsDataBtn: $('prefs-data-btn'),
  prefsDataHint: $('prefs-data-hint'),
  prefsAccountBtn: $('prefs-account-btn'),
  prefsAccountHint: $('prefs-account-hint'),
  prefsThemeToggle: $('prefs-theme-toggle'),
  prefsPrivacyToggle: $('prefs-privacy-toggle'),
  prefsArchiveBtn: $('prefs-archive-btn'),
  prefsArchiveCount: $('prefs-archive-count'),
  prefsAdminField: $('prefs-admin-field'),
  prefsAdminToggle: $('prefs-admin-toggle'),
  prefsAdminSection: $('prefs-admin-section'),
  prefsAdminBtn: $('prefs-admin-btn'),
  prefsInvitesField: $('prefs-invites-field'),
  prefsInvitesBtn: $('prefs-invites-btn'),
  prefsBlockedBtn: $('prefs-blocked-btn'),
  prefsBlockedCount: $('prefs-blocked-count'),
  prefsProviders: $('prefs-providers'),
  prefsPasswordField: $('prefs-password-field'),
  prefsPasswordBtn: $('prefs-password-btn'),
  prefsLogoutBtn: $('prefs-logout-btn'),
  prefsDeleteAccountBtn: $('prefs-delete-account-btn'),
  prefsDeleteAccountHint: $('prefs-delete-account-hint'),
  prefsDeleteUserField: $('prefs-delete-user-field'),
  prefsDeleteUserInput: $('prefs-delete-user-input'),
  prefsDeleteUserBtn: $('prefs-delete-user-btn'),
  prefsDeleteUserError: $('prefs-delete-user-error'),

  // Подокна настроек: оформление, приватность, безопасность, аккаунт, данные, админка
  appearanceOverlay: $('appearance-overlay'),
  appearanceClose: $('appearance-close'),
  privacyOverlay: $('privacy-overlay'),
  privacyClose: $('privacy-close'),
  securityOverlay: $('security-overlay'),
  securityClose: $('security-close'),
  accountOverlay: $('account-overlay'),
  accountClose: $('account-close'),
  dataOverlay: $('data-overlay'),
  dataClose: $('data-close'),
  adminOverlay: $('admin-overlay'),
  adminClose: $('admin-close'),

  // Карточка цели: юзернеймы, резерв, статус, удаление аккаунта
  targetAdminOverlay: $('target-admin-overlay'),
  targetAdminClose: $('target-admin-close'),
  targetAdminAvatar: $('target-admin-avatar'),
  targetAdminTitle: $('target-admin-title'),
  targetAdminMeta: $('target-admin-meta'),
  targetAdminAliasField: $('target-admin-alias-field'),
  targetAdminAliasList: $('target-admin-alias-list'),
  targetAdminAliasInput: $('target-admin-alias-input'),
  targetAdminAliasAdd: $('target-admin-alias-add'),
  targetAdminReserveField: $('target-admin-reserve-field'),
  targetAdminReserve: $('target-admin-reserve'),
  targetAdminStatusKind: $('target-admin-status-kind'),
  targetAdminStatusValue: $('target-admin-status-value'),
  targetAdminStatusEmoji: $('target-admin-status-emoji'),
  targetAdminStatusColorField: $('target-admin-status-color-field'),
  targetAdminStatusColor: $('target-admin-status-color'),
  targetAdminStatusColorPick: $('target-admin-status-color-pick'),
  targetAdminStatusPreview: $('target-admin-status-preview'),
  targetAdminStatusCurrent: $('target-admin-status-current'),
  targetAdminStatusSave: $('target-admin-status-save'),
  targetAdminStatusClear: $('target-admin-status-clear'),
  targetAdminStatusError: $('target-admin-status-error'),
  targetAdminDeleteField: $('target-admin-delete-field'),
  targetAdminDelete: $('target-admin-delete'),
  targetAdminDeleteError: $('target-admin-delete-error'),

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

  // Активные сессии (отдельное окно)
  prefsSessionsBtn: $('prefs-sessions-btn'),
  sessionsOverlay: $('sessions-overlay'),
  sessionsClose: $('sessions-close'),
  sessionsList: $('sessions-list'),
  sessionsEmpty: $('sessions-empty'),
  sessionsError: $('sessions-error'),
  sessionsRefresh: $('sessions-refresh'),
  sessionsRevokeOthers: $('sessions-revoke-others'),

  // Инвайт-коды (окно root-админа)
  invitesOverlay: $('invites-overlay'),
  invitesClose: $('invites-close'),
  invitesForm: $('invites-form'),
  invitesNote: $('invites-note'),
  invitesCount: $('invites-count'),
  invitesError: $('invites-error'),
  invitesCancel: $('invites-cancel'),
  invitesSubmit: $('invites-submit'),
  invitesCreated: $('invites-created'),
  invitesList: $('invites-list'),
  invitesEmpty: $('invites-empty'),
  invitesLoadError: $('invites-load-error'),

  // Резерв юзернеймов (окно root-админа)
  prefsReservedField: $('prefs-reserved-field'),
  prefsReservedBtn: $('prefs-reserved-btn'),
  reservedOverlay: $('reserved-overlay'),
  reservedClose: $('reserved-close'),
  reservedForm: $('reserved-form'),
  reservedInput: $('reserved-input'),
  reservedError: $('reserved-error'),
  reservedCancel: $('reserved-cancel'),
  reservedSubmit: $('reserved-submit'),
  reservedSearch: $('reserved-search'),
  reservedStatusFilter: $('reserved-status-filter'),
  reservedTypeFilter: $('reserved-type-filter'),
  reservedCount: $('reserved-count'),
  reservedResult: $('reserved-result'),
  reservedList: $('reserved-list'),
  reservedEmpty: $('reserved-empty'),
  reservedLoadError: $('reserved-load-error'),
  reservedRemoveForm: $('reserved-remove-form'),
  reservedRemoveInput: $('reserved-remove-input'),
  reservedRemoveSubmit: $('reserved-remove-submit'),
  reservedRemoveError: $('reserved-remove-error'),

  // Дополнительные юзернеймы (окно root-админа)
  prefsAliasesField: $('prefs-aliases-field'),
  prefsAliasesBtn: $('prefs-aliases-btn'),
  aliasesOverlay: $('aliases-overlay'),
  aliasesClose: $('aliases-close'),
  aliasesForm: $('aliases-form'),
  aliasesType: $('aliases-type'),
  aliasesTarget: $('aliases-target'),
  aliasesInput: $('aliases-input'),
  aliasesSubmit: $('aliases-submit'),
  aliasesError: $('aliases-error'),
  aliasesCancel: $('aliases-cancel'),
  aliasesResult: $('aliases-result'),
  aliasesSearch: $('aliases-search'),
  aliasesFilter: $('aliases-filter'),
  aliasesCount: $('aliases-count'),
  aliasesList: $('aliases-list'),
  aliasesEmpty: $('aliases-empty'),
  aliasesLoadError: $('aliases-load-error'),

  // Статусы пользователей (только root-админы)
  prefsStatusField: $('prefs-status-field'),
  prefsStatusTarget: $('prefs-status-target'),
  prefsStatusUser: $('prefs-status-user'),
  prefsStatusKind: $('prefs-status-kind'),
  prefsStatusValue: $('prefs-status-value'),
  prefsStatusColorField: $('prefs-status-color-field'),
  prefsStatusColor: $('prefs-status-color'),
  prefsStatusColorPick: $('prefs-status-color-pick'),
  prefsStatusEmojiBtn: $('prefs-status-emoji-btn'),
  prefsStatusPreview: $('prefs-status-preview'),
  prefsStatusCurrent: $('prefs-status-current'),
  prefsStatusSave: $('prefs-status-save'),
  prefsStatusClear: $('prefs-status-clear'),
  prefsStatusError: $('prefs-status-error'),

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
  statsFullLink: $('stats-full-link'),

  // Создание группы: тип, юзернейм, описание
  groupDescription: $('group-description'),
  groupTypeBtns: Array.from(document.querySelectorAll('[data-group-type]')),
  groupUsernameField: $('group-username-field'),
  groupUsername: $('group-username'),
  groupMembersField: $('group-members-field'),

  // Профиль: аватарка и чёрный список
  profileAliases: $('profile-aliases'),
  profileAdminField: $('profile-admin-field'),
  profileAdminOpen: $('profile-admin-open'),
  profileAdminHint: $('profile-admin-hint'),
  avatarPreview: $('avatar-preview'),
  avatarValue: $('avatar-value'),
  avatarKindBtns: Array.from(document.querySelectorAll('[data-avatar-kind]')),
  avatarBgBtns: Array.from(document.querySelectorAll('[data-avatar-bg]')),
  avatarPalette1: $('avatar-palette-1'),
  avatarPalette2: $('avatar-palette-2'),
  avatarHex1: $('avatar-hex-1'),
  avatarHex2: $('avatar-hex-2'),
  avatarPick1: $('avatar-pick-1'),
  avatarPick2: $('avatar-pick-2'),
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
  settingsUsernameAliases: $('settings-username-aliases'),
  settingsChannelBlock: $('settings-channel-block'),
  settingsRequiresSubscription: $('settings-requires-subscription'),
  settingsAdminsBlock: $('settings-admins-block'),
  settingsAdminsList: $('settings-admins-list'),
  settingsAdminInput: $('settings-admin-input'),
  settingsAdminAdd: $('settings-admin-add'),
  settingsMembersBlock: $('settings-members-block'),
  settingsMembersList: $('settings-members-list'),
  settingsMemberAddRow: $('settings-member-add-row'),
  settingsMemberInput: $('settings-member-input'),
  settingsMemberAdd: $('settings-member-add'),
  settingsParticipantsBlock: $('settings-participants-block'),
  settingsMembersBtn: $('settings-members-btn'),
  settingsMembersHint: $('settings-members-hint'),
  settingsMembersOverlay: $('settings-members-overlay'),
  settingsMembersClose: $('settings-members-close'),
  settingsAdminsBtn: $('settings-admins-btn'),
  settingsAdminsHint: $('settings-admins-hint'),
  settingsAdminsOverlay: $('settings-admins-overlay'),
  settingsAdminsClose: $('settings-admins-close'),
  settingsAvatarBlock: $('settings-avatar-block'),
  settingsAvatarPreview: $('settings-avatar-preview'),
  settingsAvatarKindBtns: Array.from(document.querySelectorAll('[data-sa-kind]')),
  settingsAvatarValue: $('settings-avatar-value'),
  settingsAvatarBgBtns: Array.from(document.querySelectorAll('[data-sa-bg]')),
  settingsAvatarHex1: $('settings-avatar-hex1'),
  settingsAvatarHex2: $('settings-avatar-hex2'),
  settingsAvatarPick1: $('settings-avatar-pick1'),
  settingsAvatarPick2: $('settings-avatar-pick2'),
  settingsAvatarColorRow2: $('settings-avatar-color-row2'),
  settingsAvatarPalette1: $('settings-avatar-palette1'),
  settingsAvatarPalette2: $('settings-avatar-palette2'),
  settingsAvatarReset: $('settings-avatar-reset'),

  // Уведомления
  toast: $('toast'),

  // Экран требования инвайт-кода (новый аккаунт без приглашения)
  inviteGateScreen: $('invite-gate-screen'),
  inviteGateForm: $('invite-gate-form'),
  inviteGateEmail: $('invite-gate-email'),
  inviteGateCode: $('invite-gate-code'),
  inviteGateError: $('invite-gate-error'),
  inviteGateSubmit: $('invite-gate-submit'),
  inviteGateLogout: $('invite-gate-logout'),

  // Экран блокировки (бан)
  bannedScreen: $('banned-screen'),
  bannedTitle: $('banned-title'),
  bannedText: $('banned-text'),
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
  messageNodes: new Map(),  // ключ узла ленты -> { el, sig }: переиспользование DOM
  messageNodesChatId: null, // чат, для которого построены узлы ленты
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
  usernameAliases: new Map(), // $name -> { type, target, at, by } из /username_aliases
  bannedUsers: new Set(),   // uid из /banned_users (метки в меню чата)
  myBan: null,              // моя запись бана { by, at } или null
  myDeleted: false,         // мой аккаунт удалён (/deleted_users/$uid)

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
    myDeleted: null,        // /deleted_users/$uid
    bans: null,             // /banned_users
    rootAdmins: null,       // /root_admins
    usernameAliases: null,  // /username_aliases
    userStatuses: null,     // /user_statuses (статусы рядом с именем)
    chatStatuses: null,     // /chat_statuses (статусы каналов и групп)
    userProfiles: new Map(), // uid -> unsubscribe для живых профилей (/users/$uid)
    chatScoped: [],         // подписки активного чата (typing, голоса, комментарии…)
    chatScopedId: null,     // id чата, для которого настроены подписки chatScoped
  },
};

let authMode = 'login';     // 'login' | 'register'
let pendingGoogleLink = null; // { email, pendingCredential } — ждём пароль для привязки Google
let pendingInviteCode = '';   // код из формы, который нужно применить после входа
let lastInviteError = '';     // последняя ошибка кода — показываем на экране требования инвайта
let modalTab = 'private';   // активная вкладка модального окна
let searchSeq = 0;          // защита от гонок при поиске
let searchTimer = null;

/** Глубокие ссылки: ?s=запрос — глобальный поиск, ?u=@username — человек/канал/группа,
 *  ?invite_code=… — инвайт-код с автоподстановкой на экране регистрации. */
const deepLinkParams = new URLSearchParams(window.location.search);
const deepLink = {
  search: String(deepLinkParams.get('s') || '').trim(),
  username: String(deepLinkParams.get('u') || '').trim(),
  invite: Invites.normalizeInviteCode(deepLinkParams.get('invite_code') || ''),
};
let deepLinkHandled = false;
let groupTypeChoice = 'private';    // тип новой группы: 'private' | 'public'
let settingsTypeChoice = 'private'; // тип группы в окне настроек
let settingsChatId = null;          // чат, открытый в окне настроек
let typingTimer = null;             // таймер «печатает…» (сброс после паузы)
let typingLastSent = 0;             // когда последний раз писали «печатает…» (unix-секунды)
let typingTick = null;              // интервал пересчёта строки «печатает…»
let messagesObserver = null;        // IntersectionObserver просмотров постов
let messagesObserverChatId = null;  // чат, для которого создан этот наблюдатель
const viewsPending = new Map();     // msgId -> таймер «пост пробыл на виду»
let chatListSignature = null;       // подпись состояния списка чатов (пропуск лишних перерисовок)
let chatListRenderHandle = 0;       // запланированная перерисовка списка (batch подписок RTDB)
let chatListRenderFallback = 0;     // таймер-страховка, если requestAnimationFrame не сработал
let chatListNodes = new Map();      // ключ элемента списка -> { el, sig }: переиспользование узлов
let messagesRenderHandle = 0;       // запланированная перерисовка ленты (batch подписок голосов/просмотров)
let messagesRenderFallback = 0;     // таймер-страховка перерисовки ленты
let pinBarSignature = null;         // подпись плашки закрепа (пропуск лишних перерисовок)
let foldersBarSignature = null;     // подпись полосы папок (пропуск лишних перерисовок)
let composerMeasure = { value: null, width: -1 }; // кэш замеров поля ввода
let sessionStartedForUid = null;    // uid, для которого уже запущен реестр сессий
let loginIndexBackfilledFor = null; // uid, для которого индекс входа уже дозаполняли
let subscriptionsStarted = false;   // полный набор подписок после входа уже поднят
let accountDeletionInProgress = false; // удаляем аккаунт: не реагируем на отзыв сессии
let routeQueue = Promise.resolve(); // очередь разбора состояния Auth по экранам
let profileRefreshTimer = null;     // отложенная перерисовка после изменения профилей
let profileRefreshPending = false;  // перерисовка уже запрошена

/** Канал-промо @dev: показывается вверху списка, пока пользователь не подписан и не скрыл его. */
const DEV_CHANNEL_ID = '-P4EgAjn7KM6VFk2-rc_';

/* ============================================================
 *  Утилиты
 * ============================================================ */

/** Палитра аватарок-заглушек. */
const AVATAR_COLORS = ['#f0a24a', '#e06c75', '#61afef', '#98c379', '#c678dd', '#56b6c2', '#d19a66', '#8f9ff5'];

/** Шесть быстрых реакций в меню сообщения. */
const REACTIONS_TOP = ['👍', '❤️', '🔥', '😂', '😮', '😢'];

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
  if (profile.deleted) return Chat.DELETED_ACCOUNT_NAME || 'Удалённый аккаунт';
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return full || (profile.username ? '@' + profile.username : null);
}

/** Контрастный цвет текста для фона статуса (#rrggbb). */
function readableStatusTextColor(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(color || ''));
  if (!match) return '#ffffff';
  const value = parseInt(match[1], 16);
  const luminance = (0.299 * ((value >> 16) & 255)
    + 0.587 * ((value >> 8) & 255)
    + 0.114 * (value & 255)) / 255;
  return luminance > 0.62 ? '#1b1b1b' : '#ffffff';
}

/** Пилюля статуса: эмодзи или текст на цветном фоне. */
function buildStatusBadge(status) {
  if (!status) return null;
  const badge = createEl('span', `user-status user-status-${status.kind}`);
  badge.textContent = status.value;
  if (status.kind === 'text') {
    badge.style.background = status.color;
    badge.style.color = readableStatusTextColor(status.color);
  }
  badge.title = status.kind === 'text' ? `Статус: ${status.value}` : 'Статус';
  return badge;
}

/** Статус пользователя для показа (у удалённых аккаунтов статуса нет). */
function userStatusFor(uid) {
  if (!uid) return null;
  if (Chat.getCachedUserProfile(uid)?.deleted) return null;
  return Chat.getCachedUserStatus(uid);
}

/** Статус канала или группы. */
function chatStatusFor(chatId) {
  if (!chatId) return null;
  return Chat.getCachedChatStatus(chatId);
}

/**
 * Статус, который показывается рядом с названием чата:
 * у личных — собеседника, у каналов и групп — самого чата.
 */
function chatItemStatus(chatId, chat) {
  if (!chat) return null;
  if (chat.type === 'private') return userStatusFor(getPrivatePeerUid(chat));
  if (chat.type === 'channel' || chat.type === 'group') return chatStatusFor(chatId);
  return null;
}

/** Дописать готовую пилюлю статуса к узлу. */
function applyStatus(node, status) {
  if (!node || !status) return;
  const badge = buildStatusBadge(status);
  if (!badge) return;
  node.append(badge);
  Emoji.parse(badge);
}

/** Дописать статус пользователя справа от уже вставленного имени. */
function applyUserStatus(node, uid) {
  applyStatus(node, userStatusFor(uid));
}

/** Дописать статус канала или группы справа от названия. */
function applyChatStatus(node, chatId) {
  applyStatus(node, chatStatusFor(chatId));
}

/** Название со статусом для строк списков: обёртка, которая не ломает эллипсис. */
function buildNameWithStatus(name, status, className = 'chat-item-title') {
  const wrap = createEl('span', 'name-with-status');
  wrap.append(createEl('span', className, name));
  applyStatus(wrap, status);
  return wrap;
}

/** Имя пользователя со статусом. */
function buildUserNameWithStatus(name, uid, className = 'chat-item-title') {
  return buildNameWithStatus(name, userStatusFor(uid), className);
}

/** Дополнительные юзернеймы цели: [{ name, type, target, at, by }]. */
function aliasesForTarget(type, target) {
  if (!type || !target) return [];
  return [...state.usernameAliases.entries()]
    .filter(([, record]) => record && record.type === type && record.target === target)
    .map(([name, record]) => ({ name, ...record }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** Показать строку «А также @a, @b» либо скрыть её. */
function applyAliasHint(element, type, target) {
  if (!element) return;
  const aliases = aliasesForTarget(type, target);
  if (!aliases.length) {
    element.textContent = '';
    element.classList.add('hidden');
    return;
  }
  element.textContent = 'А также ' + aliases.map((alias) => '@' + alias.name).join(', ');
  element.classList.remove('hidden');
}

/* ============================================================
 *  Юзернеймы в профилях: быстрые операции супер-админа
 *  (дублируют разделы настроек для конкретного пользователя/чата)
 * ============================================================ */

/** Имена из /reserved_usernames для подписи «зарезервирован» в профиле. */
const reservedNameCache = { names: new Set(), loadedAt: 0, loading: null };

/** Обновить кэш зарезервированных имён и перерисовать открытые профили. */
async function refreshReservedNameCache(force = false) {
  if (!adminRightsOn()) {
    reservedNameCache.names = new Set();
    reservedNameCache.loadedAt = Date.now();
    refreshUsernameAdminBlocks();
    return;
  }
  if (!force && Date.now() - reservedNameCache.loadedAt < 30000) return;
  if (reservedNameCache.loading) return reservedNameCache.loading;

  reservedNameCache.loading = Chat.listReservedUsernames()
    .then((items) => {
      reservedNameCache.names = new Set(items.map((item) => item.name));
      reservedNameCache.loadedAt = Date.now();
    })
    .catch((error) => {
      console.error('Не удалось загрузить зарезервированные юзернеймы:', error);
      reservedNameCache.loadedAt = Date.now();
    })
    .finally(() => {
      reservedNameCache.loading = null;
      refreshUsernameAdminBlocks();
    });

  return reservedNameCache.loading;
}

/** Перерисовать админ-блоки в открытых профиле, меню чата и карточке цели. */
function refreshUsernameAdminBlocks() {
  if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
  if (!dom.profileOverlay.classList.contains('hidden')) renderProfileAliases();
  if (!dom.targetAdminOverlay.classList.contains('hidden')) {
    if (!adminRightsOn()) closeTargetAdmin();
    else renderTargetAdmin();
  }
}

/**
 * Карточка цели для супер-админа: дополнительные имена, резерв основного,
 * статус и удаление аккаунта. Открывается из профиля, меню чата и раздела
 * «Администрирование» — сам профиль остаётся компактным.
 */
const targetAdminUi = {
  type: 'user',        // 'user' | 'chat' — как в API статусов
  aliasType: 'user',   // 'user' | 'channel' | 'group' — как в /username_aliases
  id: '',
  username: '',
  statusKind: 'emoji',
};

/** Статус цели карточки (null, если статуса нет). */
function targetAdminStatus() {
  if (!targetAdminUi.id) return null;
  return targetAdminUi.type === 'chat'
    ? chatStatusFor(targetAdminUi.id)
    : userStatusFor(targetAdminUi.id);
}

/** Открыть карточку юзернеймов и статуса для пользователя или чата. */
function openTargetAdmin(target) {
  if (!target?.id || !adminRightsOn()) return;

  targetAdminUi.type = target.type === 'user' ? 'user' : 'chat';
  targetAdminUi.aliasType = target.type === 'channel'
    ? 'channel'
    : target.type === 'group' ? 'group' : 'user';
  targetAdminUi.id = target.id;
  targetAdminUi.username = target.username || '';
  targetAdminUi.statusKind = 'emoji';

  dom.targetAdminAliasInput.value = '';
  dom.targetAdminStatusValue.value = '';
  dom.targetAdminStatusColor.value = Chat.STATUS_DEFAULT_COLOR;
  ColorPicker.syncColorChip(dom.targetAdminStatusColorPick, dom.targetAdminStatusColor);
  dom.targetAdminStatusError.classList.add('hidden');
  dom.targetAdminDeleteError.classList.add('hidden');
  renderTargetAdmin();
  dom.targetAdminOverlay.classList.remove('hidden');
  refreshReservedNameCache();
}

function closeTargetAdmin() {
  ColorPicker.closeColorPicker();
  dom.targetAdminOverlay.classList.add('hidden');
}

/** Перерисовать карточку цели целиком. */
function renderTargetAdmin() {
  if (!targetAdminUi.id) return;
  renderTargetAdminHead();
  renderTargetAliases();
  renderTargetReserve();
  syncTargetStatusKind();
  renderTargetStatusPreview();
  renderTargetStatusCurrent();

  // Удалять можно только чужой обычный аккаунт.
  const profile = targetAdminUi.type === 'user'
    ? Chat.getCachedUserProfile(targetAdminUi.id)
    : null;
  const canDelete = targetAdminUi.type === 'user'
    && targetAdminUi.id !== state.user?.uid
    && !state.rootAdmins.has(targetAdminUi.id)
    && !profile?.deleted;
  dom.targetAdminDeleteField.classList.toggle('hidden', !canDelete);
}

/** Перерисовать карточку цели, если она открыта. */
function refreshTargetAdminCard() {
  if (!dom.targetAdminOverlay.classList.contains('hidden')) renderTargetAdmin();
  if (!dom.profileOverlay.classList.contains('hidden')) renderProfileAdminRow();
}

/** Шапка карточки: аватар, название и тип цели. */
function renderTargetAdminHead() {
  let title = '';
  let kind = 'Пользователь';

  if (targetAdminUi.type === 'chat') {
    const chat = state.chats.get(targetAdminUi.id);
    if (chat) {
      applyChatAvatar(dom.targetAdminAvatar, targetAdminUi.id, chat);
      title = getChatTitle(chat);
    } else {
      applyAvatar(dom.targetAdminAvatar, targetAdminUi.id, '?');
    }
    kind = chat?.type === 'channel' ? 'Канал' : 'Группа';
  } else {
    const profile = Chat.getCachedUserProfile(targetAdminUi.id);
    applyProfileAvatar(dom.targetAdminAvatar, profile, targetAdminUi.id);
    title = getProfileName(profile) || 'Пользователь';
  }

  dom.targetAdminTitle.textContent = title || 'Без названия';
  dom.targetAdminMeta.textContent = [targetAdminUi.username ? '@' + targetAdminUi.username : '', kind]
    .filter(Boolean)
    .join(' · ');
}

/** Список дополнительных имён с кнопкой «Забрать». */
function renderTargetAliases() {
  const list = dom.targetAdminAliasList;
  list.innerHTML = '';

  const aliases = aliasesForTarget(targetAdminUi.aliasType, targetAdminUi.id);
  if (!aliases.length) {
    list.append(createEl('div', 'admin-empty', 'Дополнительных имён пока нет.'));
    return;
  }

  aliases.forEach((alias) => {
    const row = createEl('div', 'username-admin-row');
    row.append(createEl('span', 'reserved-name', '@' + alias.name));
    const remove = createEl('button', 'btn ghost reserved-remove', 'Забрать');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Забрать @${alias.name}? Оно перестанет вести на этот профиль.`)) return;
      remove.disabled = true;
      try {
        await Chat.removeUsernameAliases([alias.name]);
        toast(`@${alias.name} больше не дополнительный`, 'success');
        renderTargetAliases();
      } catch (error) {
        console.error(error);
        toast(error?.message || 'Не удалось забрать юзернейм', 'error');
      } finally {
        remove.disabled = false;
      }
    });
    row.append(remove);
    list.append(row);
  });
}

/** Кнопка резерва основного имени. */
function renderTargetReserve() {
  const username = targetAdminUi.username;
  dom.targetAdminReserveField.classList.toggle('hidden', !username);
  if (!username) return;
  const reserved = reservedNameCache.names.has(username);
  dom.targetAdminReserve.textContent = reserved
    ? `Снять резерв с @${username}`
    : `Зарезервировать @${username}`;
}

/** Показать/скрыть поля, которые зависят от типа статуса. */
function syncTargetStatusKind() {
  const isText = targetAdminUi.statusKind === 'text';
  dom.targetAdminStatusKind.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusKind === (isText ? 'text' : 'emoji'));
  });
  dom.targetAdminStatusColorField.classList.toggle('hidden', !isText);
  dom.targetAdminStatusEmoji.classList.toggle('hidden', isText);
  dom.targetAdminStatusValue.maxLength = isText ? Chat.STATUS_TEXT_MAX : 24;
  dom.targetAdminStatusValue.placeholder = isText
    ? `Текст до ${Chat.STATUS_TEXT_MAX} символов`
    : 'Любой эмодзи';
  dom.targetAdminStatusSave.textContent = isText ? 'Выдать текст' : 'Выдать эмодзи';
  dom.targetAdminStatusClear.textContent = targetAdminUi.type === 'chat' ? 'Снять у чата' : 'Снять';
}

/** Строка «Сейчас: …» с текущим статусом цели. */
function renderTargetStatusCurrent() {
  const node = dom.targetAdminStatusCurrent;
  node.textContent = '';
  const status = targetAdminStatus();
  if (!status) {
    node.classList.add('hidden');
    return;
  }
  node.classList.remove('hidden');
  node.append(createEl('span', 'status-editor-label', 'Сейчас:'));
  node.append(buildStatusBadge(status));
  Emoji.parse(node);
}

/** Живой предпросмотр статуса из полей карточки. */
function renderTargetStatusPreview() {
  const node = dom.targetAdminStatusPreview;
  node.innerHTML = '';

  const value = String(dom.targetAdminStatusValue.value || '').trim();
  if (!value) {
    node.append(createEl('span', 'status-preview-hint', 'Предпросмотр статуса'));
    return;
  }

  const kind = targetAdminUi.statusKind;
  const badge = createEl('span', `user-status user-status-${kind}`);
  badge.textContent = kind === 'text'
    ? [...value].slice(0, Chat.STATUS_TEXT_MAX).join('')
    : value;
  if (kind === 'text') {
    const color = normalizeHex(dom.targetAdminStatusColor.value) || Chat.STATUS_DEFAULT_COLOR;
    badge.style.background = color;
    badge.style.color = readableStatusTextColor(color);
  }
  node.append(badge);
  Emoji.parse(badge);
}

function showTargetStatusError(message) {
  dom.targetAdminStatusError.textContent = message;
  dom.targetAdminStatusError.classList.remove('hidden');
}

/** Выдать или заменить статус цели. */
async function saveTargetStatus() {
  if (!adminRightsOn() || !targetAdminUi.id) return;

  const kind = targetAdminUi.statusKind;
  const value = String(dom.targetAdminStatusValue.value || '').trim();
  if (!value) {
    showTargetStatusError(kind === 'text' ? 'Введите текст статуса' : 'Выберите эмодзи');
    dom.targetAdminStatusValue.focus();
    return;
  }
  if (kind === 'emoji' && !/\p{Extended_Pictographic}/u.test(value)) {
    showTargetStatusError('В режиме «Эмодзи» нужен эмодзи — или переключитесь на «Текст»');
    dom.targetAdminStatusValue.focus();
    return;
  }

  dom.targetAdminStatusError.classList.add('hidden');
  dom.targetAdminStatusSave.disabled = true;
  try {
    const hadStatus = Boolean(targetAdminStatus());
    await writeStatusToTarget(
      { type: targetAdminUi.type, id: targetAdminUi.id },
      { kind, value, color: normalizeHex(dom.targetAdminStatusColor.value) || Chat.STATUS_DEFAULT_COLOR },
    );
    toast(hadStatus ? 'Статус обновлён' : 'Статус выдан', 'success');
    dom.targetAdminStatusValue.value = '';
    renderTargetStatusPreview();
    renderTargetStatusCurrent();
  } catch (error) {
    console.error(error);
    showTargetStatusError(statusWriteError(error));
  } finally {
    dom.targetAdminStatusSave.disabled = false;
    syncTargetStatusKind();
  }
}

/** Снять статус цели. */
async function clearTargetStatus() {
  if (!adminRightsOn() || !targetAdminUi.id) return;

  dom.targetAdminStatusError.classList.add('hidden');
  if (!targetAdminStatus()) {
    showTargetStatusError(targetAdminUi.type === 'chat'
      ? 'У этого чата нет статуса'
      : 'У этого пользователя нет статуса');
    return;
  }

  const what = targetAdminUi.type === 'chat' ? 'чата' : 'пользователя';
  const label = targetAdminUi.username ? ' @' + targetAdminUi.username : '';
  if (!window.confirm(`Снять статус ${what}${label}?`)) return;

  dom.targetAdminStatusClear.disabled = true;
  try {
    await clearStatusOfTarget({ type: targetAdminUi.type, id: targetAdminUi.id });
    toast('Статус снят', 'success');
    dom.targetAdminStatusValue.value = '';
    renderTargetStatusPreview();
    renderTargetStatusCurrent();
  } catch (error) {
    console.error(error);
    showTargetStatusError(statusWriteError(error));
  } finally {
    dom.targetAdminStatusClear.disabled = false;
  }
}

/** Выдать дополнительное имя цели. */
async function submitTargetAlias() {
  if (!adminRightsOn() || !targetAdminUi.id) return;

  const names = dom.targetAdminAliasInput.value.trim();
  if (!names) {
    dom.targetAdminAliasInput.focus();
    return;
  }

  dom.targetAdminAliasAdd.disabled = true;
  try {
    const result = await Chat.assignUsernameAliases({
      names,
      type: targetAdminUi.aliasType,
      target: targetAdminUi.id,
      uid: state.user.uid,
    });
    dom.targetAdminAliasInput.value = '';
    if (result.added.length) {
      toast(`Выдано имён: ${result.added.length}`, 'success');
      renderTargetAliases();
    } else {
      const skipped = result.skipped || [];
      const reason = skipped[0] ? ALIAS_SKIP_REASONS[skipped[0].reason] : '';
      toast(reason ? `Не выдано: ${reason}` : 'Новые имена не выданы: все пропущены');
    }
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось выдать юзернеймы', 'error');
  } finally {
    dom.targetAdminAliasAdd.disabled = false;
  }
}

/** Поставить или снять резерв основного имени цели. */
async function toggleTargetReserve() {
  const username = targetAdminUi.username;
  if (!adminRightsOn() || !username) return;

  dom.targetAdminReserve.disabled = true;
  try {
    if (reservedNameCache.names.has(username)) {
      await Chat.releaseReservedUsernames([username]);
      toast(`@${username} снят с резерва`, 'success');
    } else {
      const result = await Chat.reserveUsernameForTarget({
        type: targetAdminUi.aliasType,
        target: targetAdminUi.id,
        uid: state.user.uid,
      });
      toast(result.added
        ? `@${result.name} зарезервирован`
        : `@${result.name} уже был зарезервирован`, 'success');
    }
    await refreshReservedNameCache(true);
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось изменить резерв', 'error');
  } finally {
    dom.targetAdminReserve.disabled = false;
  }
}

/** Удалить аккаунт цели (только чужой обычный пользователь). */
async function deleteTargetAccount() {
  if (!adminRightsOn() || targetAdminUi.type !== 'user' || accountDeletionInProgress) return;

  const uid = targetAdminUi.id;
  if (!uid || uid === state.user?.uid || state.rootAdmins.has(uid)) return;

  const profile = Chat.getCachedUserProfile(uid);
  const name = getProfileName(profile) || '@' + targetAdminUi.username;
  const confirmed = window.confirm(
    `Удалить аккаунт «${name}» (@${targetAdminUi.username})?\n\n` +
    'Профиль, настройки, чаты и подписки будут удалены. Сообщения останутся, ' +
    'а имя изменится на «Удалённый аккаунт». Пользователь потеряет доступ к мессенджеру.',
  );
  if (!confirmed) return;

  dom.targetAdminDelete.disabled = true;
  dom.targetAdminDeleteError.classList.add('hidden');
  try {
    await Chat.deleteUserAccount(uid, { deletedBy: state.user.uid, ban: true });
    toast(`Аккаунт ${name} удалён`, 'success');
    closeTargetAdmin();
    renderChatList();
    renderMainPanel();
    if (state.search.query) renderSearchResults();
  } catch (error) {
    console.error(error);
    dom.targetAdminDeleteError.textContent = 'Не удалось удалить аккаунт';
    dom.targetAdminDeleteError.classList.remove('hidden');
  } finally {
    dom.targetAdminDelete.disabled = false;
  }
}

/**
 * Первая буква строки без разрыва суррогатных пар.
 * Эмодзи и прочие символы пропускаем, ищем именно букву/цифру.
 */
function firstLetter(value, fallback = '?') {
  const char = [...String(value || '')].find((symbol) => /[0-9A-Za-zА-Яа-яЁё]/.test(symbol));
  return (char || fallback).toUpperCase();
}

/** Инициалы для аватарки (или первая буква юзернейма). */
function getProfileInitials(profile) {
  const first = (profile?.firstName || '').trim();
  const last = (profile?.lastName || '').trim();
  if (first || last) return (firstLetter(first, '') + firstLetter(last, ''));
  if (profile?.username) return firstLetter(profile.username);
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
  // «Избранное» — закладка вместо буквы «?».
  if (chat?.type === 'saved') {
    node.classList.remove('avatar-emoji');
    node.style.background = avatarColor(chatId);
    node.textContent = '';
    const glyph = createEl('span', 'avatar-glyph avatar-saved');
    glyph.innerHTML = CHAT_TYPE_ICONS.saved;
    node.append(glyph);
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
  reply:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
  edit:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  copy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  select:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h2"/><path d="M17 4h2a1 1 0 0 1 1 1v2"/><path d="M20 17v2a1 1 0 0 1-1 1h-2"/><path d="M7 20H5a1 1 0 0 1-1-1v-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
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
  device:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>',
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
    .map(([uid, info]) => ({
      uid,
      // Имя берём из живого профиля, а запись typing — запасной вариант.
      name: getProfileName(Chat.getCachedUserProfile(uid)) || info.name || 'Пользователь',
    }));
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
  dom.currentUserName.textContent = '';
  dom.currentUserName.append(createEl('span', 'current-user-name', getOwnDisplayName()));
  applyUserStatus(dom.currentUserName, state.user?.uid);
  applyProfileAvatar(dom.sidebarAvatar, state.profile, state.user?.uid || 'me');
}

/* ============================================================
 *  Догрузка профилей (имена отправителей, собеседников)
 * ============================================================ */

/** Видимые в интерфейсе поля профиля — по ним ловим изменения. */
function profileSnapshotKey(profile) {
  if (!profile) return '';
  return JSON.stringify([
    profile.username || '',
    profile.firstName || '',
    profile.lastName || '',
    profile.bio || '',
    profile.deleted === true,
    profile.avatar || null,
  ]);
}

/** Подписаться на живые профили, которых ещё нет в реестре подписок. */
function watchUserProfiles(uids) {
  if (!state.user) return;
  for (const uid of new Set(uids)) {
    if (!uid || state.subscriptions.userProfiles.has(uid)) continue;

    let previousKey = profileSnapshotKey(Chat.getCachedUserProfile(uid));
    const unsubscribe = Chat.subscribeToUserProfile(uid, (profile) => {
      const nextKey = profileSnapshotKey(profile);
      if (nextKey === previousKey) return;
      previousKey = nextKey;

      if (uid === state.user?.uid) {
        state.profile = profile;
        updateSidebarUser();
      }
      scheduleProfileRefresh();
    });
    state.subscriptions.userProfiles.set(uid, unsubscribe);
  }
}

/** Перерисовать всё, где показываются имена, био и аватарки пользователей. */
function refreshProfileViews() {
  if (!state.user || dom.messengerScreen.classList.contains('hidden')) return;

  renderChatList();
  if (state.search.query) renderSearchResults();
  if (state.activeChatId || state.channelPreview) renderMainPanel();
  if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
  if (!dom.archiveOverlay.classList.contains('hidden')) renderArchiveList();
  if (!dom.blockedOverlay.classList.contains('hidden')) renderBlockedList();
  if (!dom.forwardOverlay.classList.contains('hidden') && state.forwardMessage) {
    openForwardModal(state.forwardMessage);
  }

  if (settingsChatId && !dom.settingsOverlay.classList.contains('hidden')) {
    const chat = state.chats.get(settingsChatId);
    if (chat?.type === 'group') renderSettingsMembers(chat);
    if (chat?.type === 'channel') renderSettingsAdmins(chat);
  }

  // Комментарии: сохраняем позицию прокрутки, чтобы чтение не сбивалось.
  if (!dom.commentsOverlay.classList.contains('hidden') && state.commentsPost) {
    const scrollTop = dom.commentsList.scrollTop;
    renderComments(state.chatComments);
    dom.commentsList.scrollTop = scrollTop;
  }

  if (state.composerMode?.type === 'reply') {
    dom.composerContextTitle.textContent = `Ответ ${getSenderName(state.composerMode.message.sender)}`;
  }
}

/** Отложенная перерисовка: несколько изменений подряд схлопываются в одну. */
function scheduleProfileRefresh() {
  if (profileRefreshPending) return;
  profileRefreshPending = true;
  profileRefreshTimer = window.setTimeout(() => {
    profileRefreshTimer = null;
    profileRefreshPending = false;
    refreshProfileViews();
  }, 120);
}

/** Снять живые подписки на профили (выход из аккаунта). */
function stopProfileWatch() {
  clearTimeout(profileRefreshTimer);
  profileRefreshTimer = null;
  profileRefreshPending = false;
  for (const unsubscribe of state.subscriptions.userProfiles.values()) unsubscribe();
  state.subscriptions.userProfiles.clear();
}

/**
 * Загрузить отсутствующие профили, подписаться на изменения и перерисовать UI.
 * Профили кэшируются в services/chat.js, поэтому повторных
 * запросов и циклов перерисовки не возникает.
 */
async function hydrateUsers(uids) {
  if (!state.user) return;
  const unique = [...new Set(uids)].filter(Boolean);
  if (!unique.length) return;

  // Показанные профили держим живыми: имя, био и аватарка обновляются сразу.
  watchUserProfiles(unique);

  const missing = unique.filter((uid) => Chat.getCachedUserProfile(uid) === undefined);
  if (!missing.length) return;

  await Promise.allSettled(missing.map((uid) => Chat.getUserProfile(uid)));
  if (!state.user) return; // пользователь успел выйти, пока грузили

  // Живые подписки на профили уже прислали новые данные и запросили
  // отложенную перерисовку. Второй полный рендер здесь не нужен: раньше он
  // дублировал список чатов и ленту сообщений на каждую догрузку профилей.
  scheduleProfileRefresh();
}

/* ============================================================
 *  Список чатов (боковая панель)
 * ============================================================ */

/** Личные настройки чата (архив/закреп/папки) — или пустой объект. */
const EMPTY_CHAT_META = Object.freeze({});
function getChatMeta(chatId) {
  return state.chatMeta.get(chatId) || EMPTY_CHAT_META;
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
  // Канал, открытый только для чтения, живёт в state.chats, но в списке
  // «моих чатов» ему места нет — пока пользователь не подпишется.
  return [...state.chats.entries()]
    .filter(([chatId]) => state.myChatIds.has(chatId))
    .sort((a, b) => {
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
  top.append(buildNameWithStatus(getChatTitle(chat), chatStatusFor(DEV_CHANNEL_ID)));
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
  top.append(buildNameWithStatus(getChatTitle(chat), chatItemStatus(chatId, chat)));
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

/**
 * Подпись одного элемента списка чатов: всё, что видно в узле.
 * Совпала — узел переиспользуется, иначе пересобирается только он.
 */
function chatListItemSignature(chatId, chat) {
  const peerUid = chat?.type === 'private' ? getPrivatePeerUid(chat) : null;
  const peerAvatar = peerUid ? Chat.getCachedUserProfile(peerUid)?.avatar : null;
  const status = chatItemStatus(chatId, chat);
  return [
    chatId,
    chatId === state.activeChatId ? 1 : 0,
    chat?.type || '',
    getChatTitle(chat),
    getChatPreview(chat),
    chat?.lastMessage?.timestamp || 0,
    isChatUnread(chatId, chat) ? 1 : 0,
    getChatMeta(chatId).pinnedAt ? 1 : 0,
    chat?.avatar ? JSON.stringify(chat.avatar) : '',
    peerAvatar ? JSON.stringify(peerAvatar) : '',
    status ? JSON.stringify(status) : '',
  ].join('\u0002');
}

/** Подпись промо-строки канала @dev. */
function devPromoSignature() {
  const status = chatStatusFor(DEV_CHANNEL_ID);
  return [
    state.devPromoChat?.title || '',
    state.devPromoChat?.description || '',
    state.devPromoChat?.avatar ? JSON.stringify(state.devPromoChat.avatar) : '',
    status ? JSON.stringify(status) : '',
  ].join('\u0003');
}

/**
 * Подпись состояния списка чатов. Пока она не меняется, перерисовка не нужна:
 * onValue приходит на каждое новое сообщение в любом чате и раньше заставлял
 * заново строить весь список вместе с обработчиками и аватарками.
 */
function buildChatListSignature(items, showPromo, promoSignature) {
  const parts = [
    state.activeChatId || '',
    state.activeFolder,
    showPromo ? '1' : '0',
    showPromo ? promoSignature : '',
    items.length ? '' : String(state.myChatIds.size),
  ];

  for (const item of items) parts.push(item.sig);

  parts.push([...state.folders.entries()]
    .sort((a, b) => (Number(a[1]?.createdAt) || 0) - (Number(b[1]?.createdAt) || 0))
    .map(([folderId, folder]) => `${folderId}:${folder?.name || ''}`)
    .join(','));

  return parts.join('\u0004');
}

/** Отрисовать список диалогов (архив в него не попадает). */
function renderChatList(force = false) {
  const chats = visibleChats();
  const showPromo = isDevPromoVisible();
  const promoSignature = showPromo ? devPromoSignature() : '';

  // Подписи считаем один раз: они нужны и для сравнения состояния списка,
  // и для переиспользования узлов.
  const items = chats.map(([chatId, chat]) => ({ chatId, chat, sig: chatListItemSignature(chatId, chat) }));

  const signature = buildChatListSignature(items, showPromo, promoSignature);
  if (!force && signature === chatListSignature) return;
  chatListSignature = signature;

  const emptyText = state.activeFolder !== 'all' && state.myChatIds.size
    ? 'В этой папке пока нет чатов.<br />Добавить чат можно правым кликом по нему в «Все чаты».'
    : 'У вас пока нет чатов.<br />Создайте первый или найдите канал через поиск!';
  dom.chatListEmpty.classList.toggle('hidden', chats.length > 0 || showPromo);
  if (dom.chatListEmpty.innerHTML !== emptyText) dom.chatListEmpty.innerHTML = emptyText;

  const previousNodes = chatListNodes;
  const nextNodes = new Map();
  const ordered = [];
  const created = [];

  /** Взять готовый узел по ключу либо собрать новый. */
  const pushItem = (key, itemSignature, build) => {
    const previous = previousNodes.get(key);
    if (previous && previous.sig === itemSignature) {
      nextNodes.set(key, previous);
      ordered.push(previous.el);
      return;
    }
    const el = build();
    nextNodes.set(key, { el, sig: itemSignature });
    ordered.push(el);
    created.push(el);
  };

  const uidsToHydrate = [];

  // Канал @dev — самым верхним, пока пользователь не подписан и не скрыл его.
  if (showPromo) pushItem('promo', promoSignature, buildDevPromoItem);

  for (const { chatId, chat, sig } of items) {
    pushItem(`c:${chatId}`, sig, () => buildChatListItem('li', chatId, chat));

    if (chat.type === 'private') uidsToHydrate.push(getPrivatePeerUid(chat));
    if (chat.type !== 'saved' && chat.lastMessage?.sender) uidsToHydrate.push(chat.lastMessage.sender);
  }

  syncMessageList(dom.chatList, ordered);
  chatListNodes = nextNodes;

  // Эмодзи разбираем только в новых узлах, а не во всём списке заново.
  for (const el of created) Emoji.parse(el);
  renderFoldersBar();
  hydrateUsers(uidsToHydrate);
}

/**
 * Отложенная перерисовка списка чатов. RTDB присылает обновления по каждому
 * чату отдельными событиями (особенно при входе) — без склейки список
 * пересобирался десятки раз подряд.
 */
function scheduleChatListRender() {
  if (chatListRenderHandle || chatListRenderFallback) return;

  const run = () => {
    if (chatListRenderHandle) cancelAnimationFrame(chatListRenderHandle);
    chatListRenderHandle = 0;
    if (chatListRenderFallback) {
      window.clearTimeout(chatListRenderFallback);
      chatListRenderFallback = 0;
    }
    renderChatList();
  };

  chatListRenderHandle = requestAnimationFrame(run);
  // requestAnimationFrame не срабатывает в скрытом или перекрытом окне.
  // Тогда список дорисовываем таймером, чтобы данные не ждали фокуса.
  chatListRenderFallback = window.setTimeout(run, 250);
}

/** Полоса папок под поиском: «Все чаты» + пользовательские папки. */
function renderFoldersBar() {
  const chips = [{ id: 'all', name: 'Все чаты' }];
  for (const [folderId, folder] of [...state.folders.entries()].sort((a, b) => (
    (Number(a[1]?.createdAt) || 0) - (Number(b[1]?.createdAt) || 0)
  ))) {
    chips.push({ id: folderId, name: folder?.name || 'Папка' });
  }

  // Полоса меняется только вместе с папками и выбранной папкой: на каждое
  // новое сообщение в списке чатов пересобирать её с обработчиками незачем.
  const signature = [state.activeFolder, ...chips.map((chip) => `${chip.id}\u0005${chip.name}`)].join('\u0004');
  if (signature === foldersBarSignature) return;
  foldersBarSignature = signature;

  dom.foldersBar.innerHTML = '';
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

function exitSearchMode() {
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
async function syncChatUrl(chat) {
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
function openGlobalSearch(rawQuery) {
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
async function openDeepLinkUsername(rawUsername) {
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
async function applyDeepLink() {
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
  state.messageNodes = new Map();
  state.messageNodesChatId = null;
  cancelAnimationFrame(messagesRenderHandle);
  messagesRenderHandle = 0;
  window.clearTimeout(messagesRenderFallback);
  messagesRenderFallback = 0;
  pinBarSignature = null;
  messagesObserver?.disconnect();
  messagesObserver = null;
  messagesObserverChatId = null;
  viewsPending.clear();
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
    scheduleMessagesRender();
  }));

  // Канал: комментарии (счётчики) и просмотры постов.
  if (chat?.type === 'channel') {
    scope.push(Chat.subscribeToChatComments(chatId, (map) => {
      state.chatComments = new Map(Object.entries(map || {}));
      scheduleMessagesRender();
    }));
    scope.push(Chat.subscribeToChatViews(chatId, (map) => {
      state.chatViews = new Map(Object.entries(map || {}));
      scheduleMessagesRender();
    }));
  }

  // Личный чат: прочтения собеседника (галочки) и его присутствие.
  if (chat?.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    if (peerUid) {
      scope.push(Chat.subscribeToChatReads(peerUid, chatId, (ts) => {
        state.peerReadTs = ts;
        scheduleMessagesRender();
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
  const previousChatId = state.activeChatId;
  if (chatChanged) {
    clearOwnTyping();
    // Канал, который читали без подписки, не должен оставаться в памяти
    // как «мой чат» после перехода в другой.
    if (previousChatId && previousChatId !== chatId && !state.myChatIds.has(previousChatId)) {
      state.chats.delete(previousChatId);
    }
  }
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
  // Ссылка ?u=@… живёт вместе с открытым чатом: по ней можно поделиться.
  syncChatUrl(state.chats.get(chatId) || null);
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
  if (state.activeChatId && !state.myChatIds.has(state.activeChatId)) {
    state.chats.delete(state.activeChatId); // канал только для чтения
  }
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

/**
 * Открыть канал только для чтения (без подписки). Доступно, если владелец
 * выключил в настройках «Требуется подписка для чтения».
 */
async function openChannelReadOnly(chatId, chat = null) {
  try {
    const loaded = chat || await Chat.getChat(chatId);
    if (!loaded || loaded.type !== 'channel') {
      toast('Не удалось загрузить канал', 'error');
      return;
    }
    state.chats.set(chatId, loaded);
    state.channelPreview = null;
    exitSearchMode();
    selectChat(chatId);
  } catch (error) {
    console.error(error);
    toast('Не удалось загрузить канал', 'error');
  }
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

  dom.chatTitle.textContent = '';
  dom.chatTitle.append(createEl('span', 'chat-title-text', getChatTitle(chat)));
  applyStatus(dom.chatTitle, chatItemStatus(state.activeChatId, chat));
  Emoji.parse(dom.chatTitle);
  applyChatAvatar(dom.chatHeaderAvatar, state.activeChatId, chat);
  updateChatStatus();

  // Правом на запись управляет role-логика: каналы — только админы.
  const canPost = Chat.canPostToChat(chat, state.user?.uid);
  dom.messageInput.disabled = !canPost;
  dom.sendBtn.disabled = !canPost;
  dom.emojiBtn.disabled = !canPost;
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
  const isOpenChannel = Boolean(chat && !isGroup && chat.requiresSubscription === false);

  dom.channelPreview.classList.remove('hidden');
  dom.chatView.classList.add('hidden');
  dom.chatPanelEmpty.classList.add('hidden');

  dom.previewHeading.textContent = isGroup ? 'Предпросмотр группы' : 'Предпросмотр канала';

  if (chat) applyChatAvatar(dom.previewAvatar, chatId, chat);
  else applyAvatar(dom.previewAvatar, chatId, 'К');
  dom.previewTitle.textContent = '';
  dom.previewTitle.append(createEl('span', 'preview-title-text', chat?.title || 'Загрузка…'));
  if (chat) applyChatStatus(dom.previewTitle, chatId);

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

  dom.previewDescription.replaceChildren(...buildMessageText(chat?.description || '').childNodes);
  dom.previewDescription.classList.toggle('hidden', !chat?.description);
  Emoji.parse(dom.previewTitle);
  Emoji.parse(dom.previewDescription);

  if (member) dom.previewSubscribe.textContent = isGroup ? 'Открыть группу' : 'Открыть канал';
  else if (isOpenChannel) dom.previewSubscribe.textContent = 'Читать канал';
  else dom.previewSubscribe.textContent = isGroup ? 'Присоединиться' : 'Подписаться';
  dom.previewSubscribe.disabled = !chat;
}

/**
 * Подпись сообщения для ленты. Пока подпись не меняется, DOM-узел
 * переиспользуется: реакции, просмотры или чужое прочтение больше не
 * пересобирают всю историю чата.
 */
const messageBodySignatureCache = new WeakMap();

/**
 * Неизменяемая часть подписи сообщения (id, текст, реакции, ответ, опрос).
 * Кэш по объекту сообщения: голоса, просмотры и комментарии приходят чаще,
 * чем сами сообщения, а JSON.stringify по каждому сообщению на каждый рендер
 * был основной ценой перерисовки ленты.
 */
function messageBodySignature(message) {
  const cached = messageBodySignatureCache.get(message);
  if (cached !== undefined) return cached;
  const signature = [
    message.id,
    Number(message.timestamp) || 0,
    message.sender || '',
    message.text || '',
    message.editedAt || '',
    message.reactions ? JSON.stringify(message.reactions) : '',
    message.replyTo ? JSON.stringify(message.replyTo) : '',
    message.savedFrom ? JSON.stringify(message.savedFrom) : '',
    message.forwardedFrom ? JSON.stringify(message.forwardedFrom) : '',
    message.poll ? JSON.stringify(message.poll) : '',
  ].join('\u0001');
  messageBodySignatureCache.set(message, signature);
  return signature;
}

function messageRenderSignature(message, chat, showSender) {
  const senderStatus = showSender ? Chat.getCachedUserStatus(message.sender) : null;
  const parts = [
    messageBodySignature(message),
    showSender ? getSenderName(message.sender) : '',
    senderStatus ? JSON.stringify(senderStatus) : '',
    chat?.pinned?.[message.id] ? '1' : '0',
    message.replyTo ? getSenderName(message.replyTo.sender) : '',
  ];
  if (message.poll) {
    // У опроса от результата зависят проценты, а от членства — доступность кнопок.
    parts.push(JSON.stringify(state.pollVotes.get(message.id) || null));
    parts.push(Chat.canVoteInChat(chat, state.user?.uid, state.myChatIds.has(state.activeChatId)) ? '1' : '0');
  }
  if (chat?.type === 'private') {
    parts.push(Number(message.timestamp) <= state.peerReadTs ? 'read' : 'sent');
  }
  if (chat?.type === 'channel') {
    parts.push(String(Object.keys(state.chatViews.get(message.id) || {}).length));
    parts.push(String(Object.keys(state.chatComments.get(message.id) || {}).length));
  }
  return parts.join('\u0001');
}

/**
 * Ключ дня для разделителя дат. Кэш по объекту сообщения: новый Date
 * на каждое сообщение при каждом рендере стоил дороже самой отрисовки.
 */
const messageDayKeyCache = new WeakMap();
function messageDayKey(message) {
  const cached = messageDayKeyCache.get(message);
  if (cached !== undefined) return cached;
  const key = new Date(message.timestamp * 1000).toDateString();
  messageDayKeyCache.set(message, key);
  return key;
}

/** Привести узлы ленты к нужному порядку, лишние убрать из DOM. */
function syncMessageList(container, ordered) {
  const wanted = new Set(ordered);
  for (let index = container.childNodes.length - 1; index >= 0; index -= 1) {
    const child = container.childNodes[index];
    if (!wanted.has(child)) child.remove();
  }

  let ref = container.firstChild;
  for (const el of ordered) {
    if (ref === el) {
      ref = el.nextSibling;
      continue;
    }
    container.insertBefore(el, ref);
  }
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

  // Узлы другого чата переиспользовать нельзя — это другая лента.
  if (state.messageNodesChatId !== state.activeChatId) {
    state.messageNodes = new Map();
    state.messageNodesChatId = state.activeChatId;
  }

  const previousNodes = state.messageNodes;
  const nextNodes = new Map();
  const ordered = [];
  const created = [];

  // Не показываем сообщения из чёрного списка и «удалённые у меня».
  const visible = state.messages.filter((message) => (
    !state.blocked.has(message.sender)
    && !state.localDeleted.has(`${state.activeChatId}/${message.id}`)
  ));

  /** Взять готовый узел по ключу либо собрать новый. */
  const pushNode = (key, signature, build) => {
    const previous = previousNodes.get(key);
    if (previous && previous.sig === signature) {
      nextNodes.set(key, previous);
      ordered.push(previous.el);
      return previous.el;
    }
    const el = build();
    nextNodes.set(key, { el, sig: signature });
    ordered.push(el);
    created.push(el);
    return el;
  };

  let dividerEl = null;

  if (!visible.length) {
    const text = state.messages.length
      ? 'Сообщения скрыты'
      : 'В этом чате пока нет сообщений';
    pushNode('empty', text, () => createEl('p', 'messages-empty', text));
  } else {
    let lastDay = null;

    for (const message of visible) {
      const dayKey = messageDayKey(message);
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        const label = formatDayLabel(message.timestamp);
        pushNode(`d:${dayKey}`, label, () => createEl('div', 'message-day', label));
      }
      // Линия «Новые сообщения» — перед первым сообщением после моего прочтения.
      if (!dividerEl && divider && message.timestamp > divider.ts) {
        dividerEl = pushNode('u', String(divider.ts), buildUnreadDivider);
      }
      pushNode(
        `m:${message.id}`,
        messageRenderSignature(message, chat, showSender),
        () => buildMessageElement(message, showSender),
      );
    }
  }

  syncMessageList(container, ordered);
  state.messageNodes = nextNodes;

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

  // Эмодзи разбираем только в новых узлах, а не во всей истории заново.
  for (const el of created) Emoji.parse(el);

  setupViewsObserver(chat, visible, created);
  renderPinBar();
  hydrateUsers(visible.map((message) => message.sender));
}

/**
 * Отложенная перерисовка ленты. Голоса опросов, комментарии и просмотры
 * приходят пачками (особенно при открытии канала) — склеиваем их в один
 * рендер, как это уже сделано для списка чатов.
 */
function scheduleMessagesRender() {
  if (messagesRenderHandle || messagesRenderFallback) return;

  const run = () => {
    if (messagesRenderHandle) cancelAnimationFrame(messagesRenderHandle);
    messagesRenderHandle = 0;
    if (messagesRenderFallback) {
      window.clearTimeout(messagesRenderFallback);
      messagesRenderFallback = 0;
    }
    renderMessages();
  };

  messagesRenderHandle = requestAnimationFrame(run);
  // requestAnimationFrame не срабатывает в скрытом или перекрытом окне.
  messagesRenderFallback = window.setTimeout(run, 250);
}

/**
 * Просмотры постов канала: пост считается просмотренным,
 * если пробыл в зоне видимости ~700 мс (и это не моё сообщение).
 * Наблюдатель живёт, пока открыт канал: обновление счётчиков просмотров
 * не пересоздаёт его и не переподписывает всю ленту.
 */
function setupViewsObserver(chat, visible, created = []) {
  if (chat?.type !== 'channel') {
    messagesObserver?.disconnect();
    messagesObserver = null;
    messagesObserverChatId = null;
    viewsPending.clear();
    return;
  }

  const observePost = (message) => {
    if (message.sender === state.user?.uid) return; // свои посты в статистику не идут
    const node = state.messageNodes.get(`m:${message.id}`);
    if (node?.el) messagesObserver.observe(node.el);
  };

  if (!messagesObserver || messagesObserverChatId !== state.activeChatId) {
    messagesObserver?.disconnect();
    viewsPending.clear();
    messagesObserverChatId = state.activeChatId;
    // Наблюдатель живёт дольше одного рендера: запоминаем канал, чтобы
    // просмотр не улетел в чат, открытый уже после переключения.
    const observerChatId = messagesObserverChatId;
    messagesObserver = new IntersectionObserver((entries) => {
      if (state.activeChatId !== observerChatId) return;
      for (const entry of entries) {
        const msgId = entry.target.dataset.msgId;
        if (!msgId) continue;

        if (entry.isIntersecting) {
          if (viewsPending.has(msgId)) continue;
          viewsPending.set(msgId, window.setTimeout(() => {
            viewsPending.delete(msgId);
            recordMessageView(msgId, observerChatId);
          }, 700));
        } else {
          clearTimeout(viewsPending.get(msgId));
          viewsPending.delete(msgId);
        }
      }
    }, { threshold: 0.6 });

    for (const message of visible) observePost(message);
  } else {
    // Тот же канал: подписываем только новые посты.
    for (const el of created) {
      if (el.dataset?.msgId && !el.classList.contains('own')) messagesObserver.observe(el);
    }
  }

  // Страховка: если IntersectionObserver не доставил событие (фоновая вкладка,
  // ленивый рендер), учитываем только что добавленные посты в видимой зоне.
  if (!created.length) return;
  const fallbackChatId = state.activeChatId;
  const containerRect = dom.messages.getBoundingClientRect();
  for (const el of created) {
    const msgId = el.dataset?.msgId;
    if (!msgId || el.classList.contains('own') || viewsPending.has(msgId)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) continue;

    viewsPending.set(msgId, window.setTimeout(() => {
      viewsPending.delete(msgId);
      if (state.activeChatId !== fallbackChatId) return; // чат уже переключили
      const nowEl = findMessageElement(msgId);
      if (!nowEl) return;
      const nowRect = nowEl.getBoundingClientRect();
      const nowContainer = dom.messages.getBoundingClientRect();
      // Пост всё ещё в ленте на виду — засчитываем просмотр.
      if (nowRect.bottom > nowContainer.top && nowRect.top < nowContainer.bottom) {
        recordMessageView(msgId, fallbackChatId);
      }
    }, 700));
  }
}

/** Учесть уникальный просмотр поста (один раз за сессию). */
function recordMessageView(msgId, chatId = state.activeChatId) {
  // Просмотр засчитываем только для открытого сейчас канала: таймер мог
  // сработать уже после переключения ленты.
  if (!chatId || chatId !== state.activeChatId || !state.user) return;
  const key = `${chatId}/${msgId}`;
  if (state.viewedMessages.has(key)) return;
  state.viewedMessages.add(key);
  Chat.recordView(chatId, msgId, state.user.uid).catch(() => {});
}

/** Найти DOM-элемент сообщения в ленте по id. */
function findMessageElement(msgId) {
  const node = state.messageNodes.get(`m:${msgId}`);
  if (node?.el) return node.el;
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

/** Регулярка ссылок, @упоминаний и #хэштегов в тексте сообщения. */
const MESSAGE_LINK_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+|[@#][A-Za-z0-9_А-Яа-яЁё]{2,32})/gi;

/** Убрать хвостовую пунктуацию, которая обычно не относится к ссылке. */
function trimTrailingUrlPunctuation(url) {
  let result = String(url || '').replace(/[.,;:!?…»"']+$/, '');
  // Закрывающая скобка остаётся, только если в ссылке есть открывающая.
  for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
    while (result.endsWith(close) && result.split(close).length > result.split(open).length) {
      result = result.slice(0, -1);
    }
  }
  return result;
}

/** Текст сообщения с кликабельными ссылками, упоминаниями и хэштегами. */
function buildMessageText(text) {
  const span = createEl('span', 'bubble-text');
  for (const part of String(text || '').split(MESSAGE_LINK_REGEX)) {
    if (!part) continue;
    if (/^(?:https?:\/\/|www\.)/i.test(part)) {
      const clean = trimTrailingUrlPunctuation(part);
      const suffix = part.slice(clean.length);
      if (clean) {
        const link = createEl('a', 'msg-link msg-url', clean);
        link.href = /^www\./i.test(clean) ? 'https://' + clean : clean;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        span.append(link);
      }
      if (suffix) span.append(document.createTextNode(suffix));
    } else if (/^[@#][A-Za-z0-9_А-Яа-яЁё]{2,32}$/.test(part)) {
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

/** Клик по @упоминанию / #хэштегу: сразу открыть адресата, а не поиск. */
async function openMentionOrHashtag(token) {
  const value = String(token || '').trim();
  // Хэштеги ищутся как обычный запрос, а @упоминание ведёт прямо к человеку,
  // каналу или группе — поиск остаётся запасным путём, если адресат не найден.
  if (!value.startsWith('@')) {
    openGlobalSearch(value);
    return;
  }
  await openDeepLinkUsername(value);
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
    const sender = createEl('div', 'message-sender');
    sender.append(createEl('span', 'message-sender-name', own ? 'Вы' : getSenderName(message.sender)));
    applyUserStatus(sender, message.sender);
    wrap.append(sender);
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

    // Та же кнопка, что и в меню: открывает общий пикер в режиме реакции.
    const add = createEl('button', 'reaction-pill reaction-add');
    add.type = 'button';
    add.title = 'Добавить реакцию';
    add.setAttribute('aria-label', 'Добавить реакцию');
    add.append(createIcon('plus', 'reaction-add-icon'));
    add.addEventListener('click', (event) => {
      event.stopPropagation();
      openReactionPicker(message, add);
    });
    row.append(add);
    bubble.append(row);
  }

  wrap.append(bubble);

  // Меню сообщения: ПКМ на десктопе, долгое нажатие на тач-экранах.
  // В режиме выделения текста работает штатное меню браузера (копирование).
  wrap.addEventListener('contextmenu', (event) => {
    if (wrap.classList.contains('text-selectable')) return;
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
    if (wrap.classList.contains('text-selectable')) return;
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
    if (pinBarSignature === '') return;
    pinBarSignature = '';
    dom.pinBar.classList.add('hidden');
    dom.pinBarTitle.textContent = '';
    dom.pinBarText.textContent = '';
    dom.pinBarCount.textContent = '';
    return;
  }

  state.pinIndex = ((state.pinIndex % pins.length) + pins.length) % pins.length;
  const pin = pins[state.pinIndex];

  // Плашка меняется только вместе с закрепом: на каждый рендер ленты
  // (голоса, просмотры, комментарии) переписывать её незачем.
  const signature = [
    state.pinIndex,
    pins.length,
    pin.msgId,
    pin.text,
    pin.sender ? getSenderName(pin.sender) : '',
  ].join('\u0001');
  if (signature === pinBarSignature) return;
  pinBarSignature = signature;

  dom.pinBar.classList.remove('hidden');
  dom.pinBarTitle.textContent = pin.sender ? getSenderName(pin.sender) : 'Закреплённое сообщение';
  dom.pinBarText.textContent = pin.text || 'Без текста';
  dom.pinBarCount.textContent = `${state.pinIndex + 1}/${pins.length}`;
  Emoji.parse(dom.pinBar);

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
  const chatIdSet = new Set(chatIds);

  // Отписываемся от чатов, которых больше нет у пользователя.
  for (const [chatId, unsubscribe] of state.subscriptions.chatMeta) {
    if (!chatIdSet.has(chatId)) {
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

        // Перерисовку списка склеиваем: при входе данные по десяткам чатов
        // приходят подряд, и каждый рендер строил весь список заново.
        scheduleChatListRender();
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

  scheduleChatListRender();
  if (state.channelPreview) renderMainPanel(); // могли подписаться из другого клиента
}

/**
 * Подписки, без которых не построить список чатов. Запускаются сразу после
 * проверки аккаунта, ещё до чтения профиля: пока идёт запрос /users/$uid,
 * список чатов уже наполняется. Так вход экономит один круг сети.
 */
function startChatListSubscriptions(uid) {
  if (!state.user || state.subscriptions.userChats) return;

  state.subscriptions.userChats = Chat.subscribeToUserChats(
    uid,
    handleUserChatsUpdate,
    () => toast('Не удалось загрузить список чатов', 'error'),
  );

  // Архив, закреп и папки — личные настройки списка чатов.
  state.subscriptions.userMeta = Chat.subscribeToUserChatMeta(uid, (map) => {
    state.chatMeta = new Map(Object.entries(map || {}));
    scheduleChatListRender();
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
    scheduleChatListRender();
    if (!dom.chatCtxOverlay.classList.contains('hidden')) renderChatCtxFolders();
  });

  // Мои прочтения — точки непрочитанного в списке чатов.
  state.subscriptions.userReads = Chat.subscribeToUserReads(uid, (map) => {
    state.reads = new Map(Object.entries(map || {}).map(([chatId, ts]) => [chatId, Number(ts) || 0]));
    scheduleChatListRender();
  });
}

/** Запустить подписки после входа. */
function startSubscriptions() {
  if (!state.user || subscriptionsStarted) return;
  subscriptionsStarted = true;
  const uid = state.user.uid;

  // Свой профиль тоже живой: имя и аватарка меняются с другого устройства.
  watchUserProfiles([uid]);

  startChatListSubscriptions(uid);

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
    scheduleChatListRender();
  });

  // Мои настройки (приватность последнего визита) и присутствие.
  state.subscriptions.userSettings = Chat.subscribeToUserSettings(uid, (settings) => {
    state.settings = { lastSeenPrivacy: 'all', ...(settings || {}) };
    renderPrefsModal();
    scheduleChatListRender(); // скрытие промо-канала @dev могло измениться с другого устройства
  });
  state.subscriptions.presence = Chat.startPresence(uid);

  // Супер-администраторы и баны (тестовые права модерации).
  state.subscriptions.rootAdmins = Chat.subscribeToRootAdmins((map) => {
    state.rootAdmins = new Set(Object.keys(map || {}).filter((key) => map[key]));
    renderPrefsModal();
    refreshUsernameAdminBlocks();
  });
  state.subscriptions.usernameAliases = Chat.subscribeToUsernameAliases((map) => {
    state.usernameAliases = new Map(Object.entries(map || {}));
    if (!dom.profileOverlay.classList.contains('hidden')) renderProfileAliases();
    if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
    if (!dom.settingsOverlay.classList.contains('hidden')) renderSettingsAliases();
    if (!dom.aliasesOverlay.classList.contains('hidden')) loadUsernameAliases();
    refreshTargetAdminCard();
  });
  // Статусы пользователей, каналов и групп видны всем; меняет их только супер-админ.
  state.subscriptions.userStatuses = Chat.subscribeToUserStatuses(() => {
    updateSidebarUser();
    scheduleProfileRefresh();
    if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
    if (!dom.prefsOverlay.classList.contains('hidden')) {
      renderStatusPreview();
      renderCurrentStatus();
    }
    refreshTargetAdminCard();
  });
  state.subscriptions.chatStatuses = Chat.subscribeToChatStatuses(() => {
    scheduleProfileRefresh();
    if (!dom.prefsOverlay.classList.contains('hidden')) {
      renderStatusPreview();
      renderCurrentStatus();
    }
    refreshTargetAdminCard();
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
  sessionStartedForUid = null;
  loginIndexBackfilledFor = null;
  subscriptionsStarted = false;
  stopProfileWatch();

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
  state.subscriptions.myDeleted?.();
  state.subscriptions.bans?.();
  state.subscriptions.rootAdmins?.();
  state.subscriptions.usernameAliases?.();
  state.subscriptions.userStatuses?.();
  state.subscriptions.chatStatuses?.();
  Chat.clearUserStatusCache();
  Chat.clearChatStatusCache();
  for (const unsubscribe of state.subscriptions.chatMeta.values()) unsubscribe();
  clearChatScoped();
  clearInterval(typingTick);
  typingTick = null;
  if (uid && !state.myDeleted) Chat.setOfflinePresence(uid).catch(() => {});

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
  state.subscriptions.myDeleted = null;
  state.subscriptions.bans = null;
  state.subscriptions.rootAdmins = null;
  state.subscriptions.usernameAliases = null;
  state.subscriptions.userStatuses = null;
  state.subscriptions.chatStatuses = null;
  state.subscriptions.chatMeta.clear();
  state.chats.clear();
  state.myChatIds = new Set();
  state.activeChatId = null;
  state.messages = [];
  state.messageNodes = new Map();
  state.messageNodesChatId = null;
  chatListSignature = null;
  chatListNodes = new Map();
  pinBarSignature = null;
  foldersBarSignature = null;
  cancelAnimationFrame(chatListRenderHandle);
  chatListRenderHandle = 0;
  window.clearTimeout(chatListRenderFallback);
  chatListRenderFallback = 0;
  cancelAnimationFrame(messagesRenderHandle);
  messagesRenderHandle = 0;
  window.clearTimeout(messagesRenderFallback);
  messagesRenderFallback = 0;
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
  state.usernameAliases = new Map();
  state.bannedUsers = new Set();
  state.myBan = null;
  state.myDeleted = false;
  state.unreadCounts = new Map();
  state.unreadFetches = new Set();
  state.msgCache = new Map();
  state.viewedMessages = new Set();
  closeMsgMenu();
  cancelComposerMode();
  closeChatCtxMenu();
  closePrefsModal();
  closeInvitesModal();
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
  closePrefsModal();
  dom.messengerScreen.classList.add('hidden');
  dom.onboardingScreen.classList.add('hidden');
  hideInviteGateScreen();
  dom.authScreen.classList.remove('hidden');
  hideBannedScreen();
  document.body.classList.remove('chat-open');
  dom.authPassword.value = '';
  hideAuthError();
}

/**
 * Убрать экран загрузки: нужный экран (вход, онбординг или мессенджер)
 * уже показан. Повторные вызовы безопасны.
 */
function hideBootScreen() {
  if (!dom.bootScreen || dom.bootScreen.classList.contains('hidden')) return;
  dom.bootScreen.classList.add('hidden');
}

/**
 * Выход прямо с экрана загрузки: не ждём восстановления сессии, если вход
 * завис или нужно войти под другим аккаунтом. Пока модуль не загрузился,
 * кнопка работает по запасному пути из index.html (чистит сохранённый вход).
 */
window.beaconBootLogout = async () => {
  if (!dom.bootLogoutBtn) return;
  const prevStatus = dom.bootStatus ? dom.bootStatus.textContent : '';
  dom.bootLogoutBtn.disabled = true;
  if (dom.bootStatus) dom.bootStatus.textContent = 'Выходим…';

  try {
    await logoutCurrentUser();
  } catch (error) {
    console.error('Не удалось выйти из аккаунта:', error);
  }

  // При успешном выходе экран загрузки закроет маршрут авторизации.
  if (dom.bootScreen && !dom.bootScreen.classList.contains('hidden')) {
    // Входа могло уже не быть (устаревший ключ в хранилище) — тогда просто
    // открываем форму входа, иначе она так и останется за экраном загрузки.
    if (!state.user) {
      showAuthScreen();
      hideBootScreen();
      return;
    }
    dom.bootLogoutBtn.disabled = false;
    if (dom.bootStatus) dom.bootStatus.textContent = prevStatus;
    toast('Не удалось выйти из аккаунта', 'error');
  }
};

/** Экран требования инвайт-кода: аккаунт создан, но профиль ещё не разрешён. */
function showInviteGateScreen(user) {
  closePrefsModal();
  dom.authScreen.classList.add('hidden');
  dom.onboardingScreen.classList.add('hidden');
  dom.messengerScreen.classList.add('hidden');
  hideBannedScreen();
  document.body.classList.remove('chat-open');

  dom.inviteGateEmail.textContent = user?.email || '';
  if (!dom.inviteGateCode.value) {
    dom.inviteGateCode.value = Invites.formatInviteCode(dom.authInvite.value || deepLink.invite || '');
  }

  if (lastInviteError) {
    dom.inviteGateError.textContent = lastInviteError;
    dom.inviteGateError.classList.remove('hidden');
  } else {
    dom.inviteGateError.classList.add('hidden');
  }

  dom.inviteGateScreen.classList.remove('hidden');
  setTimeout(() => dom.inviteGateCode.focus(), 0);
}

function hideInviteGateScreen() {
  dom.inviteGateScreen.classList.add('hidden');
  dom.inviteGateError.classList.add('hidden');
  dom.inviteGateError.textContent = '';
}

/** Убрать ?invite_code= из адресной строки после успешного применения кода. */
function clearInviteParamFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('invite_code')) return;
    url.searchParams.delete('invite_code');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', next);
  } catch {
    // История недоступна — не критично.
  }
}

/** Экран первого заполнения профиля после входа. */
function showOnboardingScreen() {
  dom.authScreen.classList.add('hidden');
  dom.messengerScreen.classList.add('hidden');
  hideInviteGateScreen();
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
  hideInviteGateScreen();
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

  // Глубокая ссылка из адресной строки: /?s=… или /?u=@…
  applyDeepLink();
}

function showAuthError(message) {
  dom.authError.textContent = message;
  dom.authError.classList.remove('hidden');
}

function hideAuthError() {
  dom.authError.classList.add('hidden');
}

/** Понятный текст: ошибки инвайтов уже на русском, остальные — из Auth. */
function authFormError(error) {
  if (String(error?.code || '').startsWith('beacon/')) {
    return error.message || 'Не удалось применить инвайт-код';
  }
  return Auth.getAuthErrorMessage(error);
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

  // Инвайт-код нужен только при регистрации.
  dom.authInviteField.classList.toggle('hidden', !isRegister);
  dom.authInvite.required = isRegister;
  dom.googleBtnLabel.textContent = isRegister ? 'Зарегистрироваться через Google' : 'Войти через Google';

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
  renderProfileAliases();
  refreshReservedNameCache();
  initAvatarEditor();
  dom.profileError.classList.add('hidden');
  dom.pfUsername.focus();
}

function closeProfileModal() {
  ColorPicker.closeColorPicker();
  dom.profileOverlay.classList.add('hidden');
}

/** Строка «А также …» в профиле: дополнительные имена ведут на основной. */
function renderProfileAliases() {
  applyAliasHint(dom.profileAliases, 'user', state.user?.uid);
  renderProfileAdminRow();
}

/** Компактная строка «Юзернеймы и статус» в своём профиле. */
function renderProfileAdminRow() {
  if (!dom.profileAdminField) return;
  const username = state.profile?.username || '';
  const visible = Boolean(adminRightsOn() && state.user && username);
  dom.profileAdminField.classList.toggle('hidden', !visible);
  if (!visible) return;

  const aliases = aliasesForTarget('user', state.user.uid).length;
  const hint = [
    aliases ? `доп. имён: ${aliases}` : '',
    userStatusFor(state.user.uid) ? 'есть статус' : '',
  ].filter(Boolean).join(' · ');
  dom.profileAdminHint.textContent = hint || 'Доп. имена, резерв, статус';
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
  const fallbackName = (state.profile?.firstName || state.profile?.username || '').trim();
  avatarDraft.custom = false;
  avatarDraft.kind = avatar?.kind === 'emoji' ? 'emoji' : 'letter';
  avatarDraft.value = avatarDraft.kind === 'letter'
    ? firstLetter(avatar?.value, firstLetter(fallbackName, ''))
    : (avatar?.value || firstLetter(fallbackName, ''));
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
  ColorPicker.syncColorChip(dom.avatarPick1, dom.avatarHex1);
  ColorPicker.syncColorChip(dom.avatarPick2, dom.avatarHex2);

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
    if (avatarDraft.kind === 'letter') {
      // Эмодзи и суррогатные пары обрезать нельзя: берём первую настоящую букву,
      // иначе падаем на первую букву имени.
      const fallbackName = (state.profile?.firstName || state.profile?.username || '').trim();
      avatarDraft.value = firstLetter(avatarDraft.value, firstLetter(fallbackName, ''));
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

// Чип рядом с HEX открывает общий пикер цвета: любой оттенок, а не только палитра.
ColorPicker.bindColorField({ chip: dom.avatarPick1, input: dom.avatarHex1, presets: AVATAR_COLORS });
ColorPicker.bindColorField({ chip: dom.avatarPick2, input: dom.avatarHex2, presets: AVATAR_COLORS });

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

/** Черновики, ещё не сброшенные в localStorage: chatId -> текст. */
const pendingDrafts = new Map();
let draftsFlushTimer = 0;

/** Ключ черновика чата в localStorage. */
function draftKey(chatId) {
  return `${DRAFT_PREFIX}${chatId}`;
}

/** Собственно запись в localStorage. */
function persistDraft(chatId, value) {
  try {
    const text = String(value ?? '');
    if (text.trim()) localStorage.setItem(draftKey(chatId), text);
    else localStorage.removeItem(draftKey(chatId));
  } catch (error) { /* приватный режим — черновик просто не сохранится */ }
}

/** Записать все отложенные черновики (смена чата, отправка, выход, выгрузка). */
function flushDrafts() {
  if (draftsFlushTimer) {
    window.clearTimeout(draftsFlushTimer);
    draftsFlushTimer = 0;
  }
  if (!pendingDrafts.size) return;
  for (const [chatId, text] of pendingDrafts) persistDraft(chatId, text);
  pendingDrafts.clear();
}

/**
 * Сохранить черновик чата (пустой текст — удаляем запись).
 * Запись отложена: localStorage синхронный, и писать его на каждое нажатие
 * клавиши — лишняя работа в обработчике ввода.
 */
function saveDraft(chatId, value) {
  if (!chatId) return;
  pendingDrafts.set(chatId, String(value ?? ''));
  if (draftsFlushTimer) return;
  draftsFlushTimer = window.setTimeout(flushDrafts, 400);
}

/** Черновик чата ('' — черновика нет). */
function loadDraft(chatId) {
  if (!chatId) return '';
  if (pendingDrafts.has(chatId)) return pendingDrafts.get(chatId);
  try {
    return localStorage.getItem(draftKey(chatId)) || '';
  } catch (error) {
    return '';
  }
}

/** Убрать черновик чата (после отправки). */
function clearDraft(chatId) {
  if (!chatId) return;
  pendingDrafts.delete(chatId);
  try {
    localStorage.removeItem(draftKey(chatId));
  } catch (error) { /* ignore */ }
}

window.addEventListener('beforeunload', flushDrafts);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushDrafts();
});

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
  // Замер высоты заставляет браузер пересчитывать вёрстку. Пока текст и ширина
  // поля не менялись (например, пришло новое сообщение), повторять его незачем.
  const width = el.clientWidth;
  if (composerMeasure.value === el.value && composerMeasure.width === width) return;
  composerMeasure = { value: el.value, width };

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

/** Вставить эмодзи в поле ввода в позицию курсора. */
function insertEmojiIntoComposer(emoji) {
  const input = dom.messageInput;
  if (!input || input.disabled || !state.activeChatId) return;

  const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
  const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
  input.setRangeText(emoji, start, end, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));

  // На мобильных не возвращаем фокус: иначе сразу выедет клавиатура
  // и закроет панель эмодзи. На ПК — наоборот, продолжаем печатать.
  if (!window.matchMedia?.('(max-width: 768px)').matches) {
    input.focus({ preventScroll: true });
  }
}

/** Выбор из общего пикера: вставка в сообщение или реакция. */
function handleEmojiSelect(emoji, context) {
  if (context.mode === 'reaction') {
    if (context.message) toggleReaction(context.message, emoji);
    return;
  }
  insertEmojiIntoComposer(emoji);
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
  stopTextSelection();
  state.msgMenuMessage = message;
  state.msgMenuPos = { x, y };

  renderMsgMenuReactions(message);
  renderMsgMenuActions(message);

  dom.msgMenuOverlay.classList.remove('hidden');
  positionMsgMenu();
  Emoji.parse(dom.msgMenu);
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

/** Ряд из шести быстрых реакций; полный набор открывает общий пикер. */
function renderMsgMenuReactions(message) {
  dom.msgMenuReactions.innerHTML = '';
  REACTIONS_TOP.forEach((emoji) => dom.msgMenuReactions.append(buildReactionButton(message, emoji)));
}

/** Открыть общий пикер эмодзи в режиме выбора реакции. */
function openReactionPicker(message, anchor) {
  if (!message) return;
  Emoji.openPicker({
    mode: 'reaction',
    anchor,
    message,
    selected: Object.keys(message.reactions || {}),
  });
}

/** Действия в меню сообщения: ответ, правка, копия, выделение, пересылка, закреп, удаление. */
function renderMsgMenuActions(message) {
  const chat = state.chats.get(state.activeChatId) || null;
  const own = message.sender === state.user?.uid;
  const canPost = Chat.canPostToChat(chat, state.user?.uid);
  const pinned = Boolean(chat?.pinned?.[message.id]);

  dom.msgMenuActions.innerHTML = '';
  const add = (icon, label, handler, danger = false) => {
    const btn = createEl('button', danger ? 'msg-menu-action danger' : 'msg-menu-action');
    btn.type = 'button';
    if (icon) btn.append(createIcon(icon, 'msg-menu-icon'));
    btn.append(createEl('span', 'msg-menu-action-label', label));
    btn.addEventListener('click', handler);
    dom.msgMenuActions.append(btn);
    return btn;
  };

  if (canPost) {
    add('reply', 'Ответить', () => {
      closeMsgMenu();
      setComposerMode({ type: 'reply', message });
    });
  }
  if (own && !message.poll) {
    add('edit', 'Изменить', () => {
      closeMsgMenu();
      setComposerMode({ type: 'edit', message });
    });
  }
  add('copy', 'Копировать', () => {
    closeMsgMenu();
    copyMessageText(message);
  });
  if (message.text) {
    add('select', 'Выбрать текст', () => {
      startTextSelection(message);
    });
  }
  add('forward', 'Переслать', () => {
    closeMsgMenu();
    openForwardModal(message);
  });

  // «Избранное»: закладка на сообщение (идея 20).
  if (chat?.type !== 'saved' && (message.text || message.poll)) {
    add('saved', 'В избранное', () => {
      closeMsgMenu();
      saveMessageToFavorites(message);
    });
  }

  // Комментарии к посту канала (идея 13).
  if (chat?.type === 'channel') {
    add('comment', 'Комментарии', () => {
      closeMsgMenu();
      openCommentsModal(message);
    });
  }

  if (canPost) {
    add('pin', pinned ? 'Открепить' : 'Закрепить', async () => {
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
  add('trash', 'Удалить', () => {
    closeMsgMenu();
    requestDeleteMessage(message);
  }, true);
}

/** Скопировать произвольный текст в буфер обмена (с запасным способом). */
async function copyToClipboard(text) {
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

  return copied;
}

/** Скопировать текст сообщения в буфер обмена. */
async function copyMessageText(message) {
  const copied = await copyToClipboard(message.text || '');
  toast(copied ? 'Скопировано' : 'Не удалось скопировать', copied ? 'success' : 'error');
}

/* --- Режим выделения текста сообщения --- */

/** Выключить режим выделения текста. */
function stopTextSelection() {
  document.querySelectorAll('.message.text-selectable').forEach((node) => {
    node.classList.remove('text-selectable');
  });
}

/**
 * Разрешить выделение и копирование текста одного сообщения.
 * По умолчанию выделение в ленте выключено, чтобы ПКМ и долгое нажатие
 * открывали меню сообщения, а не выделяли текст.
 */
function startTextSelection(message) {
  closeMsgMenu();
  stopTextSelection();

  const node = [...document.querySelectorAll('.messages .message')]
    .find((item) => item.dataset.msgId === message.id);

  if (!node) {
    toast('Не удалось найти сообщение в ленте', 'error');
    return;
  }

  node.classList.add('text-selectable');
  toast('Выделите нужную часть текста и скопируйте');
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
    top.append(buildNameWithStatus(getChatTitle(chat), chatItemStatus(chatId, chat)));
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
    const forwardedFrom = { uid: message.sender, name: getSenderName(message.sender) };
    if (message.poll) {
      // Опрос пересылаем как новый опрос: вопрос, варианты и режим ответа
      // сохраняются, а голоса не переносятся — они привязаны к id сообщения.
      await Chat.sendPollMessage(chatId, state.user.uid, {
        question: message.poll.question,
        options: (message.poll.options || []).map((option) => option.text),
        multiple: Boolean(message.poll.multiple),
        forwardedFrom,
      });
    } else {
      await Chat.sendMessage(chatId, state.user.uid, message.text, { forwardedFrom });
    }
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

/** Показать экран ограничения доступа: бан или удалённый аккаунт. */
function showAccessRestrictedScreen(kind = 'banned') {
  if (kind === 'deleted') {
    dom.bannedTitle.textContent = 'Аккаунт удалён';
    dom.bannedText.innerHTML = 'Этот аккаунт был удалён.<br />Восстановить его нельзя.';
  } else {
    dom.bannedTitle.textContent = 'Доступ ограничен';
    dom.bannedText.innerHTML = 'Ваш аккаунт заблокирован администратором.<br />Если это ошибка — свяжитесь с поддержкой.';
  }
  dom.bannedScreen.classList.remove('hidden');
}

/** Показать экран блокировки (бан). */
function showBannedScreen() {
  showAccessRestrictedScreen('banned');
}

/** Показать экран удалённого аккаунта. */
function showDeletedScreen() {
  showAccessRestrictedScreen('deleted');
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

  // Участники группы: список и добавление живут в отдельном окне.
  dom.settingsMembersBlock.classList.toggle('hidden', !isGroup);
  dom.settingsMemberAddRow.classList.toggle('hidden', !canManageMembers);
  dom.settingsMemberInput.value = '';
  if (isGroup) renderSettingsMembers(chat);

  // Доступ к чтению: только для каналов. Старые каналы без поля считаем
  // закрытыми — поведение по умолчанию не меняется.
  dom.settingsChannelBlock.classList.toggle('hidden', !isChannel);
  dom.settingsRequiresSubscription.checked = chat.requiresSubscription !== false;

  // Администраторы канала: список и добавление живут в отдельном окне.
  dom.settingsAdminInput.value = '';
  if (isChannel) renderSettingsAdmins(chat);

  // Строки «Участники» и «Администраторы» в основных настройках.
  dom.settingsParticipantsBlock.classList.toggle('hidden', !isGroup && !isChannel);
  dom.settingsMembersBtn.classList.toggle('hidden', !isGroup);
  dom.settingsAdminsBtn.classList.toggle('hidden', !isChannel);
  dom.settingsMembersHint.textContent = `Участники · ${Object.keys(chat.users || {}).length}`;
  dom.settingsAdminsHint.textContent = `Администраторы · ${Object.keys(chat.admins || {}).length}`;
  dom.settingsMembersOverlay.classList.add('hidden');
  dom.settingsAdminsOverlay.classList.add('hidden');

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
  renderSettingsAliases();
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
  ColorPicker.closeColorPicker();
  dom.settingsMembersOverlay.classList.add('hidden');
  dom.settingsAdminsOverlay.classList.add('hidden');
  dom.settingsOverlay.classList.add('hidden');
}

/** Дополнительные имена публичной группы в её настройках. */
function renderSettingsAliases() {
  const chat = settingsChatId ? state.chats.get(settingsChatId) : null;
  if (!chat || chat.type !== 'group') {
    applyAliasHint(dom.settingsUsernameAliases, '', '');
    return;
  }
  applyAliasHint(dom.settingsUsernameAliases, 'group', settingsChatId);
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
    top.append(buildUserNameWithStatus(getProfileName(profile) || 'Пользователь', uid));
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
    top.append(buildUserNameWithStatus(getProfileName(profile) || 'Пользователь', uid));
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

    // Удалять участников может владелец группы (и супер-админ).
    if ((chat.owner === myUid || adminRightsOn()) && uid !== chat.owner) {
      const remove = createEl('button', 'unsubscribe-btn', 'Убрать');
      remove.type = 'button';
      remove.title = 'Удалить из группы';
      remove.addEventListener('click', () => removeSettingsMember(uid, remove));
      item.append(remove);
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

/** Удалить участника из группы (кнопка «Убрать» в списке настроек). */
async function removeSettingsMember(uid, buttonEl) {
  if (!settingsChatId || !state.user) return;
  const chat = state.chats.get(settingsChatId);
  if (!chat) return;
  const name = getProfileName(Chat.getCachedUserProfile(uid)) || 'участника';
  if (!window.confirm(`Удалить участника «${name}» из группы?`)) return;

  buttonEl.disabled = true;
  try {
    const result = await Chat.removeGroupMember(settingsChatId, state.user.uid, uid);
    toast(result?.removed === false ? 'Пользователя нет в группе' : 'Участник удалён');

    const live = await Chat.getChat(settingsChatId);
    if (live) {
      state.chats.set(settingsChatId, live);
      if (!dom.settingsOverlay.classList.contains('hidden')) renderSettingsMembers(live);
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось удалить участника', 'error');
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
  ColorPicker.syncColorChip(dom.settingsAvatarPick1, dom.settingsAvatarHex1);
  ColorPicker.syncColorChip(dom.settingsAvatarPick2, dom.settingsAvatarHex2);

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

ColorPicker.bindColorField({ chip: dom.settingsAvatarPick1, input: dom.settingsAvatarHex1, presets: AVATAR_COLORS });
ColorPicker.bindColorField({ chip: dom.settingsAvatarPick2, input: dom.settingsAvatarHex2, presets: AVATAR_COLORS });

/* ============================================================
 *  Всплывающее меню чата (клик по аватарке в шапке)
 * ============================================================ */

/** Открыть меню: аватарка, описание, действия, участники/админы. */
function openChatMenu() {
  if (!state.activeChatId) return;
  renderChatMenu();
  refreshReservedNameCache();
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
  dom.chatMenuTitle.textContent = '';
  dom.chatMenuTitle.append(createEl('span', 'chat-title-text', getChatTitle(chat)));
  applyStatus(dom.chatMenuTitle, chatItemStatus(state.activeChatId, chat));
  Emoji.parse(dom.chatMenuTitle);
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
  dom.chatMenuDescription.replaceChildren(...buildMessageText(description).childNodes);
  dom.chatMenuDescription.classList.toggle('hidden', !description);
  dom.chatMenuUsername.textContent = handle;
  dom.chatMenuUsername.classList.toggle('hidden', !handle);

  // Дополнительные юзернеймы — под основным, с припиской «А также».
  if (chat.type === 'private') {
    applyAliasHint(dom.chatMenuAliases, peerUid ? 'user' : '', peerUid || '');
  } else {
    applyAliasHint(dom.chatMenuAliases, chat.type, state.activeChatId);
  }
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
  if (chat.type === 'group' && chat.owner !== myUid && chat.users?.[myUid]) {
    addChatMenuAction('Покинуть группу', leaveActiveGroup);
  }
  if (chat.type === 'channel' && chat.owner !== myUid && state.myChatIds.has(state.activeChatId)) {
    addChatMenuAction('Отписаться от канала', unsubscribeFromActiveChannel);
  }
  if (chat.type === 'channel' && !state.myChatIds.has(state.activeChatId)) {
    addChatMenuAction('Подписаться на канал', subscribeToActiveChannel);
  }

  // Статистика канала — администраторам канала и супер-админу (идея 14).
  if (chat.type === 'channel' && (chat.admins?.[myUid] || rootAdmin)) {
    addChatMenuAction('Статистика канала', () => {
      closeChatMenu();
      openStatsModal();
    }, 'chart');
  }

  // Супер-админ: карточка юзернеймов и статуса текущей цели.
  const adminTarget = chatAdminTarget(chat, peerUid);
  if (adminTarget) {
    addChatMenuAction('Юзернеймы и статус', () => {
      closeChatMenu();
      openTargetAdmin(adminTarget);
    }, 'key');
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

/** Цель для карточки админа в меню чата: {type, id, username} или null. */
function chatAdminTarget(chat, peerUid) {
  if (!adminRightsOn()) return null;

  if (chat.type === 'private' && peerUid && peerUid !== state.user?.uid) {
    const username = Chat.getCachedUserProfile(peerUid)?.username || '';
    return username ? { type: 'user', id: peerUid, username } : null;
  }
  if (chat.type === 'channel' || chat.type === 'group') {
    const username = chat.username || '';
    return username ? { type: chat.type, id: state.activeChatId, username } : null;
  }
  return null;
}

/** Подписаться на канал из режима чтения без подписки. */
async function subscribeToActiveChannel() {
  const chatId = state.activeChatId;
  const chat = state.chats.get(chatId);
  if (!chat || chat.type !== 'channel' || !state.user) return;

  try {
    await Chat.subscribeToChannel(state.user.uid, chatId);
    closeChatMenu();
    toast('Вы подписались на канал', 'success');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось подписаться на канал', 'error');
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
    closeActiveChat();
    toast(isAdmin ? 'Вы покинули канал' : 'Вы отписались от канала');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось отписаться от канала', 'error');
  }
}

/** Покинуть группу (действие в меню чата). Владелец группу не покидает. */
async function leaveActiveGroup() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat || chat.type !== 'group') return;
  if (chat.owner === state.user.uid) return;

  const isAdmin = Boolean(chat.admins?.[state.user.uid]);
  const question = isAdmin
    ? `Покинуть группу «${getChatTitle(chat)}»? Права администратора будут сняты.`
    : `Покинуть группу «${getChatTitle(chat)}»?`;
  if (!window.confirm(question)) return;

  try {
    await Chat.leaveGroup(state.activeChatId, state.user.uid);
    closeActiveChat();
    toast('Вы покинули группу');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось покинуть группу', 'error');
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
  resetStatusForm();
  renderPrefsModal();
  dom.prefsOverlay.classList.remove('hidden');
}

/** Все подокна настроек: закрываются вместе с главным окном. */
function prefsSubOverlays() {
  return [
    dom.appearanceOverlay,
    dom.privacyOverlay,
    dom.securityOverlay,
    dom.accountOverlay,
    dom.dataOverlay,
    dom.adminOverlay,
  ];
}

/** Открыть подокно настроек (оформление, приватность и т.п.). */
function openPrefsPage(overlay) {
  if (!overlay) return;
  renderPrefsModal();
  overlay.classList.remove('hidden');
}

function closePrefsPages() {
  prefsSubOverlays().forEach((overlay) => overlay?.classList.add('hidden'));
}

/** Закрыть верхнее подокно настроек; true — если что-то закрыли. */
function closeTopPrefsPage() {
  const opened = prefsSubOverlays().filter((overlay) => overlay && !overlay.classList.contains('hidden'));
  if (!opened.length) return false;
  opened[opened.length - 1].classList.add('hidden');
  return true;
}

function closePrefsModal() {
  closeSessionsModal();
  closePasswordModal();
  closeInvitesModal();
  closeReservedModal();
  closeAliasesModal();
  closeTargetAdmin();
  closePrefsPages();
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

  const archived = archivedChats().length;
  dom.prefsArchiveCount.textContent = String(archived);
  dom.prefsBlockedCount.textContent = String(state.blocked.size);
  renderPrefsProviders();

  // Подсказки в компактном списке категорий.
  const providers = Auth.getLinkedProviders();
  const ownName = getProfileName(state.profile);
  const ownHandle = state.profile?.username ? '@' + state.profile.username : '';
  dom.prefsProfileHint.textContent = [ownName, ownHandle].filter(Boolean).join(' · ')
    || 'Имя, юзернейм и аватарка';
  dom.prefsAppearanceHint.textContent = theme === 'light' ? 'Светлая тема' : 'Тёмная тема';
  dom.prefsPrivacyHint.textContent = privacy === 'nobody'
    ? 'Последний визит скрыт'
    : 'Последний визит виден всем';
  dom.prefsSecurityHint.textContent = providers.includes('password')
    ? 'Пароль и активные сессии'
    : 'Активные сессии';
  dom.prefsAccountHint.textContent = providers.includes('google.com')
    ? 'Пароль и Google'
    : 'Пароль (email)';
  dom.prefsDataHint.textContent = `Архив (${archived}) и статистика`;

  // Админ-права: поле видно только супер-администраторам, а раздел
  // «Администрирование» и всё админское — только при включённых правах.
  const isRoot = Boolean(state.user && state.rootAdmins.has(state.user.uid));
  const adminOn = isRoot && state.settings?.adminMode !== false;
  dom.prefsAdminField.classList.toggle('hidden', !isRoot);
  dom.prefsAdminSection.classList.toggle('hidden', !adminOn);
  dom.prefsAdminToggle.checked = adminOn;
  dom.prefsDeleteUserError.classList.add('hidden');
  if (!adminOn) {
    ColorPicker.closeColorPicker();
    dom.adminOverlay.classList.add('hidden');
  }

  dom.prefsDeleteAccountBtn.disabled = false;
  dom.prefsDeleteAccountHint.textContent = isRoot
    ? 'Профиль, настройки, чаты и подписки будут удалены, права супер-администратора сняты. Сообщения останутся, а имя изменится на «Удалённый аккаунт». Восстановить аккаунт нельзя.'
    : 'Профиль, настройки, чаты и подписки будут удалены. Сообщения останутся, а имя изменится на «Удалённый аккаунт». Восстановить аккаунт нельзя.';
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

/* ============================================================
 *  Инвайт-коды (только root-админы)
 * ============================================================ */

const INVITE_STATUS_LABELS = {
  active: 'Активен',
  used: 'Использован',
  revoked: 'Отозван',
  expired: 'Истёк',
};

function openInvitesModal() {
  if (!state.user || !adminRightsOn()) return;
  dom.invitesError.classList.add('hidden');
  dom.invitesLoadError.classList.add('hidden');
  dom.invitesCreated.classList.add('hidden');
  dom.invitesCreated.innerHTML = '';
  dom.invitesNote.value = '';
  dom.invitesCount.value = '1';
  dom.invitesList.innerHTML = '';
  dom.invitesEmpty.classList.add('hidden');
  dom.invitesOverlay.classList.remove('hidden');
  loadInviteCodes();
}

function closeInvitesModal() {
  dom.invitesOverlay.classList.add('hidden');
}

async function loadInviteCodes() {
  dom.invitesLoadError.classList.add('hidden');
  try {
    const codes = await Invites.listInviteCodes();
    renderInviteCodes(codes);
  } catch (error) {
    console.error(error);
    dom.invitesList.innerHTML = '';
    dom.invitesEmpty.classList.add('hidden');
    dom.invitesLoadError.textContent = error?.message || 'Не удалось загрузить инвайт-коды';
    dom.invitesLoadError.classList.remove('hidden');
  }
}

function renderInviteCodes(codes) {
  dom.invitesList.innerHTML = '';
  dom.invitesEmpty.classList.toggle('hidden', codes.length > 0);

  codes.forEach((record) => {
    const row = createEl('div', 'invite-row');
    const body = createEl('div', 'invite-row-body');

    const title = createEl('div', 'invite-row-title');
    title.append(createEl('span', 'invite-code-key', `#${record.codeKey.slice(0, 8)}`));
    title.append(createEl('span', `invite-status ${record.status}`,
      INVITE_STATUS_LABELS[record.status] || 'Неизвестно'));
    body.append(title);

    const meta = [];
    if (record.note) meta.push(record.note);
    const createdAt = Number(record.createdAt) || 0;
    if (createdAt) meta.push(`Создан: ${formatDayLabel(createdAt)}, ${formatTime(createdAt)}`);
    const usedAt = Number(record.redemption?.at) || 0;
    if (usedAt) meta.push(`Использован: ${formatDayLabel(usedAt)}, ${formatTime(usedAt)}`);
    const usedBy = String(record.redemption?.uid || '');
    if (usedBy) meta.push(`кем: ${usedBy.slice(0, 8)}…`);
    if (meta.length) body.append(createEl('div', 'invite-row-meta', meta.join(' · ')));

    row.append(body);

    if (record.status === 'active') {
      const revoke = createEl('button', 'btn ghost invite-revoke', 'Отозвать');
      revoke.type = 'button';
      revoke.addEventListener('click', () => revokeInviteClick(record, revoke));
      row.append(revoke);
    }

    dom.invitesList.append(row);
  });
}

async function revokeInviteClick(record, button) {
  if (!state.user) return;
  if (!window.confirm(`Отозвать код #${record.codeKey.slice(0, 8)}? Ссылка перестанет работать.`)) return;

  button.disabled = true;
  try {
    await Invites.revokeInviteCode(record.codeKey, state.user.uid);
    toast('Инвайт-код отозван', 'success');
    loadInviteCodes();
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось отозвать код', 'error');
  } finally {
    button.disabled = false;
  }
}

/** Показать только что созданные коды и ссылки — потом их не восстановить. */
function renderCreatedInviteCodes(created) {
  dom.invitesCreated.innerHTML = '';
  if (!created.length) {
    dom.invitesCreated.classList.add('hidden');
    return;
  }

  dom.invitesCreated.classList.remove('hidden');
  dom.invitesCreated.append(createEl('p', 'invites-created-hint',
    'Скопируйте код или ссылку сейчас: в базе хранятся только соль и хэш, восстановить код не получится.'));

  created.forEach((item) => {
    const row = createEl('div', 'invite-created-row');
    row.append(createEl('code', 'invite-created-code', item.code));

    const actions = createEl('div', 'invite-created-actions');

    const copyCode = createEl('button', 'btn ghost invite-mini-btn', 'Код');
    copyCode.type = 'button';
    copyCode.addEventListener('click', async () => {
      const copied = await copyToClipboard(item.code);
      toast(copied ? 'Код скопирован' : 'Не удалось скопировать', copied ? 'success' : 'error');
    });

    const copyLink = createEl('button', 'btn ghost invite-mini-btn', 'Ссылка');
    copyLink.type = 'button';
    copyLink.addEventListener('click', async () => {
      const copied = await copyToClipboard(item.link);
      toast(copied ? 'Ссылка скопирована' : 'Не удалось скопировать', copied ? 'success' : 'error');
    });

    actions.append(copyCode, copyLink);
    row.append(actions);
    dom.invitesCreated.append(row);
  });
}

function showInvitesError(message) {
  dom.invitesError.textContent = message;
  dom.invitesError.classList.remove('hidden');
}

/* ============================================================
 *  Резерв юзернеймов (только root-админы)
 * ============================================================ */

const RESERVED_STATUS_LABELS = {
  free: 'Свободен',
  user: 'Занят пользователем',
  channel: 'Занят каналом',
  group: 'Занят группой',
  alias: 'Выдан как доп.',
};

const RESERVED_SKIP_REASONS = {
  invalid: 'неверный формат',
  reserved: 'уже зарезервирован',
  user: 'занят пользователем',
  channel: 'занят каналом',
  group: 'занят группой',
  alias: 'выдан как дополнительный',
  missing: 'не был зарезервирован',
};

const reservedUi = {
  items: [],
  status: 'all',
  type: 'all',
  query: '',
};

function openReservedModal() {
  if (!state.user || !adminRightsOn()) return;

  reservedUi.items = [];
  reservedUi.status = 'all';
  reservedUi.type = 'all';
  reservedUi.query = '';

  dom.reservedInput.value = '';
  dom.reservedRemoveInput.value = '';
  dom.reservedSearch.value = '';
  dom.reservedTypeFilter.value = 'all';
  dom.reservedStatusFilter.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusFilter === 'all');
  });

  dom.reservedError.classList.add('hidden');
  dom.reservedRemoveError.classList.add('hidden');
  dom.reservedLoadError.classList.add('hidden');
  dom.reservedResult.classList.add('hidden');
  dom.reservedResult.textContent = '';
  dom.reservedList.innerHTML = '';
  dom.reservedEmpty.classList.add('hidden');
  dom.reservedCount.textContent = '';
  dom.reservedOverlay.classList.remove('hidden');
  loadReservedUsernames();
}

function closeReservedModal() {
  dom.reservedOverlay.classList.add('hidden');
}

async function loadReservedUsernames() {
  dom.reservedLoadError.classList.add('hidden');
  dom.reservedCount.textContent = 'Загружаем…';
  try {
    reservedUi.items = await Chat.listReservedUsernames();
    renderReservedUsernames();
  } catch (error) {
    console.error(error);
    reservedUi.items = [];
    dom.reservedList.innerHTML = '';
    dom.reservedEmpty.classList.add('hidden');
    dom.reservedCount.textContent = '';
    dom.reservedLoadError.textContent = error?.message || 'Не удалось загрузить список';
    dom.reservedLoadError.classList.remove('hidden');
  }
}

function renderReservedUsernames() {
  dom.reservedList.innerHTML = '';

  const visible = reservedUi.items.filter((item) => {
    const statusMatch = reservedUi.status === 'all'
      || (reservedUi.status === 'free' ? item.status === 'free' : item.status !== 'free');
    const typeMatch = reservedUi.type === 'all' || item.status === reservedUi.type;
    const queryMatch = !reservedUi.query || item.name.includes(reservedUi.query);
    return statusMatch && typeMatch && queryMatch;
  });

  dom.reservedCount.textContent = reservedUi.items.length
    ? `Показано ${visible.length} из ${reservedUi.items.length}`
    : '';
  dom.reservedEmpty.classList.toggle('hidden', visible.length > 0);
  dom.reservedEmpty.textContent = reservedUi.items.length
    ? 'Ничего не найдено по фильтрам.'
    : 'Пока ничего не зарезервировано.';

  visible.forEach((item) => {
    const row = createEl('div', 'reserved-row');
    const body = createEl('div', 'reserved-row-body');

    const title = createEl('div', 'reserved-row-title');
    title.append(createEl('span', 'reserved-name', `@${item.name}`));
    title.append(createEl('span', `reserved-status ${item.status}`,
      RESERVED_STATUS_LABELS[item.status] || 'Неизвестно'));
    body.append(title);

    const meta = [];
    if (item.at) meta.push(`Зарезервирован: ${formatDayLabel(item.at)}`);
    if (item.by) meta.push(`кем: ${item.by.slice(0, 8)}…`);
    if (item.status !== 'free' && item.occupant) {
      meta.push(`владелец: ${item.occupant.slice(0, 12)}…`);
    }
    if (meta.length) body.append(createEl('div', 'reserved-row-meta', meta.join(' · ')));

    row.append(body);

    const remove = createEl('button', 'btn ghost reserved-remove', 'Снять');
    remove.type = 'button';
    remove.addEventListener('click', () => removeReservedClick(item, remove));
    row.append(remove);

    dom.reservedList.append(row);
  });
}

/** Показать, что добавлено/снято и какие имена пропущены. */
function showReservedResult(result, action) {
  const added = result.added || [];
  const removed = result.removed || [];
  const skipped = result.skipped || [];
  const parts = [];

  if (action === 'add' && added.length) {
    parts.push(`Зарезервировано: ${added.map((name) => `@${name}`).join(', ')}`);
  }
  if (action === 'remove' && removed.length) {
    parts.push(`Снято с резерва: ${removed.map((name) => `@${name}`).join(', ')}`);
  }
  if (skipped.length) {
    const details = skipped.map((item) =>
      `@${item.name} (${RESERVED_SKIP_REASONS[item.reason] || 'недоступно'})`);
    parts.push(`Пропущено: ${details.join(', ')}`);
  }

  if (!parts.length) {
    dom.reservedResult.classList.add('hidden');
    dom.reservedResult.textContent = '';
    return;
  }

  dom.reservedResult.textContent = parts.join('. ');
  dom.reservedResult.classList.toggle('warn', skipped.length > 0);
  dom.reservedResult.classList.remove('hidden');
}

async function submitReservedAdd(event) {
  event.preventDefault();
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  dom.reservedError.classList.add('hidden');
  dom.reservedResult.classList.add('hidden');

  const raw = dom.reservedInput.value.trim();
  if (!raw) {
    dom.reservedError.textContent = 'Введите один или несколько юзернеймов';
    dom.reservedError.classList.remove('hidden');
    return;
  }

  dom.reservedSubmit.disabled = true;
  dom.reservedSubmit.textContent = 'Резервируем…';
  try {
    const result = await Chat.reserveUsernames({ names: raw, uid: state.user.uid });
    dom.reservedInput.value = '';
    showReservedResult(result, 'add');
    if (result.added.length) {
      toast(`Зарезервировано имён: ${result.added.length}`, 'success');
    } else {
      toast('Новые имена не добавлены: все пропущены');
    }
    await loadReservedUsernames();
  } catch (error) {
    console.error(error);
    dom.reservedError.textContent = error?.message || 'Не удалось зарезервировать юзернеймы';
    dom.reservedError.classList.remove('hidden');
  } finally {
    dom.reservedSubmit.disabled = false;
    dom.reservedSubmit.textContent = 'Зарезервировать';
  }
}

async function submitReservedRemove(event) {
  event.preventDefault();
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  dom.reservedRemoveError.classList.add('hidden');
  dom.reservedResult.classList.add('hidden');

  const raw = dom.reservedRemoveInput.value.trim();
  if (!raw) {
    dom.reservedRemoveError.textContent = 'Введите один или несколько юзернеймов';
    dom.reservedRemoveError.classList.remove('hidden');
    return;
  }

  dom.reservedRemoveSubmit.disabled = true;
  dom.reservedRemoveSubmit.textContent = 'Снимаем…';
  try {
    const result = await Chat.releaseReservedUsernames(raw);
    dom.reservedRemoveInput.value = '';
    showReservedResult(result, 'remove');
    if (result.removed.length) {
      toast(`Снято с резерва имён: ${result.removed.length}`, 'success');
    } else {
      toast('Таких имён в резерве нет');
    }
    await loadReservedUsernames();
  } catch (error) {
    console.error(error);
    dom.reservedRemoveError.textContent = error?.message || 'Не удалось снять резерв';
    dom.reservedRemoveError.classList.remove('hidden');
  } finally {
    dom.reservedRemoveSubmit.disabled = false;
    dom.reservedRemoveSubmit.textContent = 'Снять';
  }
}

async function removeReservedClick(item, button) {
  button.disabled = true;
  try {
    const result = await Chat.releaseReservedUsernames([item.name]);
    showReservedResult(result, 'remove');
    toast(`@${item.name} больше не зарезервирован`, 'success');
    await loadReservedUsernames();
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось снять резерв', 'error');
  } finally {
    button.disabled = false;
  }
}

/* ============================================================
 *  Дополнительные юзернеймы (только root-админы)
 * ============================================================ */

const ALIAS_SKIP_REASONS = {
  invalid: 'неверный формат',
  taken: 'уже занят',
  alias: 'уже выдан как дополнительный',
  own: 'совпадает с основным',
  missing: 'не найден',
  reserved: 'зарезервирован',
};

const aliasesUi = {
  items: [],
  type: 'all',
  query: '',
};

function openAliasesModal() {
  if (!state.user || !adminRightsOn()) return;

  aliasesUi.items = [];
  aliasesUi.type = 'all';
  aliasesUi.query = '';

  dom.aliasesType.value = 'user';
  dom.aliasesTarget.value = '';
  dom.aliasesInput.value = '';
  dom.aliasesSearch.value = '';
  dom.aliasesFilter.value = 'all';
  dom.aliasesError.classList.add('hidden');
  dom.aliasesResult.classList.add('hidden');
  dom.aliasesResult.textContent = '';
  dom.aliasesLoadError.classList.add('hidden');
  dom.aliasesList.innerHTML = '';
  dom.aliasesEmpty.classList.add('hidden');
  dom.aliasesCount.textContent = '';
  dom.aliasesOverlay.classList.remove('hidden');
  updateAliasTargetPlaceholder();
  loadUsernameAliases();
}

function closeAliasesModal() {
  dom.aliasesOverlay.classList.add('hidden');
}

/** Подсказка в поле цели в зависимости от выбранного типа. */
function updateAliasTargetPlaceholder() {
  const type = dom.aliasesType.value;
  dom.aliasesTarget.placeholder = type === 'user'
    ? '@username или ID пользователя'
    : type === 'channel' ? '@username или ID канала' : '@username или ID публичной группы';
}

async function loadUsernameAliases() {
  dom.aliasesLoadError.classList.add('hidden');
  dom.aliasesCount.textContent = 'Загружаем…';
  try {
    aliasesUi.items = await Chat.listUsernameAliases();
    renderUsernameAliases();
  } catch (error) {
    console.error(error);
    aliasesUi.items = [];
    dom.aliasesList.innerHTML = '';
    dom.aliasesEmpty.classList.add('hidden');
    dom.aliasesCount.textContent = '';
    dom.aliasesLoadError.textContent = error?.message || 'Не удалось загрузить список';
    dom.aliasesLoadError.classList.remove('hidden');
  }
}

function renderUsernameAliases() {
  dom.aliasesList.innerHTML = '';

  const visible = aliasesUi.items.filter((item) => {
    const typeMatch = aliasesUi.type === 'all' || item.type === aliasesUi.type;
    const queryMatch = !aliasesUi.query || item.name.includes(aliasesUi.query);
    return typeMatch && queryMatch;
  });

  dom.aliasesCount.textContent = aliasesUi.items.length
    ? `Показано ${visible.length} из ${aliasesUi.items.length}`
    : '';
  dom.aliasesEmpty.classList.toggle('hidden', visible.length > 0);
  dom.aliasesEmpty.textContent = aliasesUi.items.length
    ? 'Ничего не найдено по фильтрам.'
    : 'Дополнительных юзернеймов пока нет.';

  visible.forEach((item) => {
    const row = createEl('div', 'reserved-row');
    const body = createEl('div', 'reserved-row-body');

    const title = createEl('div', 'reserved-row-title');
    title.append(createEl('span', 'reserved-name', `@${item.name}`));
    title.append(createEl('span', `reserved-status ${item.type}`,
      Chat.ALIAS_TYPE_LABELS[item.type] || 'Цель'));
    body.append(title);

    const target = item.targetUsername ? `@${item.targetUsername}` : item.target;
    const meta = [`ведёт на ${target}${item.targetTitle ? ' · ' + item.targetTitle : ''}`];
    if (item.at) meta.push(`Выдан: ${formatDayLabel(item.at)}, ${formatTime(item.at)}`);
    if (item.targetMissing) meta.push('цель не найдена');
    body.append(createEl('div', 'reserved-row-meta', meta.join(' · ')));

    row.append(body);

    const remove = createEl('button', 'btn ghost reserved-remove', 'Забрать');
    remove.type = 'button';
    remove.addEventListener('click', () => revokeAliasClick(item, remove));
    row.append(remove);

    dom.aliasesList.append(row);
  });
}

/** Показать, что выдано/забрано и какие имена пропущены. */
function showAliasesResult(result, action) {
  const added = result.added || [];
  const removed = result.removed || [];
  const skipped = result.skipped || [];
  const parts = [];

  if (action === 'add' && added.length) {
    parts.push(`Выдано: ${added.map((name) => `@${name}`).join(', ')}`);
  }
  if (action === 'remove' && removed.length) {
    parts.push(`Забрано: ${removed.map((name) => `@${name}`).join(', ')}`);
  }
  if (skipped.length) {
    const details = skipped.map((item) =>
      `@${item.name} (${ALIAS_SKIP_REASONS[item.reason] || 'недоступно'})`);
    parts.push(`Пропущено: ${details.join(', ')}`);
  }

  if (!parts.length) {
    dom.aliasesResult.classList.add('hidden');
    dom.aliasesResult.textContent = '';
    return;
  }

  dom.aliasesResult.textContent = parts.join('. ');
  dom.aliasesResult.classList.toggle('warn', skipped.length > 0);
  dom.aliasesResult.classList.remove('hidden');
}

async function submitAliases(event) {
  event.preventDefault();
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  dom.aliasesError.classList.add('hidden');
  dom.aliasesResult.classList.add('hidden');

  const target = dom.aliasesTarget.value.trim();
  const names = dom.aliasesInput.value.trim();
  if (!target) {
    dom.aliasesError.textContent = 'Укажите @username или ID цели';
    dom.aliasesError.classList.remove('hidden');
    dom.aliasesTarget.focus();
    return;
  }
  if (!names) {
    dom.aliasesError.textContent = 'Введите один или несколько дополнительных юзернеймов';
    dom.aliasesError.classList.remove('hidden');
    dom.aliasesInput.focus();
    return;
  }

  dom.aliasesSubmit.disabled = true;
  dom.aliasesSubmit.textContent = 'Выдаём…';
  try {
    const result = await Chat.assignUsernameAliases({
      names,
      type: dom.aliasesType.value,
      target,
      uid: state.user.uid,
    });
    dom.aliasesInput.value = '';
    showAliasesResult(result, 'add');
    toast(result.added.length
      ? `Выдано имён: ${result.added.length}`
      : 'Новые имена не выданы: все пропущены', result.added.length ? 'success' : undefined);
    await loadUsernameAliases();
  } catch (error) {
    console.error(error);
    dom.aliasesError.textContent = error?.message || 'Не удалось выдать юзернеймы';
    dom.aliasesError.classList.remove('hidden');
  } finally {
    dom.aliasesSubmit.disabled = false;
    dom.aliasesSubmit.textContent = 'Выдать';
  }
}

async function revokeAliasClick(item, button) {
  if (!window.confirm(`Забрать @${item.name}? Оно перестанет вести на этот профиль.`)) return;

  button.disabled = true;
  try {
    const result = await Chat.removeUsernameAliases([item.name]);
    showAliasesResult(result, 'remove');
    toast(`@${item.name} больше не дополнительный`, 'success');
    await loadUsernameAliases();
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось забрать юзернейм', 'error');
  } finally {
    button.disabled = false;
  }
}

/* ============================================================
 *  Активные сессии (отдельное окно из настроек)
 * ============================================================ */

function openSessionsModal() {
  if (!state.user) return;
  dom.sessionsError.classList.add('hidden');
  dom.sessionsEmpty.classList.add('hidden');
  dom.sessionsList.innerHTML = '';
  dom.sessionsOverlay.classList.remove('hidden');
  loadSessions();
}

function closeSessionsModal() {
  dom.sessionsOverlay.classList.add('hidden');
}

function setSessionsLoading(loading) {
  dom.sessionsRefresh.disabled = loading;
  dom.sessionsRefresh.textContent = loading ? 'Загрузка…' : 'Обновить';
  if (loading) dom.sessionsRevokeOthers.disabled = true;
}

/** Загрузить список сессий и отрисовать его. */
async function loadSessions() {
  if (!state.user) return;
  dom.sessionsError.classList.add('hidden');
  setSessionsLoading(true);
  try {
    const sessions = await Sessions.listSessions(state.user.uid);
    renderSessions(sessions);
  } catch (error) {
    console.error(error);
    dom.sessionsList.innerHTML = '';
    dom.sessionsEmpty.classList.add('hidden');
    dom.sessionsRevokeOthers.disabled = true;
    dom.sessionsError.textContent = 'Не удалось загрузить список сессий. Попробуйте позже.';
    dom.sessionsError.classList.remove('hidden');
  } finally {
    setSessionsLoading(false);
  }
}

/** Отрисовать строки сессий: текущая — первой. */
function renderSessions(sessions) {
  const currentId = Sessions.getCurrentSessionId();
  const sorted = [...sessions].sort((a, b) => {
    if (a.id === currentId) return -1;
    if (b.id === currentId) return 1;
    return (Number(b.lastActive) || 0) - (Number(a.lastActive) || 0);
  });

  dom.sessionsList.innerHTML = '';
  dom.sessionsEmpty.classList.toggle('hidden', sorted.length > 0);

  const others = sorted.filter((session) => session.id !== currentId);
  dom.sessionsRevokeOthers.disabled = others.length === 0;

  sorted.forEach((session) => {
    const isCurrent = session.id === currentId;
    const row = createEl('div', 'session-row');

    const icon = createEl('div', 'session-icon');
    icon.append(createIcon(session.mobile ? 'phone' : 'device'));
    row.append(icon);

    const body = createEl('div', 'session-body');
    const title = createEl('div', 'session-title');
    title.append(createEl('span', '', session.label || 'Браузер'));
    if (isCurrent) title.append(createEl('span', 'session-current', 'это устройство'));

    const created = Number(session.createdAt) || 0;
    const meta = [`Активность: ${formatLastSeen(session.lastActive)}`];
    if (created) meta.push(`Вход: ${formatDayLabel(created)}, ${formatTime(created)}`);
    body.append(title, createEl('div', 'session-meta', meta.join(' · ')));
    row.append(body);

    if (!isCurrent) {
      const btn = createEl('button', 'btn ghost session-revoke', 'Завершить');
      btn.type = 'button';
      btn.addEventListener('click', () => revokeSessionClick(session));
      row.append(btn);
    }

    dom.sessionsList.append(row);
  });
}

/** Завершить одну сессию с подтверждением. */
async function revokeSessionClick(session) {
  if (!state.user) return;
  const currentId = Sessions.getCurrentSessionId();
  if (!session.id || session.id === currentId) return;
  if (!window.confirm(`Завершить сессию «${session.label || 'это устройство'}»?`)) return;

  try {
    await Sessions.revokeSession(state.user.uid, session.id, currentId);
    toast('Сессия завершена', 'success');
    await loadSessions();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось завершить сессию', 'error');
  }
}

/** Завершить все сессии, кроме текущей. */
async function revokeOtherSessionsClick() {
  if (!state.user) return;
  if (!window.confirm('Выйти на всех других устройствах? Там придётся войти заново.')) return;

  dom.sessionsRevokeOthers.disabled = true;
  try {
    const count = await Sessions.revokeOtherSessions(state.user.uid, Sessions.getCurrentSessionId());
    toast(count ? `Завершено сессий: ${count}` : 'Других активных сессий нет', count ? 'success' : undefined);
    await loadSessions();
  } catch (error) {
    console.error(error);
    toast('Не удалось завершить другие сессии', 'error');
    await loadSessions();
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
  const postAuthor = createEl('span', 'comments-post-author', getSenderName(message.sender));
  applyUserStatus(postAuthor, message.sender);
  dom.commentsPost.append(postAuthor);
  dom.commentsPost.append(createEl('span', 'comments-post-text',
    message.poll ? '📊 ' + (message.poll.question || '') : (message.text || '')));
  Emoji.parse(dom.commentsPost);

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
    const author = createEl('span', 'comment-author', comment.sender === state.user?.uid ? 'Вы' : getSenderName(comment.sender));
    applyUserStatus(author, comment.sender);
    head.append(author);
    head.append(createEl('span', 'comment-time', formatListTime(comment.timestamp)));
    body.append(head);
    const textEl = createEl('div', 'comment-text');
    textEl.append(...buildMessageText(comment.text || '').childNodes);
    body.append(textEl);

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

  Emoji.parse(dom.commentsList);
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
  if (dom.statsFullLink) {
    const target = chat.username ? '@' + chat.username : chatId;
    const safe = encodeURIComponent(target).replace(/%40/gi, '@');
    dom.statsFullLink.href = `dashboard/#channels/${safe}`;
    dom.statsFullLink.textContent = chat.username
      ? `Полная статистика @${chat.username} →`
      : 'Полная статистика →';
    dom.statsFullLink.classList.remove('hidden');
  }
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
      const code = Invites.normalizeInviteCode(dom.authInvite.value);
      if (!code) {
        showAuthError('Введите инвайт-код — без него регистрация закрыта');
        return;
      }
      try {
        await Invites.validateInviteCode(code);
      } catch (error) {
        showAuthError(authFormError(error));
        return;
      }
      // Код применим после входа: подтверждение пишется уже от имени аккаунта.
      pendingInviteCode = code;
      try {
        await Auth.registerWithEmail(identifier, password);
      } catch (error) {
        pendingInviteCode = '';
        throw error;
      }
    } else {
      pendingInviteCode = '';
      await Auth.loginWithIdentifier(identifier, password);
    }
  } catch (error) {
    showAuthError(authFormError(error));
  } finally {
    setAuthLoading(false);
  }
});

dom.authToggleMode.addEventListener('click', () => {
  setAuthMode(authMode === 'login' ? 'register' : 'login');
});

// Инвайт-ссылка: /?invite_code=… — сразу открываем регистрацию и
// подставляем код в поле.
if (deepLink.invite) {
  dom.authInvite.value = Invites.formatInviteCode(deepLink.invite);
  setAuthMode('register');
}

// Приводим код к красивому виду после ввода.
dom.authInvite.addEventListener('blur', () => {
  const code = Invites.normalizeInviteCode(dom.authInvite.value);
  dom.authInvite.value = code ? Invites.formatInviteCode(code) : '';
});

dom.googleBtn.addEventListener('click', async () => {
  hideAuthError();
  setAuthLoading(true);
  try {
    if (authMode === 'register') {
      const code = Invites.normalizeInviteCode(dom.authInvite.value);
      if (!code) {
        showAuthError('Введите инвайт-код — без него регистрация закрыта');
        return;
      }
      try {
        await Invites.validateInviteCode(code);
      } catch (error) {
        showAuthError(authFormError(error));
        return;
      }
      pendingInviteCode = code;
    } else {
      // Вход: код не нужен. Если Google-аккаунт окажется новым,
      // приложение попросит инвайт отдельным экраном.
      pendingInviteCode = '';
    }

    const result = await Auth.loginWithGoogle();
    // Email уже занят аккаунтом с паролем: просим пароль и привязываем Google.
    if (result?.needsLink) {
      pendingInviteCode = '';
      pendingGoogleLink = { email: result.email, pendingCredential: result.pendingCredential };
      dom.authLinkPanel.classList.remove('hidden');
      dom.authLinkPassword.value = '';
      dom.authLinkPassword.focus();
    }
  } catch (error) {
    pendingInviteCode = '';
    showAuthError(authFormError(error));
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

// --- Экран требования инвайта (новый Google-аккаунт без кода) ---
dom.inviteGateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const user = state.user;
  if (!user) return;

  const code = Invites.normalizeInviteCode(dom.inviteGateCode.value);
  if (!code) {
    dom.inviteGateError.textContent = 'Введите инвайт-код';
    dom.inviteGateError.classList.remove('hidden');
    dom.inviteGateCode.focus();
    return;
  }

  dom.inviteGateSubmit.disabled = true;
  dom.inviteGateSubmit.textContent = 'Проверяем…';
  try {
    await Invites.redeemInviteCode({ uid: user.uid, code });
    clearInviteParamFromUrl();
    hideInviteGateScreen();
    // Дальше — обычный маршрут: профиль, бан, онбординг или мессенджер.
    await enqueueRoute(user);
  } catch (error) {
    console.error(error);
    dom.inviteGateError.textContent = error?.message || 'Не удалось применить инвайт-код';
    dom.inviteGateError.classList.remove('hidden');
  } finally {
    dom.inviteGateSubmit.disabled = false;
    dom.inviteGateSubmit.textContent = 'Продолжить';
  }
});

dom.inviteGateLogout.addEventListener('click', () => {
  logoutCurrentUser();
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

/** Выйти из аккаунта: сначала убрать запись сессии, потом signOut. */
async function logoutCurrentUser() {
  flushDrafts();
  if (state.user && !state.myDeleted) Chat.setOfflinePresence(state.user.uid).catch(() => {});
  // Не блокируем выход, если сеть пропала: запись сессии — вспомогательная.
  await Promise.race([
    Sessions.stopSession().catch((error) => {
      console.warn('Не удалось остановить сессию:', error);
    }),
    new Promise((resolve) => window.setTimeout(resolve, 1200)),
  ]);
  try {
    await Auth.logout();
  } catch (error) {
    console.error(error);
    toast('Не удалось выйти из аккаунта', 'error');
  }
}

/** Показать ошибку в блоке удаления чужого аккаунта. */
function showDeleteUserError(message) {
  dom.prefsDeleteUserError.textContent = message;
  dom.prefsDeleteUserError.classList.remove('hidden');
}

/** Удалить собственный аккаунт: стереть данные, затем удалить вход Firebase. */
async function deleteMyAccountClick() {
  if (!state.user || accountDeletionInProgress) return;

  const isRoot = state.rootAdmins.has(state.user.uid);
  const name = getProfileName(state.profile) || state.user.email || 'аккаунт';
  const confirmed = window.confirm(
    `Удалить аккаунт «${name}»?\n\n` +
    'Профиль, настройки, чаты и подписки будут удалены. Сообщения останутся, ' +
    'а имя изменится на «Удалённый аккаунт». Восстановить аккаунт нельзя.' +
    (isRoot ? '\n\nВы супер-администратор: права супер-администратора будут сняты.' : ''),
  );
  if (!confirmed) return;

  dom.prefsDeleteAccountBtn.disabled = true;
  accountDeletionInProgress = true;
  try {
    await Chat.deleteUserAccount(state.user.uid, { deletedBy: state.user.uid });
    closePrefsModal();
    toast('Аккаунт удалён', 'success');

    // Данные уже стёрты: запись сессии не трогаем, чтобы не воссоздавать её.
    await Sessions.stopSession({ removeRecord: false }).catch(() => {});
    try {
      await Auth.deleteCurrentAccount();
    } catch (error) {
      // Firebase может потребовать недавний вход. Метка deleted_users
      // всё равно не пустит аккаунт в мессенджер.
      console.warn('Не удалось удалить вход Firebase:', error);
      await Auth.logout().catch(() => {});
    }
  } catch (error) {
    console.error(error);
    toast('Не удалось удалить аккаунт', 'error');
  } finally {
    accountDeletionInProgress = false;
    dom.prefsDeleteAccountBtn.disabled = false;
  }
}

/** Удалить чужой аккаунт по @username (только супер-админ с правами). */
async function deleteAccountByUsernameClick() {
  if (accountDeletionInProgress) return;
  if (!state.user || !adminRightsOn()) {
    showDeleteUserError('Сначала включите админ-права');
    return;
  }

  const raw = dom.prefsDeleteUserInput.value.trim();
  if (!raw) {
    showDeleteUserError('Введите @username');
    return;
  }

  dom.prefsDeleteUserError.classList.add('hidden');
  dom.prefsDeleteUserBtn.disabled = true;
  try {
    const target = await Chat.getUserByUsername(raw);
    if (!target?.uid) {
      showDeleteUserError('Пользователь с таким юзернеймом не найден');
      return;
    }
    if (target.uid === state.user.uid) {
      showDeleteUserError('Это ваш аккаунт — используйте «Удалить аккаунт» выше');
      return;
    }
    if (state.rootAdmins.has(target.uid)) {
      showDeleteUserError('Нельзя удалить другого супер-администратора');
      return;
    }
    if (target.deleted) {
      showDeleteUserError('Аккаунт уже удалён');
      return;
    }

    const name = getProfileName(target) || `@${target.username}`;
    const confirmed = window.confirm(
      `Удалить аккаунт «${name}» (@${target.username})?\n\n` +
      'Профиль, настройки, чаты и подписки будут удалены. Сообщения останутся, ' +
      'а имя изменится на «Удалённый аккаунт». Пользователь потеряет доступ к мессенджеру.',
    );
    if (!confirmed) return;

    await Chat.deleteUserAccount(target.uid, { deletedBy: state.user.uid, ban: true });
    dom.prefsDeleteUserInput.value = '';
    toast(`Аккаунт ${name} удалён`, 'success');

    // Обновить открытые списки: у собеседников теперь «Удалённый аккаунт».
    renderChatList();
    renderMainPanel();
    if (state.search.query) renderSearchResults();
  } catch (error) {
    console.error(error);
    showDeleteUserError('Не удалось удалить аккаунт');
  } finally {
    dom.prefsDeleteUserBtn.disabled = false;
  }
}

/* --- Статусы пользователей, каналов и групп (только root-админы) --- */

let statusFormKind = 'emoji';
let statusFormTarget = 'user';
let statusFormResolved = null;
let statusResolveSeq = 0;

/** Текущий выбранный тип статуса в форме выдачи. */
function currentStatusFormKind() {
  return statusFormKind === 'text' ? 'text' : 'emoji';
}

/** Текущая цель формы выдачи: пользователь или чат. */
function currentStatusFormTarget() {
  return statusFormTarget === 'chat' ? 'chat' : 'user';
}

/** Сбросить форму статуса к исходному состоянию. */
function resetStatusForm() {
  if (!dom.prefsStatusUser) return;
  statusResolveSeq += 1;
  statusFormTarget = 'user';
  statusFormKind = 'emoji';
  statusFormResolved = null;
  dom.prefsStatusUser.value = '';
  dom.prefsStatusValue.value = '';
  dom.prefsStatusColor.value = Chat.STATUS_DEFAULT_COLOR;
  ColorPicker.syncColorChip(dom.prefsStatusColorPick, dom.prefsStatusColor);
  dom.prefsStatusTarget.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusTarget === 'user');
  });
  dom.prefsStatusKind.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusKind === 'emoji');
  });
  dom.prefsStatusError.textContent = '';
  dom.prefsStatusError.classList.add('hidden');
  dom.prefsStatusSave.disabled = false;
  dom.prefsStatusClear.disabled = false;
  syncStatusTarget();
  syncStatusFormKind();
  renderStatusPreview();
  renderCurrentStatus();
}

/** Подсказки, которые зависят от того, кому выдаём статус. */
function syncStatusTarget() {
  const isChat = currentStatusFormTarget() === 'chat';
  dom.prefsStatusUser.placeholder = isChat ? '@канал или @группа' : '@username';
  dom.prefsStatusClear.textContent = isChat ? 'Снять у чата' : 'Снять';
}

/** Показать/скрыть поля, которые зависят от типа статуса. */
function syncStatusFormKind() {
  const isText = currentStatusFormKind() === 'text';
  dom.prefsStatusColorField.classList.toggle('hidden', !isText);
  dom.prefsStatusEmojiBtn.classList.toggle('hidden', isText);
  dom.prefsStatusValue.maxLength = isText ? Chat.STATUS_TEXT_MAX : 24;
  dom.prefsStatusValue.placeholder = isText
    ? `Текст до ${Chat.STATUS_TEXT_MAX} символов`
    : 'Любой эмодзи';
  dom.prefsStatusSave.textContent = isText ? 'Выдать текст' : 'Выдать эмодзи';
}

/** Статус выбранной цели (null, если его нет). */
function statusOfTarget(target) {
  if (!target) return null;
  return target.type === 'chat' ? chatStatusFor(target.id) : userStatusFor(target.id);
}

/** Строка «Сейчас: …» с текущим статусом найденной цели. */
function renderCurrentStatus() {
  if (!dom.prefsStatusCurrent) return;
  dom.prefsStatusCurrent.textContent = '';
  const status = statusOfTarget(statusFormResolved);
  if (!status) {
    dom.prefsStatusCurrent.classList.add('hidden');
    return;
  }
  dom.prefsStatusCurrent.classList.remove('hidden');
  dom.prefsStatusCurrent.append(createEl('span', 'status-editor-label', 'Сейчас:'));
  dom.prefsStatusCurrent.append(buildStatusBadge(status));
  Emoji.parse(dom.prefsStatusCurrent);
}

/**
 * Найти цель по @username: пользователя либо канал/группу.
 * @returns {Promise<{type: 'user'|'chat', id: string, label: string}>}
 */
async function resolveStatusTarget(raw) {
  if (currentStatusFormTarget() === 'chat') {
    const chat = await Chat.getChatByUsername(raw);
    if (!chat?.chatId) throw new Error('Канал или группа с таким юзернеймом не найдены');
    return { type: 'chat', id: chat.chatId, label: '@' + (chat.username || Chat.normalizeUsername(raw)) };
  }

  const user = await Chat.getUserByUsername(raw);
  if (!user?.uid) throw new Error('Пользователь с таким юзернеймом не найден');
  if (user.deleted) throw new Error('Аккаунт удалён — статус не поставить');
  return { type: 'user', id: user.uid, label: '@' + (user.username || Chat.normalizeUsername(raw)) };
}

/** Перечитать цель по введённому @username и показать её текущий статус. */
async function refreshCurrentStatus() {
  const raw = dom.prefsStatusUser.value.trim();
  const seq = ++statusResolveSeq;
  statusFormResolved = null;
  renderCurrentStatus();
  if (!raw) return;

  try {
    const target = await resolveStatusTarget(raw);
    if (seq !== statusResolveSeq) return;
    statusFormResolved = target;
  } catch {
    // Молчим: точную ошибку покажем при сохранении.
    return;
  }
  renderCurrentStatus();
}

/** Живой предпросмотр статуса из полей формы. */
function renderStatusPreview() {
  if (!dom.prefsStatusPreview) return;
  dom.prefsStatusPreview.innerHTML = '';

  const value = String(dom.prefsStatusValue.value || '').trim();
  if (!value) {
    dom.prefsStatusPreview.append(createEl('span', 'status-preview-hint', 'Предпросмотр статуса'));
    return;
  }

  const kind = currentStatusFormKind();
  const badge = createEl('span', `user-status user-status-${kind}`);
  badge.textContent = kind === 'text'
    ? [...value].slice(0, Chat.STATUS_TEXT_MAX).join('')
    : value;
  if (kind === 'text') {
    const color = normalizeHex(dom.prefsStatusColor.value) || Chat.STATUS_DEFAULT_COLOR;
    badge.style.background = color;
    badge.style.color = readableStatusTextColor(color);
  }
  dom.prefsStatusPreview.append(badge);
  Emoji.parse(badge);
}

/** Ошибка в форме статуса. */
function showStatusError(message) {
  dom.prefsStatusError.textContent = message;
  dom.prefsStatusError.classList.remove('hidden');
}

/** Привести ошибку записи статуса к понятному тексту. */
function statusWriteError(error) {
  const message = String(error?.message || '');
  if (/permission|denied|PERMISSION_DENIED/i.test(message)) {
    return 'Нет доступа на запись: проверьте, что новые правила базы опубликованы';
  }
  return message || 'Не удалось сохранить статус';
}

/** Записать статус цели ({type: 'user'|'chat', id}) — общий путь админки. */
async function writeStatusToTarget(target, { kind, value, color = '' }) {
  const payload = {
    kind,
    value,
    color: kind === 'text' ? color : '',
    by: state.user.uid,
  };
  if (target.type === 'chat') await Chat.setChatStatus({ chatId: target.id, ...payload });
  else await Chat.setUserStatus({ uid: target.id, ...payload });
}

/** Снять статус цели ({type: 'user'|'chat', id}). */
async function clearStatusOfTarget(target) {
  if (target.type === 'chat') await Chat.removeChatStatus(target.id);
  else await Chat.removeUserStatus(target.id);
}

/** Выдать или заменить статус по @username (только супер-админ). */
async function saveUserStatusClick() {
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  const raw = dom.prefsStatusUser.value.trim();
  if (!raw) {
    showStatusError('Введите @username');
    dom.prefsStatusUser.focus();
    return;
  }

  const kind = currentStatusFormKind();
  const value = String(dom.prefsStatusValue.value || '').trim();
  if (!value) {
    showStatusError(kind === 'text' ? 'Введите текст статуса' : 'Выберите эмодзи');
    dom.prefsStatusValue.focus();
    return;
  }
  if (kind === 'emoji' && !/\p{Extended_Pictographic}/u.test(value)) {
    showStatusError('В режиме «Эмодзи» нужен эмодзи — или переключитесь на «Текст»');
    dom.prefsStatusValue.focus();
    return;
  }

  dom.prefsStatusError.classList.add('hidden');
  dom.prefsStatusSave.disabled = true;
  dom.prefsStatusSave.textContent = 'Сохраняем…';
  try {
    const target = await resolveStatusTarget(raw);
    statusFormResolved = target;

    const hadStatus = Boolean(statusOfTarget(target));
    await writeStatusToTarget(target, {
      kind,
      value,
      color: normalizeHex(dom.prefsStatusColor.value) || Chat.STATUS_DEFAULT_COLOR,
    });

    toast(hadStatus ? 'Статус обновлён' : 'Статус выдан', 'success');
    dom.prefsStatusValue.value = '';
    renderStatusPreview();
    renderCurrentStatus();
    dom.prefsStatusError.classList.add('hidden');
  } catch (error) {
    console.error(error);
    showStatusError(statusWriteError(error));
  } finally {
    dom.prefsStatusSave.disabled = false;
    syncStatusFormKind();
  }
}

/** Снять статус по @username (только супер-админ). */
async function clearUserStatusClick() {
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  const raw = dom.prefsStatusUser.value.trim();
  if (!raw) {
    showStatusError('Введите @username');
    dom.prefsStatusUser.focus();
    return;
  }

  dom.prefsStatusError.classList.add('hidden');
  dom.prefsStatusClear.disabled = true;
  try {
    const target = await resolveStatusTarget(raw);
    statusFormResolved = target;
    renderCurrentStatus();

    if (!statusOfTarget(target)) {
      showStatusError(target.type === 'chat' ? 'У этого чата нет статуса' : 'У этого пользователя нет статуса');
      return;
    }
    const what = target.type === 'chat' ? 'чата' : 'пользователя';
    if (!window.confirm(`Снять статус ${what} ${target.label}?`)) return;

    await clearStatusOfTarget(target);

    toast('Статус снят', 'success');
    dom.prefsStatusValue.value = '';
    renderStatusPreview();
    renderCurrentStatus();
  } catch (error) {
    console.error(error);
    showStatusError(statusWriteError(error));
  } finally {
    dom.prefsStatusClear.disabled = false;
  }
}

dom.prefsStatusTarget.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-status-target]');
  if (!btn) return;
  statusFormTarget = btn.dataset.statusTarget === 'chat' ? 'chat' : 'user';
  dom.prefsStatusTarget.querySelectorAll('.seg-btn').forEach((item) => {
    item.classList.toggle('active', item === btn);
  });
  syncStatusTarget();
  refreshCurrentStatus();
});

dom.prefsStatusUser.addEventListener('change', refreshCurrentStatus);

dom.prefsStatusKind.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-status-kind]');
  if (!btn) return;
  statusFormKind = btn.dataset.statusKind === 'text' ? 'text' : 'emoji';
  dom.prefsStatusKind.querySelectorAll('.seg-btn').forEach((item) => {
    item.classList.toggle('active', item === btn);
  });
  syncStatusFormKind();
  renderStatusPreview();
});

dom.prefsStatusValue.addEventListener('input', renderStatusPreview);
dom.prefsStatusColor.addEventListener('input', renderStatusPreview);
// Цвет фона статуса выбирается общим пикером, значение по-прежнему живёт в HEX-поле.
ColorPicker.bindColorField({ chip: dom.prefsStatusColorPick, input: dom.prefsStatusColor });
dom.prefsStatusSave.addEventListener('click', saveUserStatusClick);
dom.prefsStatusClear.addEventListener('click', clearUserStatusClick);
dom.prefsStatusUser.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveUserStatusClick();
  }
});

dom.prefsStatusEmojiBtn.addEventListener('click', () => {
  Emoji.openPicker({
    mode: 'insert',
    anchor: dom.prefsStatusEmojiBtn,
    trigger: dom.prefsStatusEmojiBtn,
    onSelect: (emoji) => {
      dom.prefsStatusValue.value = emoji;
      renderStatusPreview();
      Emoji.closePicker();
    },
  });
});

dom.onboardingLogout.addEventListener('click', () => {
  logoutCurrentUser();
});

// --- Боковая панель ---
// Кнопка выхода перенесена в настройки (см. ниже).

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
  logoutCurrentUser();
});

// --- Настройки (клик по логотипу): тема, приватность визита, архив ---
dom.settingsBtn.addEventListener('click', openPrefsModal);
dom.prefsClose.addEventListener('click', closePrefsModal);
dom.prefsOverlay.addEventListener('click', (event) => {
  if (event.target === dom.prefsOverlay) closePrefsModal();
});

// --- Категории настроек: каждая открывает своё окно ---
dom.prefsProfileBtn.addEventListener('click', () => {
  closePrefsModal();
  openProfileModal();
});
dom.prefsAppearanceBtn.addEventListener('click', () => openPrefsPage(dom.appearanceOverlay));
dom.prefsPrivacyBtn.addEventListener('click', () => openPrefsPage(dom.privacyOverlay));
dom.prefsSecurityBtn.addEventListener('click', () => openPrefsPage(dom.securityOverlay));
dom.prefsAccountBtn.addEventListener('click', () => openPrefsPage(dom.accountOverlay));
dom.prefsDataBtn.addEventListener('click', () => openPrefsPage(dom.dataOverlay));
dom.prefsAdminBtn.addEventListener('click', () => {
  if (!adminRightsOn()) return;
  resetStatusForm();
  openPrefsPage(dom.adminOverlay);
});

// --- Карточка цели: юзернеймы, статус и удаление аккаунта ---
dom.targetAdminClose.addEventListener('click', closeTargetAdmin);
dom.targetAdminOverlay.addEventListener('click', (event) => {
  if (event.target === dom.targetAdminOverlay) closeTargetAdmin();
});
dom.targetAdminAliasAdd.addEventListener('click', submitTargetAlias);
dom.targetAdminAliasInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitTargetAlias();
  }
});
dom.targetAdminReserve.addEventListener('click', toggleTargetReserve);
dom.targetAdminStatusKind.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-status-kind]');
  if (!btn) return;
  targetAdminUi.statusKind = btn.dataset.statusKind === 'text' ? 'text' : 'emoji';
  syncTargetStatusKind();
  renderTargetStatusPreview();
});
dom.targetAdminStatusValue.addEventListener('input', renderTargetStatusPreview);
dom.targetAdminStatusColor.addEventListener('input', renderTargetStatusPreview);
ColorPicker.bindColorField({ chip: dom.targetAdminStatusColorPick, input: dom.targetAdminStatusColor });
dom.targetAdminStatusSave.addEventListener('click', saveTargetStatus);
dom.targetAdminStatusClear.addEventListener('click', clearTargetStatus);
dom.targetAdminStatusEmoji.addEventListener('click', () => {
  Emoji.openPicker({
    mode: 'insert',
    anchor: dom.targetAdminStatusEmoji,
    trigger: dom.targetAdminStatusEmoji,
    onSelect: (emoji) => {
      dom.targetAdminStatusValue.value = emoji;
      renderTargetStatusPreview();
      Emoji.closePicker();
    },
  });
});
dom.targetAdminDelete.addEventListener('click', deleteTargetAccount);
dom.profileAdminOpen.addEventListener('click', () => {
  if (!state.user || !adminRightsOn()) return;
  openTargetAdmin({
    type: 'user',
    id: state.user.uid,
    username: state.profile?.username || '',
  });
});

[
  [dom.appearanceOverlay, dom.appearanceClose],
  [dom.privacyOverlay, dom.privacyClose],
  [dom.securityOverlay, dom.securityClose],
  [dom.accountOverlay, dom.accountClose],
  [dom.dataOverlay, dom.dataClose],
  [dom.adminOverlay, dom.adminClose],
].forEach(([overlay, closeBtn]) => {
  closeBtn.addEventListener('click', () => {
    ColorPicker.closeColorPicker();
    overlay.classList.add('hidden');
  });
  overlay.addEventListener('click', (event) => {
    if (event.target !== overlay) return;
    ColorPicker.closeColorPicker();
    overlay.classList.add('hidden');
  });
});
dom.prefsLogoutBtn.addEventListener('click', () => {
  closePrefsModal();
  logoutCurrentUser();
});
dom.prefsDeleteAccountBtn.addEventListener('click', deleteMyAccountClick);
dom.prefsDeleteUserBtn.addEventListener('click', deleteAccountByUsernameClick);
dom.prefsDeleteUserInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    deleteAccountByUsernameClick();
  }
});
dom.prefsSessionsBtn.addEventListener('click', openSessionsModal);
dom.sessionsClose.addEventListener('click', closeSessionsModal);
dom.sessionsOverlay.addEventListener('click', (event) => {
  if (event.target === dom.sessionsOverlay) closeSessionsModal();
});
dom.sessionsRefresh.addEventListener('click', loadSessions);
dom.sessionsRevokeOthers.addEventListener('click', revokeOtherSessionsClick);

// --- Инвайт-коды: окно root-админа ---
dom.prefsInvitesBtn.addEventListener('click', openInvitesModal);
dom.invitesClose.addEventListener('click', closeInvitesModal);
dom.invitesCancel.addEventListener('click', closeInvitesModal);
dom.invitesOverlay.addEventListener('click', (event) => {
  if (event.target === dom.invitesOverlay) closeInvitesModal();
});
dom.invitesForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  dom.invitesError.classList.add('hidden');
  dom.invitesSubmit.disabled = true;
  dom.invitesSubmit.textContent = 'Создаём…';
  try {
    const count = Math.max(1, Math.min(20, Math.floor(Number(dom.invitesCount.value) || 1)));
    const created = await Invites.createInviteCodes({
      uid: state.user.uid,
      count,
      note: dom.invitesNote.value,
    });
    dom.invitesNote.value = '';
    renderCreatedInviteCodes(created);
    toast(created.length === 1 ? 'Инвайт-код создан' : `Создано кодов: ${created.length}`, 'success');
    loadInviteCodes();
  } catch (error) {
    console.error(error);
    showInvitesError(error?.message || 'Не удалось создать инвайт-код');
  } finally {
    dom.invitesSubmit.disabled = false;
    dom.invitesSubmit.textContent = 'Создать';
  }
});

// --- Резерв юзернеймов: окно root-админа ---
dom.prefsReservedBtn.addEventListener('click', openReservedModal);
dom.reservedClose.addEventListener('click', closeReservedModal);
dom.reservedCancel.addEventListener('click', closeReservedModal);
dom.reservedOverlay.addEventListener('click', (event) => {
  if (event.target === dom.reservedOverlay) closeReservedModal();
});
dom.reservedForm.addEventListener('submit', submitReservedAdd);
dom.reservedRemoveForm.addEventListener('submit', submitReservedRemove);
dom.reservedSearch.addEventListener('input', () => {
  reservedUi.query = Chat.normalizeUsername(dom.reservedSearch.value);
  renderReservedUsernames();
});
dom.reservedStatusFilter.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-status-filter]');
  if (!btn) return;
  reservedUi.status = btn.dataset.statusFilter || 'all';
  dom.reservedStatusFilter.querySelectorAll('.seg-btn').forEach((item) => {
    item.classList.toggle('active', item === btn);
  });
  renderReservedUsernames();
});
dom.reservedTypeFilter.addEventListener('change', () => {
  reservedUi.type = dom.reservedTypeFilter.value || 'all';
  renderReservedUsernames();
});

// --- Дополнительные юзернеймы: окно root-админа ---
dom.prefsAliasesBtn.addEventListener('click', openAliasesModal);
dom.aliasesClose.addEventListener('click', closeAliasesModal);
dom.aliasesCancel.addEventListener('click', closeAliasesModal);
dom.aliasesOverlay.addEventListener('click', (event) => {
  if (event.target === dom.aliasesOverlay) closeAliasesModal();
});
dom.aliasesForm.addEventListener('submit', submitAliases);
dom.aliasesType.addEventListener('change', updateAliasTargetPlaceholder);
dom.aliasesSearch.addEventListener('input', () => {
  aliasesUi.query = Chat.normalizeUsername(dom.aliasesSearch.value);
  renderUsernameAliases();
});
dom.aliasesFilter.addEventListener('change', () => {
  aliasesUi.type = dom.aliasesFilter.value || 'all';
  renderUsernameAliases();
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
    renderPrefsModal();
    // Админ-действия в открытых меню чата и профиле тоже скрываем сразу.
    refreshUsernameAdminBlocks();
    await refreshReservedNameCache(true);
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
dom.settingsMembersBtn.addEventListener('click', () => {
  if (!state.chats.get(settingsChatId)) return;
  dom.settingsMembersOverlay.classList.remove('hidden');
  dom.settingsMemberInput.focus();
});
dom.settingsAdminsBtn.addEventListener('click', () => {
  if (!state.chats.get(settingsChatId)) return;
  dom.settingsAdminsOverlay.classList.remove('hidden');
  dom.settingsAdminInput.focus();
});
[
  [dom.settingsMembersOverlay, dom.settingsMembersClose],
  [dom.settingsAdminsOverlay, dom.settingsAdminsClose],
].forEach(([overlay, closeBtn]) => {
  closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.classList.add('hidden');
  });
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
      requiresSubscription: chat.type === 'channel'
        ? dom.settingsRequiresSubscription.checked
        : undefined,
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
  if (!dom.sessionsOverlay.classList.contains('hidden')) {
    closeSessionsModal();
    return;
  }
  if (!dom.invitesOverlay.classList.contains('hidden')) {
    closeInvitesModal();
    return;
  }
  if (!dom.reservedOverlay.classList.contains('hidden')) {
    closeReservedModal();
    return;
  }
  if (!dom.aliasesOverlay.classList.contains('hidden')) {
    closeAliasesModal();
    return;
  }
  if (!dom.targetAdminOverlay.classList.contains('hidden')) {
    closeTargetAdmin();
    return;
  }
  if (closeTopPrefsPage()) return;
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
  if (!dom.settingsAdminsOverlay.classList.contains('hidden')) {
    dom.settingsAdminsOverlay.classList.add('hidden');
    return;
  }
  if (!dom.settingsMembersOverlay.classList.contains('hidden')) {
    dom.settingsMembersOverlay.classList.add('hidden');
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
  if (document.querySelector('.message.text-selectable')) stopTextSelection();
});

// --- Панель чата ---
Emoji.init({ onSelect: handleEmojiSelect });

dom.emojiBtn.addEventListener('click', () => {
  Emoji.openPicker({
    mode: 'insert',
    anchor: dom.emojiBtn,
    trigger: dom.emojiBtn,
    focusSource: dom.messageInput,
  });
});

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
let messagesScrollFrame = 0;
dom.messages.addEventListener('scroll', () => {
  // Скролл приходит десятками событий в секунду: измерения и перерисовку
  // делаем не чаще одного раза за кадр.
  if (messagesScrollFrame) return;
  messagesScrollFrame = requestAnimationFrame(() => {
    messagesScrollFrame = 0;
    const el = dom.messages;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    // Пользователь дочитал до конца — снимаем непрочитанное.
    if (atBottom && !state.stickToBottom && state.activeChatId) {
      markActiveChatRead();
      renderChatList();
    }
    state.stickToBottom = atBottom;
  });
});

// Подписка на канал / вступление в публичную группу из предпросмотра.
dom.previewSubscribe.addEventListener('click', async () => {
  const preview = state.channelPreview;
  if (!preview) return;
  const { chatId, chat } = preview;
  const isGroup = chat?.type === 'group';
  const isOpenChannel = Boolean(chat && !isGroup && chat.requiresSubscription === false);

  if (state.myChatIds.has(chatId)) {
    closeChannelPreview();
    selectChat(chatId);
    return;
  }
  if (isOpenChannel) {
    closeChannelPreview();
    openChannelReadOnly(chatId, chat);
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
  const message = state.msgMenuMessage;
  if (!message) return;
  const anchor = dom.msgMenuMore.getBoundingClientRect();
  closeMsgMenu();
  openReactionPicker(message, anchor);
});

// Режим выделения текста: клик вне выбранного сообщения выключает его.
document.addEventListener('pointerdown', (event) => {
  const active = document.querySelector('.message.text-selectable');
  if (!active) return;
  if (active.contains(event.target)) return;
  if (event.target.closest?.('#msg-menu-overlay')) return;
  stopTextSelection();
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

// Соединение с базой поднимаем сразу: пока Auth восстанавливает сессию,
// успевает открыться WebSocket, и первый запрос не ждёт рукопожатия.
Chat.warmUpConnection();

/**
 * Применить код из формы после входа. Возвращает true, если аккаунт получил
 * подтверждение инвайта и профиль можно создавать.
 */
async function claimPendingInvite(user) {
  if (!pendingInviteCode) return false;
  const code = pendingInviteCode;
  pendingInviteCode = '';
  try {
    await Invites.redeemInviteCode({ uid: user.uid, code });
    clearInviteParamFromUrl();
    lastInviteError = '';
    return true;
  } catch (error) {
    console.error('Не удалось применить инвайт-код:', error);
    lastInviteError = error?.message || 'Не удалось применить инвайт-код';
    return false;
  }
}

Auth.watchAuthState((user) => enqueueRoute(user));

/** Поставить разбор состояния Auth в очередь и дождаться его. */
function enqueueRoute(user) {
  // onAuthStateChanged может сработать несколько раз подряд (вход, привязка
  // провайдера, обновление токена). Маршрут выстраиваем в очередь: иначе два
  // параллельных разбора профиля могут дважды применить инвайт-код.
  routeQueue = routeQueue
    .then(() => handleAuthChange(user))
    .catch((error) => {
      console.error('Ошибка маршрута экранов:', error);
      // Не оставляем пустой экран: показываем вход, как было до экрана загрузки.
      showAuthScreen();
    })
    .then(() => hideBootScreen());
  return routeQueue;
}

async function handleAuthChange(user) {
  if (!user) {
    Sessions.stopSession({ removeRecord: false }).catch(() => {});
    teardownSubscriptions();
    state.user = null;
    state.profile = null;
    pendingInviteCode = '';
    lastInviteError = '';
    showAuthScreen();
    return;
  }

  await routeSignedInUser(user);
}

/**
 * Дозаполнить публичный индекс входа (только супер-админ).
 * Запускается в простое и один раз за сессию: чтение /usernames и /users
 * целиком не должно конкурировать с загрузкой чатов при входе.
 */
function scheduleLoginIndexBackfill(uid) {
  if (!uid || loginIndexBackfilledFor === uid) return;
  loginIndexBackfilledFor = uid;

  const run = () => {
    Chat.isRootAdmin(uid)
      .then((isRoot) => (isRoot ? Chat.backfillLoginIndex() : 0))
      .catch((error) => console.warn('Не удалось дозаполнить индекс входа:', error));
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 5000 });
  } else {
    window.setTimeout(run, 3000);
  }
}

/**
 * Разложить вошедшего пользователя по экранам: мессенджер, онбординг,
 * требование инвайта или бан. Вызывается при смене состояния Auth и после
 * успешного применения инвайт-кода на отдельном экране.
 */
async function routeSignedInUser(user) {
  state.user = user;

  // Удаление, бан и профиль — независимые узлы: читаем их параллельно,
  // иначе восстановление сессии тратит по кругу сети на каждый.
  const deletedPromise = Chat.getDeletedAccount(user.uid).catch((error) => {
    console.warn('Не удалось проверить удаление аккаунта:', error);
    return false;
  });
  const banPromise = Chat.getBan(user.uid).catch((error) => {
    console.warn('Не удалось проверить бан:', error);
    return null;
  });
  // ensureUserRecord читает /users/$uid и создаёт базовый узел только тем,
  // у кого есть подтверждение инвайта (/user_invites/$uid).
  const profilePromise = Auth.ensureUserRecord(user).then(
    (profile) => ({ profile }),
    (error) => ({ error }),
  );

  // Реестр активных сессий: записываем это устройство и слушаем отзыв.
  if (sessionStartedForUid !== user.uid) {
    sessionStartedForUid = user.uid;
    Sessions.startSession(user.uid, () => {
      if (accountDeletionInProgress) return;
      toast('Сессия завершена на другом устройстве', 'error');
      logoutCurrentUser();
    }).catch((error) => {
      console.warn('Не удалось зарегистрировать сессию:', error);
    });
  }

  // Удалённый аккаунт: не создаём сессию, не восстанавливаем email и не
  // запускаем онбординг. Вход закрыт, показываем экран удаления.
  const deleted = await deletedPromise;
  if (state.user !== user) return;
  if (deleted) {
    state.myDeleted = true;
    state.myBan = await banPromise;
    showDeletedScreen();
    return;
  }
  state.myDeleted = false;

  // Список чатов начинает грузиться, пока читается профиль: к моменту показа
  // мессенджера он обычно уже наполнен. Остальные подписки — в enterMessenger.
  startChatListSubscriptions(user.uid);

  let profile = null;
  let inviteRequired = false;
  const profileResult = await profilePromise;
  if (profileResult.error) {
    const error = profileResult.error;
    if (error?.code === 'beacon/invite-required') {
      const claimed = await claimPendingInvite(user);
      if (claimed) {
        try {
          profile = await Auth.ensureUserRecord(user);
        } catch (retryError) {
          console.error('Не удалось создать профиль после инвайта:', retryError);
        }
      }
      if (!profile) inviteRequired = true;
    } else {
      console.error('Не удалось загрузить профиль пользователя:', error);
    }
  } else {
    profile = profileResult.profile;
  }

  // Если метку deleted_users прочитать не удалось (например, правила ещё не
  // опубликованы), не пускаем аккаунт по флагу deleted в самом профиле.
  if (profile?.deleted === true) {
    state.profile = profile;
    state.myBan = await banPromise;
    state.myDeleted = true;
    showDeletedScreen();
    return;
  }

  // Супер-админ дозаполняет публичный индекс входа для существующих аккаунтов.
  scheduleLoginIndexBackfill(user.uid);

  const ban = await banPromise;
  if (state.user !== user) return; // пользователь успел выйти, пока грузили

  if (inviteRequired) {
    state.profile = null;
    state.myBan = null;
    state.myDeleted = false;
    showInviteGateScreen(user);
    return;
  }

  // Код больше не нужен: аккаунт уже существует или успешно активирован.
  pendingInviteCode = '';
  lastInviteError = '';

  // Если чтение в ensureUserRecord не удалось, пробуем обычный кэш/повтор.
  state.profile = profile || await Chat.getUserProfile(user.uid, { force: true }).catch(() => null);
  if (state.user !== user) return;
  state.myBan = ban;
  state.myDeleted = false;

  // Бан администратором: живая подписка (снятие бана возвращает в мессенджер).
  state.subscriptions.myBan?.();
  state.subscriptions.myDeleted?.();
  if (state.user !== user) return;
  state.subscriptions.myBan = Chat.subscribeToMyBan(user.uid, (record) => {
    const wasBanned = Boolean(state.myBan);
    state.myBan = record;
    if (state.myDeleted) {
      showDeletedScreen();
      return;
    }
    if (record) {
      showBannedScreen();
    } else {
      hideBannedScreen();
      if (wasBanned && state.user && Chat.isProfileComplete(state.profile)) enterMessenger();
    }
  });
  state.subscriptions.myDeleted = Chat.subscribeToDeletedAccount(user.uid, (isDeleted) => {
    const wasDeleted = Boolean(state.myDeleted);
    state.myDeleted = isDeleted;
    if (isDeleted) {
      showDeletedScreen();
      return;
    }
    hideBannedScreen();
    if (state.myBan) {
      showBannedScreen();
      return;
    }
    if (wasDeleted && state.user && Chat.isProfileComplete(state.profile)) enterMessenger();
  });

  // Профиль ещё не заполнен — онбординг; забанен — экран блокировки.
  if (!Chat.isProfileComplete(state.profile)) showOnboardingScreen();
  else if (state.myBan) showBannedScreen();
  else enterMessenger();
}
