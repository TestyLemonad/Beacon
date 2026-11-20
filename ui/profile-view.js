import * as Chat from '../services/chat.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { renderBlockedList } from './access.js?v=77';
import { renderArchiveList, renderChatList } from './chat-list.js?v=77';
import { renderChatMenu } from './chat-menu.js?v=77';
import { renderSettingsAdmins, renderSettingsMembers, settingsChatId } from './chat-settings.js?v=77';
import { renderMainPanel } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { renderComments } from './extras.js?v=77';
import { openForwardModal } from './message-menu.js?v=77';
import { renderSearchResults } from './search.js?v=77';
import { state } from './state.js?v=77';
import { avatarColor, createEl, formatLastSeen, plural } from './utils.js?v=77';

/**
 * Профили, аватарки, статусы и шапка чата
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let profileRefreshTimer = null;     // отложенная перерисовка после изменения профилей
let profileRefreshPending = false;  // перерисовка уже запрошена

/* ============================================================
 *  Профили: отображение
 * ============================================================ */

/** Полное имя пользователя или @юзернейм. */
export function getProfileName(profile) {
  if (!profile) return null;
  if (profile.deleted) return Chat.DELETED_ACCOUNT_NAME || 'Удалённый аккаунт';
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return full || (profile.username ? '@' + profile.username : null);
}

/** Контрастный цвет текста для фона статуса (#rrggbb). */
export function readableStatusTextColor(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(color || ''));
  if (!match) return '#ffffff';
  const value = parseInt(match[1], 16);
  const luminance = (0.299 * ((value >> 16) & 255)
    + 0.587 * ((value >> 8) & 255)
    + 0.114 * (value & 255)) / 255;
  return luminance > 0.62 ? '#1b1b1b' : '#ffffff';
}

/** Пилюля статуса: эмодзи или текст на цветном фоне. */
export function buildStatusBadge(status) {
  if (!status) return null;
  const badge = createEl('span', `user-status user-status-${status.kind}`);
  badge.textContent = status.value;
  if (status.kind === 'text') {
    badge.style.background = status.color;
    badge.style.color = readableStatusTextColor(status.color);
  }
  badge.title = status.kind === 'text' ? `Статус: ${status.value}` : 'Статус';
  return badge;
}

/** Статус пользователя для показа (у удалённых аккаунтов статуса нет). */
export function userStatusFor(uid) {
  if (!uid) return null;
  if (Chat.getCachedUserProfile(uid)?.deleted) return null;
  return Chat.getCachedUserStatus(uid);
}

/** Статус канала или группы. */
export function chatStatusFor(chatId) {
  if (!chatId) return null;
  return Chat.getCachedChatStatus(chatId);
}

/**
 * Статус, который показывается рядом с названием чата:
 * у личных — собеседника, у каналов и групп — самого чата.
 */
export function chatItemStatus(chatId, chat) {
  if (!chat) return null;
  if (chat.type === 'private') return userStatusFor(getPrivatePeerUid(chat));
  if (chat.type === 'channel' || chat.type === 'group') return chatStatusFor(chatId);
  return null;
}

/** Дописать готовую пилюлю статуса к узлу. */
export function applyStatus(node, status) {
  if (!node || !status) return;
  const badge = buildStatusBadge(status);
  if (!badge) return;
  node.append(badge);
  Emoji.parse(badge);
}

/** Дописать статус пользователя справа от уже вставленного имени. */
export function applyUserStatus(node, uid) {
  applyStatus(node, userStatusFor(uid));
}

/** Дописать статус канала или группы справа от названия. */
export function applyChatStatus(node, chatId) {
  applyStatus(node, chatStatusFor(chatId));
}

/** Название со статусом для строк списков: обёртка, которая не ломает эллипсис. */
export function buildNameWithStatus(name, status, className = 'chat-item-title') {
  const wrap = createEl('span', 'name-with-status');
  wrap.append(createEl('span', className, name));
  applyStatus(wrap, status);
  return wrap;
}

/** Имя пользователя со статусом. */
export function buildUserNameWithStatus(name, uid, className = 'chat-item-title') {
  return buildNameWithStatus(name, userStatusFor(uid), className);
}

