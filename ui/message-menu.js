import * as Chat from '../services/chat.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { sortedChats } from './chat-list.js?v=77';
import { setComposerMode } from './composer.js?v=77';
import { dom } from './dom.js?v=77';
import { openCommentsModal } from './extras.js?v=77';
import { adminRightsOn, applyChatAvatar, buildNameWithStatus, chatItemStatus, createIcon, getChatTitle, getSenderName } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { REACTIONS_TOP, createEl, toast } from './utils.js?v=77';

/**
 * Меню сообщения: реакции, ответ, правка, пересылка, закреп, удаление
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Меню сообщения: реакции, ответ, правка, пересылка, закреп
 * ============================================================ */

/** Поставить/снять реакцию (из меню или кликом по пилюле под сообщением). */
export async function toggleReaction(message, emoji) {
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
export function openMsgMenu(message, x, y) {
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
export function closeMsgMenu() {
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
export function openReactionPicker(message, anchor) {
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
export async function copyToClipboard(text) {
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
export function stopTextSelection() {
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
export function closeDeleteChoice() {
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
export function openForwardModal(message) {
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
export function closeForwardModal() {
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


/** Навесить обработчики интерфейса этого модуля. */
export function initMessageMenu() {
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
}

