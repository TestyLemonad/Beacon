import * as Chat from '../services/chat.js?v=77';
import * as ColorPicker from '../color-picker.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { normalizeHex } from './avatar-editor.js?v=77';
import { dom } from './dom.js?v=77';
import { buildStatusBadge, chatStatusFor, readableStatusTextColor, userStatusFor } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { createEl, toast } from './utils.js?v=77';

/**
 * Статусы пользователей, каналов и групп (только root-админы)
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* --- Статусы пользователей, каналов и групп (только root-админы) --- */

let statusFormKind = 'emoji';
let statusFormTarget = 'user';
let statusFormResolved = null;
let statusResolveSeq = 0;

/** Текущий выбранный тип статуса в форме выдачи. */
function currentStatusFormKind() {
  return statusFormKind === 'text' ? 'text' : 'emoji';
}

/** Текущая цель формы выдачи: пользователь или чат. */
function currentStatusFormTarget() {
  return statusFormTarget === 'chat' ? 'chat' : 'user';
}

/** Сбросить форму статуса к исходному состоянию. */
export function resetStatusForm() {
  if (!dom.prefsStatusUser) return;
  statusResolveSeq += 1;
  statusFormTarget = 'user';
  statusFormKind = 'emoji';
  statusFormResolved = null;
  dom.prefsStatusUser.value = '';
  dom.prefsStatusValue.value = '';
  dom.prefsStatusColor.value = Chat.STATUS_DEFAULT_COLOR;
  ColorPicker.syncColorChip(dom.prefsStatusColorPick, dom.prefsStatusColor);
  dom.prefsStatusTarget.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusTarget === 'user');
  });
  dom.prefsStatusKind.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusKind === 'emoji');
  });
  dom.prefsStatusError.textContent = '';
  dom.prefsStatusError.classList.add('hidden');
  dom.prefsStatusSave.disabled = false;
  dom.prefsStatusClear.disabled = false;
  syncStatusTarget();
  syncStatusFormKind();
  renderStatusPreview();
  renderCurrentStatus();
}

/** Подсказки, которые зависят от того, кому выдаём статус. */
function syncStatusTarget() {
  const isChat = currentStatusFormTarget() === 'chat';
  dom.prefsStatusUser.placeholder = isChat ? '@канал или @группа' : '@username';
  dom.prefsStatusClear.textContent = isChat ? 'Снять у чата' : 'Снять';
}

/** Показать/скрыть поля, которые зависят от типа статуса. */
function syncStatusFormKind() {
  const isText = currentStatusFormKind() === 'text';
  dom.prefsStatusColorField.classList.toggle('hidden', !isText);
  dom.prefsStatusEmojiBtn.classList.toggle('hidden', isText);
  dom.prefsStatusValue.maxLength = isText ? Chat.STATUS_TEXT_MAX : 24;
  dom.prefsStatusValue.placeholder = isText
    ? `Текст до ${Chat.STATUS_TEXT_MAX} символов`
    : 'Любой эмодзи';
  dom.prefsStatusSave.textContent = isText ? 'Выдать текст' : 'Выдать эмодзи';
}

/** Статус выбранной цели (null, если его нет). */
function statusOfTarget(target) {
  if (!target) return null;
  return target.type === 'chat' ? chatStatusFor(target.id) : userStatusFor(target.id);
}

/** Строка «Сейчас: …» с текущим статусом найденной цели. */
export function renderCurrentStatus() {
  if (!dom.prefsStatusCurrent) return;
  dom.prefsStatusCurrent.textContent = '';
  const status = statusOfTarget(statusFormResolved);
  if (!status) {
    dom.prefsStatusCurrent.classList.add('hidden');
    return;
  }
  dom.prefsStatusCurrent.classList.remove('hidden');
  dom.prefsStatusCurrent.append(createEl('span', 'status-editor-label', 'Сейчас:'));
  dom.prefsStatusCurrent.append(buildStatusBadge(status));
  Emoji.parse(dom.prefsStatusCurrent);
}

/**
 * Найти цель по @username: пользователя либо канал/группу.
 * @returns {Promise<{type: 'user'|'chat', id: string, label: string}>}
 */
