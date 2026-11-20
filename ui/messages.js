import * as Chat from '../services/chat.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { buildUnreadDivider, renderPinBar, selectChat } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { openCommentsModal } from './extras.js?v=77';
import { openMsgMenu, openReactionPicker, toggleReaction } from './message-menu.js?v=77';
import { applyUserStatus, createIcon, getSenderName, hydrateUsers } from './profile-view.js?v=77';
import { openDeepLinkUsername, openGlobalSearch } from './search.js?v=77';
import { state } from './state.js?v=77';
import { createEl, formatDayLabel, formatTime, toast } from './utils.js?v=77';

/**
 * Лента сообщений: рендер, опросы, просмотры, комментарии
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let messagesObserver = null;        // IntersectionObserver просмотров постов
let messagesObserverChatId = null;  // чат, для которого создан этот наблюдатель
const viewsPending = new Map();     // msgId -> таймер «пост пробыл на виду»
let messagesRenderHandle = 0;       // запланированная перерисовка ленты (batch подписок голосов/просмотров)
let messagesRenderFallback = 0;     // таймер-страховка перерисовки ленты

/**
 * Подпись сообщения для ленты. Пока подпись не меняется, DOM-узел
 * переиспользуется: реакции, просмотры или чужое прочтение больше не
 * пересобирают всю историю чата.
 */
const messageBodySignatureCache = new WeakMap();

/**
 * Неизменяемая часть подписи сообщения (id, текст, реакции, ответ, опрос).
 * Кэш по объекту сообщения: голоса, просмотры и комментарии приходят чаще,
 * чем сами сообщения, а JSON.stringify по каждому сообщению на каждый рендер
 * был основной ценой перерисовки ленты.
 */
function messageBodySignature(message) {
  const cached = messageBodySignatureCache.get(message);
  if (cached !== undefined) return cached;
  const signature = [
    message.id,
    Number(message.timestamp) || 0,
    message.sender || '',
    message.text || '',
    message.editedAt || '',
    message.reactions ? JSON.stringify(message.reactions) : '',
    message.replyTo ? JSON.stringify(message.replyTo) : '',
    message.savedFrom ? JSON.stringify(message.savedFrom) : '',
    message.forwardedFrom ? JSON.stringify(message.forwardedFrom) : '',
    message.poll ? JSON.stringify(message.poll) : '',
  ].join('\u0001');
  messageBodySignatureCache.set(message, signature);
  return signature;
}

function messageRenderSignature(message, chat, showSender) {
  const senderStatus = showSender ? Chat.getCachedUserStatus(message.sender) : null;
  const parts = [
    messageBodySignature(message),
    showSender ? getSenderName(message.sender) : '',
    senderStatus ? JSON.stringify(senderStatus) : '',
    chat?.pinned?.[message.id] ? '1' : '0',
    message.replyTo ? getSenderName(message.replyTo.sender) : '',
  ];
  if (message.poll) {
    // У опроса от результата зависят проценты, а от членства — доступность кнопок.
    parts.push(JSON.stringify(state.pollVotes.get(message.id) || null));
    parts.push(Chat.canVoteInChat(chat, state.user?.uid, state.myChatIds.has(state.activeChatId)) ? '1' : '0');
  }
  if (chat?.type === 'private') {
    parts.push(Number(message.timestamp) <= state.peerReadTs ? 'read' : 'sent');
  }
  if (chat?.type === 'channel') {
    parts.push(String(Object.keys(state.chatViews.get(message.id) || {}).length));
    parts.push(String(Object.keys(state.chatComments.get(message.id) || {}).length));
  }
  return parts.join('\u0001');
}

/**
 * Ключ дня для разделителя дат. Кэш по объекту сообщения: новый Date
 * на каждое сообщение при каждом рендере стоил дороже самой отрисовки.
 */
const messageDayKeyCache = new WeakMap();
function messageDayKey(message) {
  const cached = messageDayKeyCache.get(message);
  if (cached !== undefined) return cached;
  const key = new Date(message.timestamp * 1000).toDateString();
  messageDayKeyCache.set(message, key);
  return key;
}

