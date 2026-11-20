import * as Chat from '../services/chat.js?v=77';
import { EMPTY_CHAT_META, getChatMeta, scheduleChatListRender } from './chat-list.js?v=77';
import { selectChat } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { renderPrefsModal } from './prefs.js?v=77';
import { getChatTitle, getSenderName, hydrateUsers } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { formatTime, toast } from './utils.js?v=77';

/**
 * Уведомления в браузере: разрешение, звук, мьют и тестовое уведомление
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let notifyStartedAt = 0;            // unix-секунды, с которых шлём уведомления о новых сообщениях
const notifiedChatTs = new Map(); // chatId -> время последнего уведомлённого сообщения
let notifyAudioContext = null;      // AudioContext для звука уведомлений (создаётся по требованию)
let muteRefreshTimer = 0;           // таймер снятия иконки мьюта, когда истечёт срок
const shownNotifications = new Map(); // ключ -> Notification, чтобы новые уведомления не пропадали

/* ============================================================
 *  Уведомления в браузере: только пока вкладка Beacon открыта
 * ============================================================ */

const NOTIFY_ASK_STORAGE_KEY = 'beacon.notifyAskedAt';
const NOTIFY_ASK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // спрашиваем не чаще раза в неделю
export const NOTIFY_MUTE_OPTIONS = [
  { label: 'На 1 час', seconds: 60 * 60 },
  { label: 'На 8 часов', seconds: 8 * 60 * 60 },
  { label: 'На 1 день', seconds: 24 * 60 * 60 },
  { label: 'На 3 дня', seconds: 3 * 24 * 60 * 60 },
];

/** Поддерживает ли браузер системные уведомления. */
export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Мои настройки уведомлений: значения по умолчанию плюс сохранённые. */
export function myNotificationSettings() {
  return { ...Chat.DEFAULT_NOTIFICATION_SETTINGS, ...(state.settings?.notifications || {}) };
}

/** Состояние мьюта чата: null — уведомления включены. */
export function chatMuteInfo(meta = EMPTY_CHAT_META) {
  if (!meta) return null;
  if (meta.muted === true) return { forever: true, until: 0 };
  const until = Number(meta.mutedUntil) || 0;
  return until > Date.now() / 1000 ? { forever: false, until } : null;
}

/** Заглушены ли уведомления чата (бессрочно или до срока). */
export function isChatMuted(chatId) {
  return Boolean(chatMuteInfo(getChatMeta(chatId)));
}

/** «сегодня в 18:30», «завтра в 09:00» или «05.12 в 21:00». */
function formatMuteMoment(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return `сегодня в ${formatTime(unixSeconds)}`;
  if (sameDay(date, tomorrow)) return `завтра в ${formatTime(unixSeconds)}`;
  const day = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  return `${day} в ${formatTime(unixSeconds)}`;
}

/** Подпись срока мьюта для меню чата. */
export function chatMuteLabel(info) {
  if (!info) return '';
  return info.forever ? 'Выключены навсегда' : `Выключены до ${formatMuteMoment(info.until)}`;
}

/** Перерисовать список чатов, когда истечёт ближайший временный мьют. */
export function scheduleMuteRefresh() {
  if (muteRefreshTimer) window.clearTimeout(muteRefreshTimer);
  muteRefreshTimer = 0;

  const now = Date.now();
  let soonest = 0;
  for (const meta of state.chatMeta.values()) {
    const info = chatMuteInfo(meta);
    if (!info || info.forever) continue;
    const at = info.until * 1000;
    if (at > now && (!soonest || at < soonest)) soonest = at;
  }
  if (!soonest) return;

  // Запас в секунду, чтобы к моменту перерисовки срок уже считался истёкшим.
  muteRefreshTimer = window.setTimeout(() => {
    muteRefreshTimer = 0;
    scheduleChatListRender();
    scheduleMuteRefresh();
  }, Math.min(soonest - now + 1000, 2147483647));
}

/** Короткий сигнал о новом сообщении: WebAudio вместо файлов и CDN. */
function playNotificationSound() {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!notifyAudioContext) notifyAudioContext = new AudioCtor();
    const ctx = notifyAudioContext;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const start = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, start);
    osc.frequency.exponentialRampToValueAtTime(660, start + 0.2);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + 0.28);
  } catch (error) {
    // Звук необязателен: уведомление покажется и без него.
  }
}

/**
 * Спросить разрешение на системные уведомления.
 * silent — без всплывашек (запрос при входе не должен мешать).
 * @returns {Promise<string>} 'granted' | 'denied' | 'default' | 'unsupported'
 */
export async function requestNotificationPermission(silent = false) {
  if (!notificationsSupported()) {
    if (!silent) toast('Браузер не поддерживает уведомления', 'error');
    return 'unsupported';
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      console.error('Не удалось запросить разрешение на уведомления:', error);
      permission = Notification.permission;
    }
  }

  renderNotificationSettings();
  if (!silent) {
    if (permission === 'granted') toast('Уведомления разрешены', 'success');
    else if (permission === 'denied') toast('Браузер запретил уведомления для Beacon', 'error');
  }
  return permission;
}

