import { dom } from './dom.js?v=77';

/**
 * Общие утилиты и всплывающие сообщения
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Утилиты
 * ============================================================ */

/** Палитра аватарок-заглушек. */
export const AVATAR_COLORS = ['#f0a24a', '#e06c75', '#61afef', '#98c379', '#c678dd', '#56b6c2', '#d19a66', '#8f9ff5'];

/** Шесть быстрых реакций в меню сообщения. */
export const REACTIONS_TOP = ['👍', '❤️', '🔥', '😂', '😮', '😢'];

/** Стабильный цвет аватарки по произвольному seed (uid или id чата). */
export function avatarColor(seed) {
  let hash = 0;
  for (const char of String(seed || '?')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** unix-секунды -> "ЧЧ:ММ". */
export function formatTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** unix-секунды -> "Сегодня" / "Вчера" / "ДД.ММ.ГГГГ" для разделителей дней. */
export function formatDayLabel(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Сегодня';
  if (sameDay(date, yesterday)) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** unix-секунды -> время для списка чатов (сегодня — ЧЧ:ММ, иначе ДД.ММ). */
export function formatListTime(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  if (date.toDateString() === new Date().toDateString()) return formatTime(unixSeconds);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** unix-секунды -> «был(а) в сети недавно / ЧЧ:ММ / вчера / дата». */
export function formatLastSeen(unixSecondsOrMs) {
  let value = Number(unixSecondsOrMs) || 0;
  if (!value) return 'недавно';
  if (value > 1e12) value = Math.floor(value / 1000); // серверное время приходит в мс
  const date = new Date(value * 1000);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  if (diffMin < 2) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const today = date.toDateString() === now.toDateString();
  if (today) return `сегодня в ${formatTime(value)}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `вчера в ${formatTime(value)}`;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Сенсорный ли основной ввод (мобильные): Enter в поле ввода переносит строку. */
export function isTouchDevice() {
  // navigator.maxTouchPoints здесь не годится: на ноутбуках с тачскрином (и в
  // Firefox/Zen) он больше нуля, и Enter ошибочно считался переносом строки.
  // Основной указатель — мышь/тачпад, значит перед нами клавиатура десктопа.
  if (window.matchMedia('(any-pointer: fine)').matches) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Склонение: plural(3, ['участник', 'участника', 'участников']). */
export function plural(count, forms) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** Склонение: plural(3, ['просмотр', 'просмотра', 'просмотров']). */
export function pluralViews(count) {
  return plural(count, ['просмотр', 'просмотра', 'просмотров']);
}

/** Хелпер создания элементов. Пользовательский текст попадает только через textContent. */
export function createEl(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

/* ============================================================
 *  Уведомления
 * ============================================================ */

let toastTimer = null;

/** Показать всплывающее уведомление. type: 'info' | 'error' | 'success'. */
export function toast(message, type = 'info') {
  dom.toast.textContent = message;
  dom.toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.add('hidden'), 3500);
}