async function resolveStatusTarget(raw) {
  if (currentStatusFormTarget() === 'chat') {
    const chat = await Chat.getChatByUsername(raw);
    if (!chat?.chatId) throw new Error('Канал или группа с таким юзернеймом не найдены');
    return { type: 'chat', id: chat.chatId, label: '@' + (chat.username || Chat.normalizeUsername(raw)) };
  }

  const user = await Chat.getUserByUsername(raw);
  if (!user?.uid) throw new Error('Пользователь с таким юзернеймом не найден');
  if (user.deleted) throw new Error('Аккаунт удалён — статус не поставить');
  return { type: 'user', id: user.uid, label: '@' + (user.username || Chat.normalizeUsername(raw)) };
}

/** Перечитать цель по введённому @username и показать её текущий статус. */
async function refreshCurrentStatus() {
  const raw = dom.prefsStatusUser.value.trim();
  const seq = ++statusResolveSeq;
  statusFormResolved = null;
  renderCurrentStatus();
  if (!raw) return;

  try {
    const target = await resolveStatusTarget(raw);
    if (seq !== statusResolveSeq) return;
    statusFormResolved = target;
  } catch {
    // Молчим: точную ошибку покажем при сохранении.
    return;
  }
  renderCurrentStatus();
}

/** Живой предпросмотр статуса из полей формы. */
export function renderStatusPreview() {
  if (!dom.prefsStatusPreview) return;
  dom.prefsStatusPreview.innerHTML = '';

  const value = String(dom.prefsStatusValue.value || '').trim();
  if (!value) {
    dom.prefsStatusPreview.append(createEl('span', 'status-preview-hint', 'Предпросмотр статуса'));
    return;
  }

  const kind = currentStatusFormKind();
  const badge = createEl('span', `user-status user-status-${kind}`);
  badge.textContent = kind === 'text'
    ? [...value].slice(0, Chat.STATUS_TEXT_MAX).join('')
    : value;
  if (kind === 'text') {
    const color = normalizeHex(dom.prefsStatusColor.value) || Chat.STATUS_DEFAULT_COLOR;
    badge.style.background = color;
    badge.style.color = readableStatusTextColor(color);
  }
  dom.prefsStatusPreview.append(badge);
  Emoji.parse(badge);
}

/** Ошибка в форме статуса. */
function showStatusError(message) {
  dom.prefsStatusError.textContent = message;
  dom.prefsStatusError.classList.remove('hidden');
}

/** Привести ошибку записи статуса к понятному тексту. */
export function statusWriteError(error) {
  const message = String(error?.message || '');
  if (/permission|denied|PERMISSION_DENIED/i.test(message)) {
    return 'Нет доступа на запись: проверьте, что новые правила базы опубликованы';
  }
  return message || 'Не удалось сохранить статус';
}

/** Записать статус цели ({type: 'user'|'chat', id}) — общий путь админки. */
export async function writeStatusToTarget(target, { kind, value, color = '' }) {
  const payload = {
    kind,
    value,
    color: kind === 'text' ? color : '',
    by: state.user.uid,
  };
  if (target.type === 'chat') await Chat.setChatStatus({ chatId: target.id, ...payload });
  else await Chat.setUserStatus({ uid: target.id, ...payload });
}

/** Снять статус цели ({type: 'user'|'chat', id}). */
export async function clearStatusOfTarget(target) {
  if (target.type === 'chat') await Chat.removeChatStatus(target.id);
  else await Chat.removeUserStatus(target.id);
}