/** Привести узлы ленты к нужному порядку, лишние убрать из DOM. */
export function syncMessageList(container, ordered) {
  const wanted = new Set(ordered);
  for (let index = container.childNodes.length - 1; index >= 0; index -= 1) {
    const child = container.childNodes[index];
    if (!wanted.has(child)) child.remove();
  }

  let ref = container.firstChild;
  for (const el of ordered) {
    if (ref === el) {
      ref = el.nextSibling;
      continue;
    }
    container.insertBefore(el, ref);
  }
}

/** Перерисовать область сообщений активного чата. */
export function renderMessages() {
  const chat = state.chats.get(state.activeChatId) || null;
  const showSender = Boolean(chat) && (chat.type === 'group' || chat.type === 'channel');
  const container = dom.messages;
  const wasStick = state.stickToBottom;
  const prevScrollTop = container.scrollTop;
  const divider = state.unreadDivider && state.unreadDivider.chatId === state.activeChatId
    ? state.unreadDivider
    : null;

  // Узлы другого чата переиспользовать нельзя — это другая лента.
  if (state.messageNodesChatId !== state.activeChatId) {
    state.messageNodes = new Map();
    state.messageNodesChatId = state.activeChatId;
  }

  const previousNodes = state.messageNodes;
  const nextNodes = new Map();
  const ordered = [];
  const created = [];

  // Не показываем сообщения из чёрного списка и «удалённые у меня».
  const visible = state.messages.filter((message) => (
    !state.blocked.has(message.sender)
    && !state.localDeleted.has(`${state.activeChatId}/${message.id}`)
  ));

  /** Взять готовый узел по ключу либо собрать новый. */
  const pushNode = (key, signature, build) => {
    const previous = previousNodes.get(key);
    if (previous && previous.sig === signature) {
      nextNodes.set(key, previous);
      ordered.push(previous.el);
      return previous.el;
    }
    const el = build();
    nextNodes.set(key, { el, sig: signature });
    ordered.push(el);
    created.push(el);
    return el;
  };

  let dividerEl = null;

  if (!visible.length) {
    const text = state.messages.length
      ? 'Сообщения скрыты'
      : 'В этом чате пока нет сообщений';
    pushNode('empty', text, () => createEl('p', 'messages-empty', text));
  } else {
    let lastDay = null;

    for (const message of visible) {
      const dayKey = messageDayKey(message);
      if (dayKey !== lastDay) {
        lastDay = dayKey;
        const label = formatDayLabel(message.timestamp);
        pushNode(`d:${dayKey}`, label, () => createEl('div', 'message-day', label));
      }
      // Линия «Новые сообщения» — перед первым сообщением после моего прочтения.
      if (!dividerEl && divider && message.timestamp > divider.ts) {
        dividerEl = pushNode('u', String(divider.ts), buildUnreadDivider);
      }
      pushNode(
        `m:${message.id}`,
        messageRenderSignature(message, chat, showSender),
        () => buildMessageElement(message, showSender),
      );
    }
  }

  syncMessageList(container, ordered);
  state.messageNodes = nextNodes;

  // При входе в чат с непрочитанными — прокручиваем к разделителю, а не вниз.
  // Синхронно: rAF в фоновой вкладке может не сработать.
  if (state.dividerScrollPending) {
    state.dividerScrollPending = false;
    if (dividerEl) {
      const containerRect = container.getBoundingClientRect();
      const dividerRect = dividerEl.getBoundingClientRect();
      container.scrollTop += (dividerRect.top - containerRect.top) - 12;
    } else {
      container.scrollTop = container.scrollHeight;
    }
  } else if (wasStick) {
    // Автопрокрутка вниз при новых сообщениях, если пользователь у нижнего края.
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  } else {
    // Пользователь читает историю — сохраняем позицию скролла.
    container.scrollTop = prevScrollTop;
  }

  // Эмодзи разбираем только в новых узлах, а не во всей истории заново.
  for (const el of created) Emoji.parse(el);

  setupViewsObserver(chat, visible, created);
  renderPinBar();
  hydrateUsers(visible.map((message) => message.sender));
}

/**
 * Отложенная перерисовка ленты. Голоса опросов, комментарии и просмотры
 * приходят пачками (особенно при открытии канала) — склеиваем их в один
 * рендер, как это уже сделано для списка чатов.
 */