/** Спросить разрешение после входа, если браузер ещё не спрашивал. */
export function askNotificationPermissionAfterLogin() {
  if (!notificationsSupported() || !state.user) return;
  if (myNotificationSettings().enabled === false) return;
  if (Notification.permission !== 'default') return;

  let askedAt = 0;
  try {
    askedAt = Number(localStorage.getItem(NOTIFY_ASK_STORAGE_KEY)) || 0;
  } catch (error) {
    askedAt = 0; // приватный режим: localStorage может быть недоступен
  }
  if (askedAt && Date.now() - askedAt < NOTIFY_ASK_INTERVAL) return;
  try {
    localStorage.setItem(NOTIFY_ASK_STORAGE_KEY, String(Date.now()));
  } catch (error) {
    // не критично: спросим ещё раз в следующий раз
  }

  // Даём интерфейсу дорисоваться, чтобы запрос не спорил с загрузкой чатов.
  window.setTimeout(() => {
    if (!state.user || Notification.permission !== 'default') return;
    requestNotificationPermission(true);
  }, 1600);
}

/** Заголовок и текст уведомления с учётом «скрывать текст». */
function notificationContent(chat, settings) {
  if (settings.preview === false) {
    return { title: 'Beacon', body: 'Новое сообщение' };
  }
  const title = getChatTitle(chat);
  const raw = String(chat.lastMessage?.text || '').replace(/\s+/g, ' ').trim();
  const text = raw.length > 160 ? `${raw.slice(0, 159)}…` : raw;

  if (chat.type === 'channel') return { title, body: text || 'Новый пост' };
  if (chat.type === 'group') {
    const sender = getSenderName(chat.lastMessage?.sender);
    return { title, body: text ? `${sender}: ${text}` : sender };
  }
  return { title, body: text || 'Новое сообщение' };
}

/**
 * Показать системное уведомление.
 * У каждого сообщения свой tag: с общим tag на чат браузер молча заменяет
 * висящее уведомление, и новые не всплывают, пока старое не закрыто.
 * Прошлое уведомление того же ключа закрываем сами, чтобы они не копились.
 */
function showBrowserNotification(key, { title, body, tag, onClick = null }) {
  const previous = shownNotifications.get(key);
  if (previous) {
    shownNotifications.delete(key);
    try {
      previous.close();
    } catch (error) {
      // уже закрыто пользователем — не мешает
    }
  }

  const notification = new Notification(title, {
    body,
    tag,
    icon: './icon.png',
    badge: './icon.png',
    silent: true, // сигнал играем сами, чтобы не дублировать
  });

  shownNotifications.set(key, notification);
  notification.onclose = () => {
    if (shownNotifications.get(key) === notification) shownNotifications.delete(key);
  };
  notification.onclick = () => {
    if (onClick) onClick();
    notification.close();
  };
  return notification;
}

/**
 * Уведомление о последнем сообщении чата. Один раз на сообщение: подписка
 * на чат приходит и на реакции, и на правки превью.
 */
export function maybeNotifyChat(chatId, chat) {
  const last = chat?.lastMessage;
  if (!state.user || !last?.timestamp) return;
  if (dom.messengerScreen.classList.contains('hidden')) return; // ещё онбординг или экран входа
  if (last.sender === state.user.uid) return;

  const timestamp = Number(last.timestamp) || 0;
  if (!notifyStartedAt || timestamp < notifyStartedAt) return;

  // Один раз на сообщение и без повторов на правки текста превью.
  const previousTs = Number(notifiedChatTs.get(chatId)) || 0;
  if (timestamp <= previousTs) return;
  notifiedChatTs.set(chatId, timestamp);

  const settings = myNotificationSettings();
  if (settings.enabled === false) return;

  const type = chat.type === 'group' || chat.type === 'channel' ? chat.type : 'private';
  if (settings[type] === false) return;
  if (isChatMuted(chatId)) return;
  if (state.blocked.has(last.sender)) return;

  // Открытый и сфокусированный чат читается сразу — дубль не нужен.
  const focused = document.visibilityState === 'visible' && document.hasFocus();
  if (focused && (chatId === state.activeChatId || chatId === state.channelPreview?.chatId)) return;

  // Имя отправителя могло ещё не загрузиться — догружаем для следующих раз.
  hydrateUsers([last.sender]).catch(() => {});

  if (settings.sound !== false) playNotificationSound();

  if (!notificationsSupported() || Notification.permission !== 'granted') return;

  const content = notificationContent(chat, settings);
  try {
    showBrowserNotification(`chat:${chatId}`, {
      title: content.title,
      body: content.body,
      tag: `beacon-chat-${chatId}-${timestamp}`,
      onClick: () => {
        window.focus();
        selectChat(chatId);
      },
    });
  } catch (error) {
    console.error('Не удалось показать уведомление:', error);
  }
}

