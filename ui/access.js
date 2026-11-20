import * as Chat from '../services/chat.js?v=77';
import { logoutCurrentUser } from './auth-screen.js?v=77';
import { renderChatList } from './chat-list.js?v=77';
import { renderChatMenu } from './chat-menu.js?v=77';
import { renderMainPanel } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { closePrefsModal } from './prefs.js?v=77';
import { applyProfileAvatar, getPrivatePeerUid, getProfileName, getSenderName, hydrateUsers } from './profile-view.js?v=77';
import { renderSearchResults } from './search.js?v=77';
import { state } from './state.js?v=77';
import { createEl, toast } from './utils.js?v=77';

/**
 * Чёрный список, баны и экраны ограничения доступа
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Чёрный список и настройки группы/канала
 * ============================================================ */

/**
 * Заблокировать (blocked=true) или разблокировать пользователя.
 * Обновляет state.blocked и перерисовывает затронутые части UI.
 */
export async function setBlocked(peerUid, blocked) {
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
export async function setUserBanned(targetUid, banned) {
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
export function showBannedScreen() {
  showAccessRestrictedScreen('banned');
}

/** Показать экран удалённого аккаунта. */
export function showDeletedScreen() {
  showAccessRestrictedScreen('deleted');
}

/** Скрыть экран блокировки. */
export function hideBannedScreen() {
  dom.bannedScreen.classList.add('hidden');
}

/** Список заблокированных в модальном окне. */
export function renderBlockedList() {
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


/** Навесить обработчики интерфейса этого модуля. */
export function initAccess() {
  // Экран блокировки (бан): выход из аккаунта.
  dom.bannedLogout.addEventListener('click', () => {
    logoutCurrentUser();
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

  // Разблокировка из плашки над композером.
  dom.privateUnblockBtn.addEventListener('click', () => {
    const chat = state.chats.get(state.activeChatId);
    const peerUid = getPrivatePeerUid(chat);
    if (peerUid) setBlocked(peerUid, false);
  });
}