export function scheduleMessagesRender() {
  if (messagesRenderHandle || messagesRenderFallback) return;

  const run = () => {
    if (messagesRenderHandle) cancelAnimationFrame(messagesRenderHandle);
    messagesRenderHandle = 0;
    if (messagesRenderFallback) {
      window.clearTimeout(messagesRenderFallback);
      messagesRenderFallback = 0;
    }
    renderMessages();
  };

  messagesRenderHandle = requestAnimationFrame(run);
  // requestAnimationFrame не срабатывает в скрытом или перекрытом окне.
  messagesRenderFallback = window.setTimeout(run, 250);
}

/**
 * Просмотры постов канала: пост считается просмотренным,
 * если пробыл в зоне видимости ~700 мс (и это не моё сообщение).
 * Наблюдатель живёт, пока открыт канал: обновление счётчиков просмотров
 * не пересоздаёт его и не переподписывает всю ленту.
 */
function setupViewsObserver(chat, visible, created = []) {
  if (chat?.type !== 'channel') {
    messagesObserver?.disconnect();
    messagesObserver = null;
    messagesObserverChatId = null;
    viewsPending.clear();
    return;
  }

  const observePost = (message) => {
    if (message.sender === state.user?.uid) return; // свои посты в статистику не идут
    const node = state.messageNodes.get(`m:${message.id}`);
    if (node?.el) messagesObserver.observe(node.el);
  };

  if (!messagesObserver || messagesObserverChatId !== state.activeChatId) {
    messagesObserver?.disconnect();
    viewsPending.clear();
    messagesObserverChatId = state.activeChatId;
    // Наблюдатель живёт дольше одного рендера: запоминаем канал, чтобы
    // просмотр не улетел в чат, открытый уже после переключения.
    const observerChatId = messagesObserverChatId;
    messagesObserver = new IntersectionObserver((entries) => {
      if (state.activeChatId !== observerChatId) return;
      for (const entry of entries) {
        const msgId = entry.target.dataset.msgId;
        if (!msgId) continue;

        if (entry.isIntersecting) {
          if (viewsPending.has(msgId)) continue;
          viewsPending.set(msgId, window.setTimeout(() => {
            viewsPending.delete(msgId);
            recordMessageView(msgId, observerChatId);
          }, 700));
        } else {
          clearTimeout(viewsPending.get(msgId));
          viewsPending.delete(msgId);
        }
      }
    }, { threshold: 0.6 });

    for (const message of visible) observePost(message);
  } else {
    // Тот же канал: подписываем только новые посты.
    for (const el of created) {
      if (el.dataset?.msgId && !el.classList.contains('own')) messagesObserver.observe(el);
    }
  }

  // Страховка: если IntersectionObserver не доставил событие (фоновая вкладка,
  // ленивый рендер), учитываем только что добавленные посты в видимой зоне.
  if (!created.length) return;
  const fallbackChatId = state.activeChatId;
  const containerRect = dom.messages.getBoundingClientRect();
  for (const el of created) {
    const msgId = el.dataset?.msgId;
    if (!msgId || el.classList.contains('own') || viewsPending.has(msgId)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) continue;

    viewsPending.set(msgId, window.setTimeout(() => {
      viewsPending.delete(msgId);
      if (state.activeChatId !== fallbackChatId) return; // чат уже переключили
      const nowEl = findMessageElement(msgId);
      if (!nowEl) return;
      const nowRect = nowEl.getBoundingClientRect();
      const nowContainer = dom.messages.getBoundingClientRect();
      // Пост всё ещё в ленте на виду — засчитываем просмотр.
      if (nowRect.bottom > nowContainer.top && nowRect.top < nowContainer.bottom) {
        recordMessageView(msgId, fallbackChatId);
      }
    }, 700));
  }
}

/** Учесть уникальный просмотр поста (один раз за сессию). */
function recordMessageView(msgId, chatId = state.activeChatId) {
  // Просмотр засчитываем только для открытого сейчас канала: таймер мог
  // сработать уже после переключения ленты.
  if (!chatId || chatId !== state.activeChatId || !state.user) return;
  const key = `${chatId}/${msgId}`;
  if (state.viewedMessages.has(key)) return;
  state.viewedMessages.add(key);
  Chat.recordView(chatId, msgId, state.user.uid).catch(() => {});
}

/** Найти DOM-элемент сообщения в ленте по id. */
function findMessageElement(msgId) {
  const node = state.messageNodes.get(`m:${msgId}`);
  if (node?.el) return node.el;
  return dom.messages.querySelector(`[data-msg-id="${CSS.escape(String(msgId))}"]`);
}