/** Заглушить чат: null — включить, 'forever' — навсегда, число — секунды. */
export async function applyChatMute(chatId, choice = null) {
  if (!state.user || !chatId) return;
  const until = typeof choice === 'number' ? Math.floor(Date.now() / 1000) + choice : 0;
  const payload = choice === 'forever' ? { forever: true } : choice ? { until } : {};

  try {
    await Chat.setChatMuted(state.user.uid, chatId, payload);
    scheduleMuteRefresh();
    if (choice === 'forever') toast('Уведомления чата выключены навсегда');
    else if (typeof choice === 'number') {
      const label = NOTIFY_MUTE_OPTIONS.find((option) => option.seconds === choice)?.label || '';
      toast(`Уведомления выключены ${label.toLowerCase()}`.trim());
    } else {
      toast('Уведомления чата включены');
    }
  } catch (error) {
    console.error(error);
    toast('Не удалось изменить уведомления чата', 'error');
  }
}

/** Сохранить настройку уведомлений: локально сразу, в базу — следом. */
export async function saveNotificationSetting(key, enabled) {
  if (!state.user) return;
  if (!state.settings.notifications) state.settings.notifications = {};
  state.settings.notifications[key] = enabled;
  renderPrefsModal();
  try {
    await Chat.setNotificationSetting(state.user.uid, key, enabled);
  } catch (error) {
    console.error(error);
    toast('Не удалось сохранить настройку уведомлений', 'error');
  }
}

/** Синхронизировать окно «Уведомления» с настройками и разрешением браузера. */
export function renderNotificationSettings() {
  if (!dom.notifEnabledToggle) return;
  const settings = myNotificationSettings();
  const enabled = settings.enabled !== false;

  dom.notifEnabledToggle.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn.dataset.notifEnabled === 'on') === enabled);
  });
  dom.notifSound.checked = settings.sound !== false;
  dom.notifPreview.checked = settings.preview !== false;
  dom.notifPrivate.checked = settings.private !== false;
  dom.notifGroup.checked = settings.group !== false;
  dom.notifChannel.checked = settings.channel !== false;

  const supported = notificationsSupported();
  const permission = supported ? Notification.permission : 'unsupported';
  [dom.notifSound, dom.notifPreview, dom.notifPrivate, dom.notifGroup, dom.notifChannel, dom.notifTestBtn]
    .forEach((control) => {
      control.disabled = !enabled || !supported;
    });

  // Кнопка запроса — только когда браузер ещё не спросил и всё включено.
  dom.notifPermissionBtn.classList.toggle('hidden', !supported || !enabled || permission !== 'default');

  let hint = '';
  if (!supported) {
    hint = 'Этот браузер не поддерживает системные уведомления.';
  } else if (!enabled) {
    hint = 'Уведомления выключены: новые сообщения видны только в списке чатов.';
  } else if (permission === 'denied') {
    hint = 'Браузер запрещает уведомления для Beacon. Разрешите их в настройках сайта — рядом с адресом страницы.';
  } else if (permission === 'default') {
    hint = 'Браузер ещё не спрашивал разрешение. Нажмите кнопку ниже — без него уведомления не появятся.';
  } else {
    hint = 'Разрешение выдано. Уведомления приходят, пока вкладка Beacon открыта.';
  }
  dom.notifPermissionHint.textContent = hint;
}

/** Тестовое уведомление из настроек: проверка разрешения и звука. */
export async function sendTestNotification() {
  if (!state.user) return;
  if (!notificationsSupported()) {
    toast('Браузер не поддерживает уведомления', 'error');
    return;
  }
  if (Notification.permission !== 'granted') {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return;
  }

  if (myNotificationSettings().sound !== false) playNotificationSound();
  try {
    showBrowserNotification('test', {
      title: 'Beacon',
      body: 'Так выглядит уведомление о новом сообщении.',
      tag: `beacon-test-${Date.now()}`,
      onClick: () => window.focus(),
    });
  } catch (error) {
    console.error(error);
    toast('Не удалось показать уведомление', 'error');
  }
}

/** Начать окно уведомлений: история до входа не должна всплывать. */
export function startNotificationWindow() {
  notifyStartedAt = Date.now() / 1000;
  notifiedChatTs.clear();
}

/** Закрыть показанные уведомления и сбросить таймеры (при выходе). */
export function resetNotifications() {
  notifyStartedAt = 0;
  notifiedChatTs.clear();
  for (const notification of shownNotifications.values()) {
    try {
      notification.close();
    } catch (error) {
      // уже закрыто пользователем — не мешает
    }
  }
  shownNotifications.clear();
  if (muteRefreshTimer) window.clearTimeout(muteRefreshTimer);
  muteRefreshTimer = 0;
}

