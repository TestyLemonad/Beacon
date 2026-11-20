import * as Chat from '../services/chat.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { archivedChats, openChatCtxMenu } from './chat-list-menu.js?v=77';
import { selectChat } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { syncMessageList } from './messages.js?v=77';
import { chatMuteInfo, isChatMuted } from './notifications.js?v=77';
import { closePrefsModal } from './prefs.js?v=77';
import { CHAT_TYPE_ICONS, applyChatAvatar, buildNameWithStatus, chatItemStatus, chatStatusFor, createIcon, getChatPreview, getChatStatus, getChatTitle, getPrivatePeerUid, hydrateUsers } from './profile-view.js?v=77';
import { DEV_CHANNEL_ID, state } from './state.js?v=77';
import { createEl, formatListTime, toast } from './utils.js?v=77';

/**
 * Список чатов, архив и промо-канал @dev
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let chatListSignature = null;       // подпись состояния списка чатов (пропуск лишних перерисовок)
let chatListRenderHandle = 0;       // запланированная перерисовка списка (batch подписок RTDB)
let chatListRenderFallback = 0;     // таймер-страховка, если requestAnimationFrame не сработал
let chatListNodes = new Map();      // ключ элемента списка -> { el, sig }: переиспользование узлов
let foldersBarSignature = null;     // подпись полосы папок (пропуск лишних перерисовок)

/* ============================================================
 *  Список чатов (боковая панель)
 * ============================================================ */

/** Личные настройки чата (архив/закреп/папки) — или пустой объект. */
export const EMPTY_CHAT_META = Object.freeze({});
export function getChatMeta(chatId) {
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
export function sortedChats() {
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
export function visibleChats() {
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
export function buildChatListItem(tag, chatId, chat) {
  const meta = getChatMeta(chatId);
  const pinned = Boolean(meta.pinnedAt);
  const muted = Boolean(chatMuteInfo(meta));
  const unread = isChatUnread(chatId, chat);
  const item = createEl(
    tag,
    `chat-item${chatId === state.activeChatId ? ' active' : ''}${pinned ? ' pinned' : ''}${muted ? ' muted' : ''}${unread ? ' unread' : ''}`,
  );
  item.dataset.chatId = chatId;
  item.tabIndex = 0; // фокус для клавиатуры и ТВ-пульта

  const avatar = createEl('div', 'avatar');
  applyChatAvatar(avatar, chatId, chat);

  const body = createEl('div', 'chat-item-body');

  const top = createEl('div', 'chat-item-top');
  top.append(buildNameWithStatus(getChatTitle(chat), chatItemStatus(chatId, chat)));
  if (pinned) top.append(createIcon('pin', 'chat-pin'));
  if (muted) {
    const muteIcon = createIcon('bellOff', 'chat-mute');
    muteIcon.title = 'Уведомления выключены';
    top.append(muteIcon);
  }
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
    isChatMuted(chatId) ? 1 : 0,
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
export function renderChatList(force = false) {
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
export function scheduleChatListRender() {
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
 *  Промо-канал @dev: верхняя строка списка чатов
 * ============================================================ */

/** Открыть диалог «подписаться или скрыть» для канала @dev. */
function openDevPromoModal() {
  renderDevPromoModal();
  dom.devPromoOverlay.classList.remove('hidden');
}

/** Закрыть диалог промо-канала (крестик, клик по фону, Escape). */
export function closeDevPromoModal() {
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

/* ============================================================
 *  Архив чатов (открывается из настроек)
 * ============================================================ */

function openArchiveModal() {
  renderArchiveList();
  dom.archiveOverlay.classList.remove('hidden');
  dom.prefsArchiveCount.textContent = String(archivedChats().length);
}

export function closeArchiveModal() {
  dom.archiveOverlay.classList.add('hidden');
}

/** Список архивированных чатов с кнопкой «Вернуть». */
export function renderArchiveList() {
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


/** Навесить обработчики интерфейса этого модуля. */
export function initChatList() {
  // Полоса папок: колесо мыши прокручивает её по горизонтали.
  dom.foldersBar.addEventListener('wheel', (event) => {
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) return;
    const before = dom.foldersBar.scrollLeft;
    dom.foldersBar.scrollLeft = before + delta;
    if (dom.foldersBar.scrollLeft !== before) event.preventDefault();
  }, { passive: false });

  dom.prefsArchiveBtn.addEventListener('click', () => {
    closePrefsModal();
    openArchiveModal();
  });

  // --- Архив чатов ---
  dom.archiveClose.addEventListener('click', closeArchiveModal);
  dom.archiveOverlay.addEventListener('click', (event) => {
    if (event.target === dom.archiveOverlay) closeArchiveModal();
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
}

/** Сбросить кэш и таймеры списка чатов (при выходе из аккаунта). */
export function resetChatList() {
  chatListSignature = null;
  chatListNodes = new Map();
  foldersBarSignature = null;
  cancelAnimationFrame(chatListRenderHandle);
  chatListRenderHandle = 0;
  window.clearTimeout(chatListRenderFallback);
  chatListRenderFallback = 0;
}

