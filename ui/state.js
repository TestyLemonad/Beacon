import * as Invites from '../services/invites.js?v=77';

/**
 * Общее состояние приложения
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Состояние приложения
 * ============================================================ */

export const state = {
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
  pendingInviteCode: '',    // код из формы, который нужно применить после входа
  lastInviteError: '',      // последняя ошибка кода — показываем на экране требования инвайта
  accountDeletionInProgress: false, // удаляем аккаунт: не реагируем на отзыв сессии

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


/** Глубокие ссылки: ?s=запрос — глобальный поиск, ?u=@username — человек/канал/группа,
 *  ?invite_code=… — инвайт-код с автоподстановкой на экране регистрации. */
const deepLinkParams = new URLSearchParams(window.location.search);
export const deepLink = {
  search: String(deepLinkParams.get('s') || '').trim(),
  username: String(deepLinkParams.get('u') || '').trim(),
  invite: Invites.normalizeInviteCode(deepLinkParams.get('invite_code') || ''),
};

export const DEV_CHANNEL_ID = '-P4EgAjn7KM6VFk2-rc_';
