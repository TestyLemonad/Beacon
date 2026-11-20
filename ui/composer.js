import * as Chat from '../services/chat.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { dom } from './dom.js?v=77';
import { toggleReaction } from './message-menu.js?v=77';
import { getOwnDisplayName, getSenderName } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { isTouchDevice, toast } from './utils.js?v=77';

/**
 * Поле ввода, черновики, отправка, ответ и редактирование
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let typingTimer = null;             // таймер «печатает…» (сброс после паузы)
let typingLastSent = 0;             // когда последний раз писали «печатает…» (unix-секунды)
let composerMeasure = { value: null, width: -1 }; // кэш замеров поля ввода

/** Сбросить «печатает…» для чата, из которого уходим. */
export function clearOwnTyping() {
  clearTimeout(typingTimer);
  typingTimer = null;
  typingLastSent = 0;
  if (state.activeChatId && state.user) {
    Chat.clearTyping(state.activeChatId, state.user.uid).catch(() => {});
  }
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
export function flushDrafts() {
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
export function restoreDraftIntoComposer() {
  dom.messageInput.value = loadDraft(state.activeChatId);
  autoGrowComposer();
}

/** Плашка над полем ввода: обычный режим / «ответ» / «редактирование». */
export function setComposerMode(mode) {
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
export function cancelComposerMode() {
  state.composerMode = null;
  dom.composerContext.classList.add('hidden');
  dom.messageInput.value = '';
  restoreDraftIntoComposer(); // вернуть в поле черновик чата
}

/** Авторастягивание поля ввода: от одной строки до 148 px. */
export function autoGrowComposer() {
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


/** Навесить обработчики интерфейса этого модуля. */
export function initComposer() {
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

  /** Enter ли это — с запасным вариантом для клавиатур без event.key. */
  function isEnterKey(event) {
    if (event.key === 'Enter' || event.key === 'Return') return true;
    return !event.key && (event.keyCode === 13 || event.which === 13);
  }

  /** Отправить из композера так же, как кнопкой (requestSubmit есть не везде). */
  function submitComposer() {
    if (typeof dom.messageForm.requestSubmit === 'function') {
      dom.messageForm.requestSubmit();
      return;
    }
    dom.messageForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }

  // Поле ввода: Enter отправляет (на тач-устройствах — перенос строки), Shift+Enter — перенос.
  dom.messageInput.addEventListener('keydown', (event) => {
    // Композиция IME: Enter подтверждает ввод, а не отправляет сообщение.
    if (event.isComposing || event.keyCode === 229) return;
    if (!isEnterKey(event)) return;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    if (isTouchDevice()) return;
    event.preventDefault();
    submitComposer();
  });
  dom.messageInput.addEventListener('input', () => {
    autoGrowComposer();
    if (dom.messageInput.value.trim()) notifyTyping();
    if (!state.composerMode) saveDraft(state.activeChatId, dom.messageInput.value);
  });
  dom.messageInput.addEventListener('paste', () => {
    window.setTimeout(autoGrowComposer, 0);
  });

  dom.composerContextCancel.addEventListener('click', cancelComposerMode);
}