/** Прокрутить к сообщению и подсветить его. false — сообщение не загружено. */
export function flashMessage(msgId) {
  const el = findMessageElement(msgId);
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('flash');
  void el.offsetWidth; // перезапуск анимации
  el.classList.add('flash');
  window.setTimeout(() => el.classList.remove('flash'), 1200);
  return true;
}

/** Регулярка ссылок, @упоминаний и #хэштегов в тексте сообщения. */
const MESSAGE_LINK_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+|[@#][A-Za-z0-9_А-Яа-яЁё]{2,32})/gi;

/** Убрать хвостовую пунктуацию, которая обычно не относится к ссылке. */
function trimTrailingUrlPunctuation(url) {
  let result = String(url || '').replace(/[.,;:!?…»"']+$/, '');
  // Закрывающая скобка остаётся, только если в ссылке есть открывающая.
  for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
    while (result.endsWith(close) && result.split(close).length > result.split(open).length) {
      result = result.slice(0, -1);
    }
  }
  return result;
}

/** Текст сообщения с кликабельными ссылками, упоминаниями и хэштегами. */
export function buildMessageText(text) {
  const span = createEl('span', 'bubble-text');
  for (const part of String(text || '').split(MESSAGE_LINK_REGEX)) {
    if (!part) continue;
    if (/^(?:https?:\/\/|www\.)/i.test(part)) {
      const clean = trimTrailingUrlPunctuation(part);
      const suffix = part.slice(clean.length);
      if (clean) {
        const link = createEl('a', 'msg-link msg-url', clean);
        link.href = /^www\./i.test(clean) ? 'https://' + clean : clean;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        span.append(link);
      }
      if (suffix) span.append(document.createTextNode(suffix));
    } else if (/^[@#][A-Za-z0-9_А-Яа-яЁё]{2,32}$/.test(part)) {
      const link = createEl('button', 'msg-link', part);
      link.type = 'button';
      link.addEventListener('click', (event) => {
        event.stopPropagation();
        openMentionOrHashtag(part);
      });
      span.append(link);
    } else {
      span.append(document.createTextNode(part));
    }
  }
  return span;
}

/** Клик по @упоминанию / #хэштегу: сразу открыть адресата, а не поиск. */
async function openMentionOrHashtag(token) {
  const value = String(token || '').trim();
  // Хэштеги ищутся как обычный запрос, а @упоминание ведёт прямо к человеку,
  // каналу или группе — поиск остаётся запасным путём, если адресат не найден.
  if (!value.startsWith('@')) {
    openGlobalSearch(value);
    return;
  }
  await openDeepLinkUsername(value);
}

/** Блок опроса внутри сообщения: живые результаты и голосование. */
function buildPollBlock(message) {
  const poll = message.poll || {};
  const options = Array.isArray(poll.options) ? poll.options : [];
  const votes = state.pollVotes.get(message.id) || {};

  const voteCounts = {};
  for (const option of options) voteCounts[option.id] = 0;

  let voterCount = 0;
  for (const userVotes of Object.values(votes)) {
    let votedAny = false;
    for (const optionId of Object.keys(userVotes || {})) {
      if (optionId in voteCounts) {
        voteCounts[optionId] += 1;
        votedAny = true;
      }
    }
    if (votedAny) voterCount += 1;
  }

  const myVotes = votes[state.user?.uid] || {};
  const chat = state.chats.get(state.activeChatId) || null;
  const canVote = Chat.canVoteInChat(chat, state.user?.uid, state.myChatIds.has(state.activeChatId));

  const block = createEl('div', 'bubble-poll');
  block.append(createEl('div', 'bubble-poll-question', poll.question || 'Опрос'));
  if (poll.multiple) block.append(createEl('div', 'bubble-poll-hint', 'Можно выбрать несколько ответов'));

  for (const option of options) {
    const count = voteCounts[option.id] || 0;
    const percent = voterCount ? Math.round((count / voterCount) * 100) : 0;
    const mine = Boolean(myVotes[option.id]);

    const btn = createEl('button', `bubble-poll-option${mine ? ' mine' : ''}`);
    btn.type = 'button';
    btn.disabled = !canVote;
    btn.title = canVote ? (mine ? 'Убрать голос' : 'Голосовать') : 'Голосовать могут только участники и подписчики';

    const fill = createEl('span', 'bubble-poll-fill');
    fill.style.width = `${percent}%`;
    btn.append(fill);
    btn.append(createEl('span', 'bubble-poll-label', option.text || '…'));
    btn.append(createEl('span', 'bubble-poll-count', `${count} · ${percent}%`));
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      handlePollVote(message, option.id);
    });
    block.append(btn);
  }

  block.append(createEl('div', 'bubble-poll-footer', `Всего голосов: ${voterCount}`));
  return block;
}

/** Проголосовать или отозвать голос в опросе. */
async function handlePollVote(message, optionId) {
  if (!state.activeChatId || !state.user) return;
  const multiple = Boolean(message.poll?.multiple);
  try {
    await Chat.votePoll(state.activeChatId, message.id, state.user.uid, optionId, multiple);
  } catch (error) {
    console.error(error);
    toast('Не удалось проголосовать', 'error');
  }
}

/** Перейти к исходному сообщению закладки из «Избранного». */
function openSavedSource(savedFrom) {
  if (!savedFrom?.chatId) return;
  if (!state.myChatIds.has(savedFrom.chatId)) {
    toast('Исходный чат больше недоступен');
    return;
  }
  selectChat(savedFrom.chatId);
  window.setTimeout(() => {
    if (state.activeChatId === savedFrom.chatId && !flashMessage(savedFrom.msgId)) {
      toast('Исходное сообщение не подгружено в историю');
    }
  }, 450);
}

/** Собрать DOM одного сообщения. */
function buildMessageElement(message, showSender) {
  const own = message.sender === state.user?.uid;
  const chat = state.chats.get(state.activeChatId) || null;
  const wrap = createEl('div', `message ${own ? 'own' : 'other'}`);
  wrap.dataset.msgId = message.id;
  wrap.tabIndex = 0; // ТВ-пульт и клавиатура: Enter открывает меню

  if (showSender) {
    const sender = createEl('div', 'message-sender');
    sender.append(createEl('span', 'message-sender-name', own ? 'Вы' : getSenderName(message.sender)));
    applyUserStatus(sender, message.sender);
    wrap.append(sender);
  }

  const bubble = createEl('div', 'bubble');

  // Пересланное сообщение.
  if (message.forwardedFrom) {
    const fwd = createEl('div', 'bubble-forward');
    fwd.append(createIcon('forward', 'bubble-forward-icon'));
    fwd.append(createEl('span', '', `Пересланное от ${message.forwardedFrom.name || 'пользователя'}`));
    bubble.append(fwd);
  }

  // Закладка из «Избранного»: цитата исходного сообщения с переходом.
  if (message.savedFrom) {
    const quote = createEl('button', 'bubble-reply bubble-saved');
    quote.type = 'button';
    quote.append(createEl('span', 'bubble-reply-name', message.savedFrom.chatTitle || 'Избранное'));
    quote.append(createEl('span', 'bubble-reply-text', message.savedFrom.text || ''));
    quote.addEventListener('click', () => openSavedSource(message.savedFrom));
    bubble.append(quote);
  }

  // Цитата: ответ на сообщение.
  if (message.replyTo) {
    const quote = createEl('button', 'bubble-reply');
    quote.type = 'button';
    quote.append(createEl('span', 'bubble-reply-name', getSenderName(message.replyTo.sender)));
    quote.append(createEl('span', 'bubble-reply-text', message.replyTo.text || ''));
    quote.addEventListener('click', () => {
      if (!flashMessage(message.replyTo.msgId)) toast('Сообщение не подгружено в историю');
    });
    bubble.append(quote);
  }

  // Текст с @упоминаниями и #хэштегами либо опрос (идеи 11, 18).
  if (message.poll) bubble.append(buildPollBlock(message));
  else bubble.append(buildMessageText(message.text || ''));

  // Служебная строка: закреп, «изм.», галочки/просмотры, время.
  const meta = createEl('span', 'bubble-meta');
  if (chat?.pinned?.[message.id]) meta.append(createIcon('pin', 'bubble-pin'));
  if (message.editedAt) meta.append(createEl('span', 'bubble-edited', 'изм.'));

  // Галочки прочтения в личных чатах — у своих сообщений (идея 6).
  if (own && chat?.type === 'private') {
    const read = Number(message.timestamp) <= state.peerReadTs;
    const ticks = createIcon(read ? 'checks' : 'check', 'bubble-ticks');
    if (read) ticks.classList.add('read');
    ticks.title = read ? 'Прочитано' : 'Отправлено';
    meta.append(ticks);
  }

  // Просмотры постов канала (идея 14).
  if (chat?.type === 'channel') {
    const views = Object.keys(state.chatViews.get(message.id) || {}).length;
    if (views > 0) {
      const viewsEl = createEl('span', 'bubble-views');
      viewsEl.append(createIcon('eye', 'bubble-views-icon'));
      viewsEl.append(createEl('span', '', String(views)));
      viewsEl.title = `Просмотры: ${views}`;
      meta.append(viewsEl);
    }
  }

  meta.append(createEl('span', 'bubble-time', formatTime(message.timestamp)));
  bubble.append(meta);

  // Кнопка комментариев под постом канала (идея 13).
  if (chat?.type === 'channel') {
    const comments = state.chatComments.get(message.id) || {};
    const count = Object.keys(comments).length;
    const btn = createEl('button', 'bubble-comments');
    btn.type = 'button';
    btn.title = 'Комментарии';
    btn.append(createIcon('comment', 'bubble-comments-icon'));
    btn.append(createEl('span', 'bubble-comments-count', String(count)));
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      openCommentsModal(message);
    });
    bubble.append(btn);
  }

  // Реакции под сообщением.
  const reactions = Object.entries(message.reactions || {})
    .map(([emoji, users]) => ({
      emoji,
      count: Object.keys(users || {}).length,
      mine: Boolean(users?.[state.user?.uid]),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  if (reactions.length) {
    const row = createEl('div', 'bubble-reactions');
    for (const item of reactions) {
      const pill = createEl('button', `reaction-pill${item.mine ? ' mine' : ''}`);
      pill.type = 'button';
      pill.title = item.mine ? 'Убрать реакцию' : 'Поставить реакцию';
      pill.append(createEl('span', 'reaction-emoji', item.emoji));
      pill.append(createEl('span', 'reaction-count', String(item.count)));
      pill.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleReaction(message, item.emoji);
      });
      row.append(pill);
    }

    // Та же кнопка, что и в меню: открывает общий пикер в режиме реакции.
    const add = createEl('button', 'reaction-pill reaction-add');
    add.type = 'button';
    add.title = 'Добавить реакцию';
    add.setAttribute('aria-label', 'Добавить реакцию');
    add.append(createIcon('plus', 'reaction-add-icon'));
    add.addEventListener('click', (event) => {
      event.stopPropagation();
      openReactionPicker(message, add);
    });
    row.append(add);
    bubble.append(row);
  }

  wrap.append(bubble);

  // Меню сообщения: ПКМ на десктопе, долгое нажатие на тач-экранах.
  // В режиме выделения текста работает штатное меню браузера (копирование).
  wrap.addEventListener('contextmenu', (event) => {
    if (wrap.classList.contains('text-selectable')) return;
    event.preventDefault();
    openMsgMenu(message, event.clientX, event.clientY);
  });

  let longPressTimer = null;
  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };
  wrap.addEventListener('touchstart', (event) => {
    if (wrap.classList.contains('text-selectable')) return;
    const touch = event.touches[0];
    if (!touch) return;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      openMsgMenu(message, touch.clientX, touch.clientY);
    }, 480);
  }, { passive: true });
  wrap.addEventListener('touchend', cancelLongPress);
  wrap.addEventListener('touchmove', cancelLongPress, { passive: true });
  wrap.addEventListener('touchcancel', cancelLongPress);

  // ТВ-пульт и клавиатура: Enter на сообщении открывает меню.
  wrap.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const rect = wrap.getBoundingClientRect();
    openMsgMenu(message, rect.left + 40, rect.bottom - 6);
  });

  return wrap;
}

/** Сбросить отложенные перерисовки ленты и наблюдатель просмотров. */
export function resetMessages() {
  cancelAnimationFrame(messagesRenderHandle);
  messagesRenderHandle = 0;
  window.clearTimeout(messagesRenderFallback);
  messagesRenderFallback = 0;
  messagesObserver?.disconnect();
  messagesObserver = null;
  messagesObserverChatId = null;
  viewsPending.clear();
}