/** Выдать или заменить статус по @username (только супер-админ). */
async function saveUserStatusClick() {
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  const raw = dom.prefsStatusUser.value.trim();
  if (!raw) {
    showStatusError('Введите @username');
    dom.prefsStatusUser.focus();
    return;
  }

  const kind = currentStatusFormKind();
  const value = String(dom.prefsStatusValue.value || '').trim();
  if (!value) {
    showStatusError(kind === 'text' ? 'Введите текст статуса' : 'Выберите эмодзи');
    dom.prefsStatusValue.focus();
    return;
  }
  if (kind === 'emoji' && !/\p{Extended_Pictographic}/u.test(value)) {
    showStatusError('В режиме «Эмодзи» нужен эмодзи — или переключитесь на «Текст»');
    dom.prefsStatusValue.focus();
    return;
  }

  dom.prefsStatusError.classList.add('hidden');
  dom.prefsStatusSave.disabled = true;
  dom.prefsStatusSave.textContent = 'Сохраняем…';
  try {
    const target = await resolveStatusTarget(raw);
    statusFormResolved = target;

    const hadStatus = Boolean(statusOfTarget(target));
    await writeStatusToTarget(target, {
      kind,
      value,
      color: normalizeHex(dom.prefsStatusColor.value) || Chat.STATUS_DEFAULT_COLOR,
    });

    toast(hadStatus ? 'Статус обновлён' : 'Статус выдан', 'success');
    dom.prefsStatusValue.value = '';
    renderStatusPreview();
    renderCurrentStatus();
    dom.prefsStatusError.classList.add('hidden');
  } catch (error) {
    console.error(error);
    showStatusError(statusWriteError(error));
  } finally {
    dom.prefsStatusSave.disabled = false;
    syncStatusFormKind();
  }
}

/** Снять статус по @username (только супер-админ). */
async function clearUserStatusClick() {
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  const raw = dom.prefsStatusUser.value.trim();
  if (!raw) {
    showStatusError('Введите @username');
    dom.prefsStatusUser.focus();
    return;
  }

  dom.prefsStatusError.classList.add('hidden');
  dom.prefsStatusClear.disabled = true;
  try {
    const target = await resolveStatusTarget(raw);
    statusFormResolved = target;
    renderCurrentStatus();

    if (!statusOfTarget(target)) {
      showStatusError(target.type === 'chat' ? 'У этого чата нет статуса' : 'У этого пользователя нет статуса');
      return;
    }
    const what = target.type === 'chat' ? 'чата' : 'пользователя';
    if (!window.confirm(`Снять статус ${what} ${target.label}?`)) return;

    await clearStatusOfTarget(target);

    toast('Статус снят', 'success');
    dom.prefsStatusValue.value = '';
    renderStatusPreview();
    renderCurrentStatus();
  } catch (error) {
    console.error(error);
    showStatusError(statusWriteError(error));
  } finally {
    dom.prefsStatusClear.disabled = false;
  }
}

/** Навесить обработчики интерфейса этого модуля. */
export function initStatusAdmin() {
  dom.prefsStatusTarget.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-status-target]');
    if (!btn) return;
    statusFormTarget = btn.dataset.statusTarget === 'chat' ? 'chat' : 'user';
    dom.prefsStatusTarget.querySelectorAll('.seg-btn').forEach((item) => {
      item.classList.toggle('active', item === btn);
    });
    syncStatusTarget();
    refreshCurrentStatus();
  });

  dom.prefsStatusUser.addEventListener('change', refreshCurrentStatus);

  dom.prefsStatusKind.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-status-kind]');
    if (!btn) return;
    statusFormKind = btn.dataset.statusKind === 'text' ? 'text' : 'emoji';
    dom.prefsStatusKind.querySelectorAll('.seg-btn').forEach((item) => {
      item.classList.toggle('active', item === btn);
    });
    syncStatusFormKind();
    renderStatusPreview();
  });

  dom.prefsStatusValue.addEventListener('input', renderStatusPreview);
  dom.prefsStatusColor.addEventListener('input', renderStatusPreview);
  // Цвет фона статуса выбирается общим пикером, значение по-прежнему живёт в HEX-поле.
  ColorPicker.bindColorField({ chip: dom.prefsStatusColorPick, input: dom.prefsStatusColor });
  dom.prefsStatusSave.addEventListener('click', saveUserStatusClick);
  dom.prefsStatusClear.addEventListener('click', clearUserStatusClick);
  dom.prefsStatusUser.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveUserStatusClick();
    }
  });

  dom.prefsStatusEmojiBtn.addEventListener('click', () => {
    Emoji.openPicker({
      mode: 'insert',
      anchor: dom.prefsStatusEmojiBtn,
      trigger: dom.prefsStatusEmojiBtn,
      onSelect: (emoji) => {
        dom.prefsStatusValue.value = emoji;
        renderStatusPreview();
        Emoji.closePicker();
      },
    });
  });

}

