import * as Chat from '../services/chat.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { setBlocked, setUserBanned } from './access.js?v=77';
import { openTargetAdmin, refreshReservedNameCache } from './admin-target.js?v=77';
import { openSettingsModal } from './chat-settings.js?v=77';
import { closeActiveChat, updateChatStatus } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { openStatsModal } from './extras.js?v=77';
import { buildMessageText } from './messages.js?v=77';
import { applyChatMute, isChatMuted } from './notifications.js?v=77';
import { adminRightsOn, applyAliasHint, applyChatAvatar, applyProfileAvatar, applyStatus, chatItemStatus, createIcon, getChatTitle, getPrivatePeerUid, getProfileName, hydrateUsers } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { createEl, toast } from './utils.js?v=77';

/**
 * Всплывающее меню чата (клик по аватарке в шапке)
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

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

export function closeChatMenu() {
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
export function renderChatMenu() {
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

  // Уведомления чата: быстрый переключатель (срок — в меню списка чатов).
  const chatMuted = isChatMuted(state.activeChatId);
  addChatMenuAction(chatMuted ? 'Включить уведомления' : 'Выключить уведомления', () => {
    closeChatMenu();
    applyChatMute(state.activeChatId, chatMuted ? null : 'forever');
  }, chatMuted ? 'bell' : 'bellOff');

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


/** Навесить обработчики интерфейса этого модуля. */
export function initChatMenu() {
  // Меню чата: открывается по клику на аватарку в шапке.
  dom.chatMenuBtn.addEventListener('click', openChatMenu);
  dom.chatMenuClose.addEventListener('click', closeChatMenu);
  dom.chatMenuOverlay.addEventListener('click', (event) => {
    if (event.target === dom.chatMenuOverlay) closeChatMenu();
  });
}

