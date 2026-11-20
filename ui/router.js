import * as Auth from '../services/auth.js?v=77';
import * as Chat from '../services/chat.js?v=77';
import * as Invites from '../services/invites.js?v=77';
import * as Sessions from '../services/sessions.js?v=77';
import { hideBannedScreen, renderBlockedList, showBannedScreen, showDeletedScreen } from './access.js?v=77';
import { clearInviteParamFromUrl, hideBootScreen, hideInviteGateScreen, showAuthScreen, showInviteGateScreen, showOnboardingScreen } from './auth-screen.js?v=77';
import { renderChatList } from './chat-list.js?v=77';
import { renderMainPanel } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { askNotificationPermissionAfterLogin } from './notifications.js?v=77';
import { updateSidebarUser } from './profile-view.js?v=77';
import { applyDeepLink, renderSearchResults } from './search.js?v=77';
import { state } from './state.js?v=77';
import { ensureSessionStarted, scheduleLoginIndexBackfill, startChatListSubscriptions, startSubscriptions, teardownSubscriptions } from './subscriptions.js?v=77';

/**
 * Маршрутизация по состоянию авторизации
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let routeQueue = Promise.resolve(); // очередь разбора состояния Auth по экранам

/* Показать мессенджер (профиль заполнен). */
export function enterMessenger() {
  dom.authScreen.classList.add('hidden');
  dom.onboardingScreen.classList.add('hidden');
  hideInviteGateScreen();
  dom.messengerScreen.classList.remove('hidden');
  updateSidebarUser();
  renderChatList();
  startSubscriptions();
  askNotificationPermissionAfterLogin();

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

// --- Роутинг по состоянию авторизации ---

// Соединение с базой поднимаем сразу: пока Auth восстанавливает сессию,
// успевает открыться WebSocket, и первый запрос не ждёт рукопожатия.
Chat.warmUpConnection();

/**
 * Применить код из формы после входа. Возвращает true, если аккаунт получил
 * подтверждение инвайта и профиль можно создавать.
 */
async function claimPendingInvite(user) {
  if (!state.pendingInviteCode) return false;
  const code = state.pendingInviteCode;
  state.pendingInviteCode = '';
  try {
    await Invites.redeemInviteCode({ uid: user.uid, code });
    clearInviteParamFromUrl();
    state.lastInviteError = '';
    return true;
  } catch (error) {
    console.error('Не удалось применить инвайт-код:', error);
    state.lastInviteError = error?.message || 'Не удалось применить инвайт-код';
    return false;
  }
}

/** Поставить разбор состояния Auth в очередь и дождаться его. */
export function enqueueRoute(user) {
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
    state.pendingInviteCode = '';
    state.lastInviteError = '';
    showAuthScreen();
    return;
  }

  await routeSignedInUser(user);
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
  ensureSessionStarted(user.uid);

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
  state.pendingInviteCode = '';
  state.lastInviteError = '';

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
/** Подписаться на состояние Auth: очередь маршрутов запускается один раз. */
export function startRouter() {
  Auth.watchAuthState((user) => enqueueRoute(user));
}

