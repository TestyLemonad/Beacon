import * as Chat from '../services/chat.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { renderChatList } from './chat-list.js?v=77';
import { closeChatMenu, renderChatMenu } from './chat-menu.js?v=77';
import { autoGrowComposer, cancelComposerMode, clearOwnTyping, restoreDraftIntoComposer } from './composer.js?v=77';
import { dom } from './dom.js?v=77';
import { closeMsgMenu } from './message-menu.js?v=77';
import { buildMessageText, flashMessage, renderMessages, resetMessages, scheduleMessagesRender } from './messages.js?v=77';
import { activeTypers, applyAvatar, applyChatAvatar, applyChatStatus, applyStatus, chatItemStatus, getChatStatus, getChatTitle, getPeerPresenceInfo, getPrivatePeerUid, getSenderName, hydrateUsers } from './profile-view.js?v=77';
import { exitSearchMode, syncChatUrl } from './search.js?v=77';
import { state } from './state.js?v=77';
import { createEl, plural, toast } from './utils.js?v=77';

/**
 * Активный чат, предпросмотр канала, закрепы и лента
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let typingTick = null;              // интервал пересчёта строки «печатает…»
let pinBarSignature = null;         // подпись плашки закрепа (пропуск лишних перерисовок)

/* ============================================================
 *  Активный чат, предпросмотр канала и сообщения
 * ============================================================ */

/** Снять подписки, привязанные к активному чату (typing, голоса, комментарии…). */
export function clearChatScoped() {
  for (const unsubscribe of state.subscriptions.chatScoped) unsubscribe();
  state.subscriptions.chatScoped = [];
  state.subscriptions.chatScopedId = null;
  state.subscriptions.messages?.();
  state.subscriptions.messages = null;
  state.messageNodes = new Map();
  state.messageNodesChatId = null;
  resetMessages();
  state.typingMap = new Map();
  state.peerReadTs = 0;
  state.pollVotes = new Map();
  state.chatComments = new Map();
  state.chatViews = new Map();
  state.peerSettings = {};
  state.commentsPost = null;
  state.unreadDivider = null;
  state.dividerScrollPending = false;
  resetChatView();
}

/** Голоса опросов / комментарии / просмотры — подписки открытого чата. */
export function setupChatScoped(chatId, chat) {
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
export function buildUnreadDivider() {
  return createEl('div', 'message-unread-divider', 'Новые сообщения');
}

/** Обновить статус в шапке чата и строку присутствия в меню чата. */
export function updateChatStatus() {
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
export function selectChat(chatId) {
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
export function closeActiveChat() {
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
export async function openChannelPreview(chatId) {
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
export async function openChannelReadOnly(chatId, chat = null) {
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
export function renderMainPanel() {
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
export function renderPinBar() {
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


/** Навесить обработчики интерфейса этого модуля. */
export function initChatView() {
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

  // Плашка закрепа: клик листает закрепы и прыгает к сообщению.
  dom.pinBar.addEventListener('click', cyclePin);
}

/** Сбросить таймер строки «печатает…» и плашку закрепа (при выходе). */
function resetChatView() {
  clearInterval(typingTick);
  typingTick = null;
  pinBarSignature = null;
}