/** Дополнительные юзернеймы цели: [{ name, type, target, at, by }]. */
export function aliasesForTarget(type, target) {
  if (!type || !target) return [];
  return [...state.usernameAliases.entries()]
    .filter(([, record]) => record && record.type === type && record.target === target)
    .map(([name, record]) => ({ name, ...record }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** Показать строку «А также @a, @b» либо скрыть её. */
export function applyAliasHint(element, type, target) {
  if (!element) return;
  const aliases = aliasesForTarget(type, target);
  if (!aliases.length) {
    element.textContent = '';
    element.classList.add('hidden');
    return;
  }
  element.textContent = 'А также ' + aliases.map((alias) => '@' + alias.name).join(', ');
  element.classList.remove('hidden');
}


/**
 * Первая буква строки без разрыва суррогатных пар.
 * Эмодзи и прочие символы пропускаем, ищем именно букву/цифру.
 */
export function firstLetter(value, fallback = '?') {
  const char = [...String(value || '')].find((symbol) => /[0-9A-Za-zА-Яа-яЁё]/.test(symbol));
  return (char || fallback).toUpperCase();
}

/** Инициалы для аватарки (или первая буква юзернейма). */
export function getProfileInitials(profile) {
  const first = (profile?.firstName || '').trim();
  const last = (profile?.lastName || '').trim();
  if (first || last) return (firstLetter(first, '') + firstLetter(last, ''));
  if (profile?.username) return firstLetter(profile.username);
  return '?';
}

/** Имя отправителя из кэша профилей. */
export function getSenderName(uid) {
  const profile = Chat.getCachedUserProfile(uid);
  if (profile === undefined) return '…'; // профиль ещё загружается
  return getProfileName(profile) || 'Пользователь';
}

/** Отрисовать аватар в существующем узле. */
export function applyAvatar(node, seed, label) {
  node.style.background = avatarColor(seed);
  node.textContent = String(label || '?');
}

/* ============================================================
 *  Представление чата: заголовок, аватар, статус
 * ============================================================ */

/**
 * Аватарка профиля: кастомная (буква/эмодзи на цвете или градиенте)
 * либо стандартные инициалы на сгенерированном цвете.
 */
export function applyProfileAvatar(node, profile, seed, fallbackLabel = undefined) {
  const avatar = profile?.avatar;
  if (avatar && avatar.value && avatar.bg1) {
    node.style.background = avatar.bgType === 'gradient'
      ? `linear-gradient(135deg, ${avatar.bg1}, ${avatar.bg2 || avatar.bg1})`
      : avatar.bg1;

    // Глиф в отдельном span: размер задаётся в em от базового кегля аватара.
    const glyph = createEl('span', 'avatar-glyph');
    if (avatar.kind === 'emoji') glyph.classList.add('avatar-emoji');
    const scale = Math.min(200, Math.max(50, Number(avatar.size) || 100)) / 100;
    glyph.style.fontSize = `${(avatar.kind === 'emoji' ? 1.4 : 1) * scale}em`;
    glyph.textContent = avatar.value;

    node.textContent = '';
    node.classList.remove('avatar-emoji');
    node.append(glyph);
    return;
  }
  node.classList.remove('avatar-emoji');
  applyAvatar(node, seed, fallbackLabel === undefined ? getProfileInitials(profile) : fallbackLabel);
}

/** Аватарка чата: личный — профиль собеседника, группа/канал — лого или буква названия. */
export function applyChatAvatar(node, chatId, chat) {
  if (chat?.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    const profile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
    applyProfileAvatar(node, profile, peerUid || chatId);
    return;
  }
  // «Избранное» — закладка вместо буквы «?».
  if (chat?.type === 'saved') {
    node.classList.remove('avatar-emoji');
    node.style.background = avatarColor(chatId);
    node.textContent = '';
    const glyph = createEl('span', 'avatar-glyph avatar-saved');
    glyph.innerHTML = CHAT_TYPE_ICONS.saved;
    node.append(glyph);
    return;
  }
  const fallback = (chat?.title || '?').trim().charAt(0).toUpperCase();
  if (chat?.avatar && chat.avatar.value && chat.avatar.bg1) {
    applyProfileAvatar(node, { avatar: chat.avatar }, chatId, fallback);
    return;
  }
  node.classList.remove('avatar-emoji');
  applyAvatar(node, chatId, fallback);
}

/** SVG-иконки типов чата. */
export const CHAT_TYPE_ICONS = {
  private:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  group:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  channel:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  saved:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
};

/** Векторные иконки интерфейса (24×24, штрих — currentColor). */
const ICONS = {
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6.5 9.5 17 4 11.5"/></svg>',
  checks:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="17.5 6.5 8 16 3 11"/><polyline points="21 9.5 14.5 16"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-.5 5.2 2.2 3.3a1 1 0 0 1-.83 1.55H7.13a1 1 0 0 1-.83-1.55l2.2-3.3z"/><path d="M12 14v7"/></svg>',
  archive:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v11h16V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg>',
  folder:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  eye:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  comment:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
  forward:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>',
  reply:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
  edit:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  copy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  select:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a1 1 0 0 1 1-1h2"/><path d="M17 4h2a1 1 0 0 1 1 1v2"/><path d="M20 17v2a1 1 0 0 1-1 1h-2"/><path d="M7 20H5a1 1 0 0 1-1-1v-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  chart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="9"/></svg>',
  ban:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>',
  bell:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  bellOff:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-9.33-5"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8c0 1.4-.1 2.7-.28 3.9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="3" y1="3" x2="21" y2="21"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
  key:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  google:
    '<svg viewBox="0 0 48 48" fill="none"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>',
  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  back:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  device:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>',
};

/** Собрать span с SVG-иконкой из набора ICONS. */
export function createIcon(name, className = '') {
  const span = createEl('span', className ? `svg-icon ${className}` : 'svg-icon');
  span.innerHTML = ICONS[name] || '';
  return span;
}

/** Включены ли у меня админ-права: супер-админ + переключатель в настройках. */
export function adminRightsOn() {
  const uid = state.user?.uid;
  return Boolean(uid && state.rootAdmins.has(uid) && state.settings?.adminMode !== false);
}

/** Для личного чата — uid собеседника (все uid, кроме моего). */
export function getPrivatePeerUid(chat) {
  if (!chat || chat.type !== 'private') return null;
  return Object.keys(chat.users || {}).find((uid) => uid !== state.user?.uid) || null;
}

/** Заголовок чата: для private — имя собеседника из /users. */
export function getChatTitle(chat) {
  if (!chat) return 'Загрузка…';
  if (chat.type === 'saved') return 'Избранное';
  if (chat.type === 'private') {
    const peerUid = getPrivatePeerUid(chat);
    const profile = peerUid ? Chat.getCachedUserProfile(peerUid) : null;
    return getProfileName(profile) || 'Личный чат';
  }
  return chat.title || 'Без названия';
}

/** Живые отметки «печатает…» (не старше TTL), кроме моей. */
export function activeTypers() {
  const now = Date.now() / 1000;
  return [...state.typingMap.entries()]
    .filter(([uid, info]) => uid !== state.user?.uid && info && (now - Number(info.ts || 0)) < 7)
    .map(([uid, info]) => ({
      uid,
      // Имя берём из живого профиля, а запись typing — запасной вариант.
      name: getProfileName(Chat.getCachedUserProfile(uid)) || info.name || 'Пользователь',
    }));
}

/**
 * Присутствие собеседника для шапки и меню личного чата.
 * @returns {{ text: string, className: string }|null}
 */
export function getPeerPresenceInfo(chat) {
  const peerUid = chat?.type === 'private' ? getPrivatePeerUid(chat) : null;
  if (!peerUid) return null;

  const profile = Chat.getCachedUserProfile(peerUid);
  const handle = profile?.username ? '@' + profile.username : 'Личный чат';

  if (activeTypers().some((typer) => typer.uid === peerUid)) {
    return { text: 'печатает…', className: 'status-typing' };
  }

  const presence = state.presence.get(peerUid) || null;
  if (presence?.online) return { text: 'в сети', className: 'status-online' };
  if ((state.peerSettings?.lastSeenPrivacy || 'all') === 'nobody') {
    return { text: handle, className: '' };
  }
  if (presence?.lastSeen) {
    return { text: 'был(а) ' + formatLastSeen(presence.lastSeen), className: '' };
  }
  return { text: handle, className: '' };
}

/** Статус в шапке чата: тип + @юзернейм / участники / «печатает…» / «в сети». */
export function getChatStatus(chat) {
  if (!chat) return '';
  if (chat.type === 'channel') {
    const count = Number(chat.subscribersCount) || 0;
    const handle = chat.username ? `@${chat.username} · ` : '';
    return `Канал · ${handle}${count} ${plural(count, ['подписчик', 'подписчика', 'подписчиков'])}`;
  }
  if (chat.type === 'group') {
    const typers = activeTypers();
    if (typers.length === 1) return `${typers[0].name} печатает…`;
    if (typers.length > 1) return `Печатают: ${typers.length}`;
    const count = Object.keys(chat.users || {}).length;
    return `Группа · ${count} ${plural(count, ['участник', 'участника', 'участников'])}`;
  }
  if (chat.type === 'saved') return 'Заметки и закладки';

  const info = getPeerPresenceInfo(chat);
  return info ? info.text : 'Личный чат';
}

/** Текст превью последнего сообщения для списка чатов. */
export function getChatPreview(chat) {
  const last = chat?.lastMessage;
  if (!last || !last.text) return 'Нет сообщений';
  if (chat.type === 'private' || chat.type === 'saved') return last.text;
  const who = last.sender === state.user?.uid ? 'Вы' : getSenderName(last.sender);
  return `${who}: ${last.text}`;
}

/** Имя текущего пользователя для сайдбара. */
export function getOwnDisplayName() {
  return getProfileName(state.profile) || state.profile?.email || 'Пользователь';
}

/** Обновить аватар и имя текущего пользователя в сайдбаре. */
export function updateSidebarUser() {
  dom.currentUserName.textContent = '';
  dom.currentUserName.append(createEl('span', 'current-user-name', getOwnDisplayName()));
  applyUserStatus(dom.currentUserName, state.user?.uid);
  applyProfileAvatar(dom.sidebarAvatar, state.profile, state.user?.uid || 'me');
}

/* ============================================================
 *  Догрузка профилей (имена отправителей, собеседников)
 * ============================================================ */

/** Видимые в интерфейсе поля профиля — по ним ловим изменения. */
function profileSnapshotKey(profile) {
  if (!profile) return '';
  return JSON.stringify([
    profile.username || '',
    profile.firstName || '',
    profile.lastName || '',
    profile.bio || '',
    profile.deleted === true,
    profile.avatar || null,
  ]);
}

/** Подписаться на живые профили, которых ещё нет в реестре подписок. */
export function watchUserProfiles(uids) {
  if (!state.user) return;
  for (const uid of new Set(uids)) {
    if (!uid || state.subscriptions.userProfiles.has(uid)) continue;

    let previousKey = profileSnapshotKey(Chat.getCachedUserProfile(uid));
    const unsubscribe = Chat.subscribeToUserProfile(uid, (profile) => {
      const nextKey = profileSnapshotKey(profile);
      if (nextKey === previousKey) return;
      previousKey = nextKey;

      if (uid === state.user?.uid) {
        state.profile = profile;
        updateSidebarUser();
      }
      scheduleProfileRefresh();
    });
    state.subscriptions.userProfiles.set(uid, unsubscribe);
  }
}

/** Перерисовать всё, где показываются имена, био и аватарки пользователей. */
function refreshProfileViews() {
  if (!state.user || dom.messengerScreen.classList.contains('hidden')) return;

  renderChatList();
  if (state.search.query) renderSearchResults();
  if (state.activeChatId || state.channelPreview) renderMainPanel();
  if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
  if (!dom.archiveOverlay.classList.contains('hidden')) renderArchiveList();
  if (!dom.blockedOverlay.classList.contains('hidden')) renderBlockedList();
  if (!dom.forwardOverlay.classList.contains('hidden') && state.forwardMessage) {
    openForwardModal(state.forwardMessage);
  }

  if (settingsChatId && !dom.settingsOverlay.classList.contains('hidden')) {
    const chat = state.chats.get(settingsChatId);
    if (chat?.type === 'group') renderSettingsMembers(chat);
    if (chat?.type === 'channel') renderSettingsAdmins(chat);
  }

  // Комментарии: сохраняем позицию прокрутки, чтобы чтение не сбивалось.
  if (!dom.commentsOverlay.classList.contains('hidden') && state.commentsPost) {
    const scrollTop = dom.commentsList.scrollTop;
    renderComments(state.chatComments);
    dom.commentsList.scrollTop = scrollTop;
  }

  if (state.composerMode?.type === 'reply') {
    dom.composerContextTitle.textContent = `Ответ ${getSenderName(state.composerMode.message.sender)}`;
  }
}

/** Отложенная перерисовка: несколько изменений подряд схлопываются в одну. */
export function scheduleProfileRefresh() {
  if (profileRefreshPending) return;
  profileRefreshPending = true;
  profileRefreshTimer = window.setTimeout(() => {
    profileRefreshTimer = null;
    profileRefreshPending = false;
    refreshProfileViews();
  }, 120);
}

/** Снять живые подписки на профили (выход из аккаунта). */
export function stopProfileWatch() {
  clearTimeout(profileRefreshTimer);
  profileRefreshTimer = null;
  profileRefreshPending = false;
  for (const unsubscribe of state.subscriptions.userProfiles.values()) unsubscribe();
  state.subscriptions.userProfiles.clear();
}

/**
 * Загрузить отсутствующие профили, подписаться на изменения и перерисовать UI.
 * Профили кэшируются в services/chat.js, поэтому повторных
 * запросов и циклов перерисовки не возникает.
 */
export async function hydrateUsers(uids) {
  if (!state.user) return;
  const unique = [...new Set(uids)].filter(Boolean);
  if (!unique.length) return;

  // Показанные профили держим живыми: имя, био и аватарка обновляются сразу.
  watchUserProfiles(unique);

  const missing = unique.filter((uid) => Chat.getCachedUserProfile(uid) === undefined);
  if (!missing.length) return;

  await Promise.allSettled(missing.map((uid) => Chat.getUserProfile(uid)));
  if (!state.user) return; // пользователь успел выйти, пока грузили

  // Живые подписки на профили уже прислали новые данные и запросили
  // отложенную перерисовку. Второй полный рендер здесь не нужен: раньше он
  // дублировал список чатов и ленту сообщений на каждую догрузку профилей.
  scheduleProfileRefresh();
}

