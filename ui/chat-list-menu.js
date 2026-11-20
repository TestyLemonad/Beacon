import * as Chat from '../services/chat.js?v=77';
import { getChatMeta, sortedChats } from './chat-list.js?v=77';
import { dom } from './dom.js?v=77';
import { NOTIFY_MUTE_OPTIONS, applyChatMute, chatMuteInfo, chatMuteLabel } from './notifications.js?v=77';
import { createIcon } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { createEl, toast } from './utils.js?v=77';

/**
 * Меню чата в списке (ПКМ / долгое нажатие): закрепить, архив, папки
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Меню чата в списке (ПКМ / долгое нажатие): закрепить, архив, папки
 * ============================================================ */

let chatCtxPos = null; // точка открытия меню чата в списке

/** Чаты в архиве (для окна «Архив» и счётчика в настройках). */
export function archivedChats() {
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
export function openChatCtxMenu(chatId, x, y) {
  if (!state.myChatIds.has(chatId)) return;
  state.chatCtxChatId = chatId;
  chatCtxPos = { x, y };
  renderChatCtxMenu();
  dom.chatCtxOverlay.classList.remove('hidden');
}

/** Закрыть меню чата. */
export function closeChatCtxMenu() {
  dom.chatCtxOverlay.classList.add('hidden');
  state.chatCtxChatId = null;
  chatCtxPos = null;
}

/** Действия меню: закрепить, в архив, папки (+ создание новой). */
export function renderChatCtxMenu() {
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

  const mute = chatMuteInfo(meta);
  addAction(
    mute ? 'bellOff' : 'bell',
    mute ? 'Уведомления выключены' : 'Уведомления включены',
    openChatCtxNotify,
  );

  // Основной вид — действия; папки и уведомления открываются подменю.
  dom.chatCtxActions.classList.remove('hidden');
  dom.chatCtxFolders.classList.add('hidden');
  dom.chatCtxNotify.classList.add('hidden');
  positionChatCtxMenu();
}

/** Показать подменю «Уведомления»: включить или заглушить на время. */
function openChatCtxNotify() {
  dom.chatCtxActions.classList.add('hidden');
  dom.chatCtxFolders.classList.add('hidden');
  dom.chatCtxNotify.classList.remove('hidden');
  renderChatCtxNotify();
}

/** Вернуться от подменю уведомлений к действиям меню. */
function closeChatCtxNotify() {
  dom.chatCtxNotify.classList.add('hidden');
  dom.chatCtxActions.classList.remove('hidden');
  positionChatCtxMenu();
}

/** Варианты мьюта: включить, на 1 час / 8 часов / 1 день / 3 дня, навсегда. */
export function renderChatCtxNotify() {
  const chatId = state.chatCtxChatId;
  if (!chatId) return;

  const mute = chatMuteInfo(getChatMeta(chatId));
  dom.chatCtxNotify.innerHTML = '';

  const head = createEl('div', 'ctx-subhead');
  const backBtn = createEl('button', 'ctx-back-btn');
  backBtn.type = 'button';
  backBtn.title = 'Назад';
  backBtn.append(createIcon('back'));
  backBtn.addEventListener('click', closeChatCtxNotify);
  head.append(backBtn, createEl('span', 'ctx-title', 'Уведомления'));
  dom.chatCtxNotify.append(head);

  if (mute) {
    dom.chatCtxNotify.append(createEl('p', 'ctx-note', chatMuteLabel(mute)));

    const enable = createEl('button', 'ctx-action ctx-action-active');
    enable.type = 'button';
    const check = createEl('span', 'ctx-check');
    check.append(createIcon('check'));
    enable.append(check, createEl('span', 'ctx-label', 'Включить уведомления'));
    enable.addEventListener('click', () => {
      closeChatCtxMenu();
      applyChatMute(chatId, null);
    });
    dom.chatCtxNotify.append(enable);
  }

  for (const option of NOTIFY_MUTE_OPTIONS) {
    const btn = createEl('button', 'ctx-action');
    btn.type = 'button';
    const icon = createEl('span', 'ctx-check');
    icon.append(createIcon('bellOff'));
    btn.append(icon, createEl('span', 'ctx-label', option.label));
    btn.addEventListener('click', () => {
      closeChatCtxMenu();
      applyChatMute(chatId, option.seconds);
    });
    dom.chatCtxNotify.append(btn);
  }

  const forever = createEl('button', 'ctx-action');
  forever.type = 'button';
  const foreverIcon = createEl('span', 'ctx-check');
  foreverIcon.append(createIcon('bellOff'));
  forever.append(foreverIcon, createEl('span', 'ctx-label', 'Навсегда'));
  forever.addEventListener('click', () => {
    closeChatCtxMenu();
    applyChatMute(chatId, 'forever');
  });
  dom.chatCtxNotify.append(forever);

  positionChatCtxMenu();
}

/** Показать подменю «Переместить в папку». */
function openChatCtxFolders() {
  dom.chatCtxActions.classList.add('hidden');
  dom.chatCtxNotify.classList.add('hidden');
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
export function renderChatCtxFolders() {
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


/** Навесить обработчики интерфейса этого модуля. */
export function initChatListMenu() {

  // --- Меню чата в списке (ПКМ / долгое нажатие) ---
  dom.chatCtxOverlay.addEventListener('click', (event) => {
    if (event.target === dom.chatCtxOverlay) closeChatCtxMenu();
  });
  dom.chatCtxOverlay.addEventListener('contextmenu', (event) => event.preventDefault());
}

