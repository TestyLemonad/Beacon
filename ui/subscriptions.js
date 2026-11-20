import * as Chat from '../services/chat.js?v=77';
import * as Sessions from '../services/sessions.js?v=77';
import { hideBannedScreen } from './access.js?v=77';
import { refreshTargetAdminCard, refreshUsernameAdminBlocks } from './admin-target.js?v=77';
import { closeInvitesModal, loadUsernameAliases } from './admin-usernames.js?v=77';
import { logoutCurrentUser } from './auth-screen.js?v=77';
import { archivedChats, closeChatCtxMenu, renderChatCtxFolders, renderChatCtxMenu, renderChatCtxNotify } from './chat-list-menu.js?v=77';
import { closeArchiveModal, renderArchiveList, resetChatList, scheduleChatListRender } from './chat-list.js?v=77';
import { renderChatMenu } from './chat-menu.js?v=77';
import { closeSettingsModal, renderSettingsAdmins, renderSettingsAliases, renderSettingsMembers, settingsChatId } from './chat-settings.js?v=77';
import { clearChatScoped, closeActiveChat, renderMainPanel, setupChatScoped } from './chat-view.js?v=77';
import { cancelComposerMode } from './composer.js?v=77';
import { dom } from './dom.js?v=77';
import { closeCommentsModal, closePollModal, closeStatsModal } from './extras.js?v=77';
import { closeMsgMenu } from './message-menu.js?v=77';
import { renderMessages, resetMessages } from './messages.js?v=77';
import { maybeNotifyChat, resetNotifications, scheduleMuteRefresh, startNotificationWindow } from './notifications.js?v=77';
import { closePrefsModal, renderPrefsModal } from './prefs.js?v=77';
import { renderProfileAliases } from './profile-modal.js?v=77';
import { scheduleProfileRefresh, stopProfileWatch, updateSidebarUser, watchUserProfiles } from './profile-view.js?v=77';
import { exitSearchMode } from './search.js?v=77';
import { DEV_CHANNEL_ID, state } from './state.js?v=77';
import { renderCurrentStatus, renderStatusPreview } from './status-admin.js?v=77';
import { toast } from './utils.js?v=77';

/**
 * Подписки Realtime Database и их очистка
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let sessionStartedForUid = null;    // uid, для которого уже запущен реестр сессий
let loginIndexBackfilledFor = null; // uid, для которого индекс входа уже дозаполняли
let subscriptionsStarted = false;   // полный набор подписок после входа уже поднят

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

        // Новое сообщение в любом чате — браузерное уведомление (вкладка открыта).
        if (chat) maybeNotifyChat(chatId, chat);

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
export function startChatListSubscriptions(uid) {
  if (!state.user || state.subscriptions.userChats) return;

  // Уведомляем только о том, что пришло после входа: история не должна всплывать.
  startNotificationWindow();

  state.subscriptions.userChats = Chat.subscribeToUserChats(
    uid,
    handleUserChatsUpdate,
    () => toast('Не удалось загрузить список чатов', 'error'),
  );

  // Архив, закреп и папки — личные настройки списка чатов.
  state.subscriptions.userMeta = Chat.subscribeToUserChatMeta(uid, (map) => {
    state.chatMeta = new Map(Object.entries(map || {}));
    scheduleChatListRender();
    scheduleMuteRefresh();
    if (!dom.archiveOverlay.classList.contains('hidden')) renderArchiveList();
    if (!dom.chatCtxOverlay.classList.contains('hidden')) {
      // Открыто подменю — остаёмся в нём (обновляем галочки и сроки).
      if (!dom.chatCtxFolders.classList.contains('hidden')) renderChatCtxFolders();
      else if (!dom.chatCtxNotify.classList.contains('hidden')) renderChatCtxNotify();
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
export function startSubscriptions() {
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
export function teardownSubscriptions() {
  const uid = state.user?.uid || null;
  sessionStartedForUid = null;
  loginIndexBackfilledFor = null;
  subscriptionsStarted = false;
  resetNotifications();
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
  resetChatList();
  resetMessages();
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


/**
 * Дозаполнить публичный индекс входа (только супер-админ).
 * Запускается в простое и один раз за сессию: чтение /usernames и /users
 * целиком не должно конкурировать с загрузкой чатов при входе.
 */
export function scheduleLoginIndexBackfill(uid) {
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
/** Зарегистрировать устройство в реестре активных сессий один раз за вход. */
export function ensureSessionStarted(uid) {
  if (!uid || sessionStartedForUid === uid) return;
  sessionStartedForUid = uid;
  Sessions.startSession(uid, () => {
    if (state.accountDeletionInProgress) return;
    toast('Сессия завершена на другом устройстве', 'error');
    logoutCurrentUser();
  }).catch((error) => {
    console.warn('Не удалось зарегистрировать сессию:', error);
  });
}

