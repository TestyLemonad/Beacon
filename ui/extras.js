import * as Chat from '../services/chat.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { dom } from './dom.js?v=77';
import { buildMessageText, flashMessage } from './messages.js?v=77';
import { adminRightsOn, applyProfileAvatar, applyUserStatus, createIcon, getChatTitle, getSenderName, hydrateUsers } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { createEl, formatListTime, plural, pluralViews, toast } from './utils.js?v=77';

/**
 * Опросы, комментарии к постам и статистика канала
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Создание опроса (идея 11)
 * ============================================================ */

/** Одна строка варианта ответа в форме опроса. */
function addPollOptionRow(value = '') {
  const row = createEl('div', 'poll-option-row');
  const input = createEl('input', 'input');
  input.type = 'text';
  input.placeholder = 'Вариант ответа';
  input.maxLength = 100;
  input.value = value;

  const remove = createEl('button', 'poll-option-remove');
  remove.type = 'button';
  remove.title = 'Удалить вариант';
  remove.append(createIcon('close'));
  remove.addEventListener('click', () => {
    if (dom.pollOptions.children.length <= 2) {
      toast('Нужно минимум два варианта');
      return;
    }
    row.remove();
  });

  row.append(input, remove);
  dom.pollOptions.append(row);
}

function openPollModal() {
  if (!state.activeChatId || !state.user) return;
  dom.pollForm.reset();
  dom.pollOptions.innerHTML = '';
  addPollOptionRow();
  addPollOptionRow();
  dom.pollError.classList.add('hidden');
  dom.pollOverlay.classList.remove('hidden');
  dom.pollQuestion.focus();
}

export function closePollModal() {
  dom.pollOverlay.classList.add('hidden');
}

/** Отправка опроса: вопрос + 2–10 вариантов, флаг «несколько ответов». */
async function handlePollSubmit(event) {
  event.preventDefault();
  dom.pollError.classList.add('hidden');

  const question = dom.pollQuestion.value.trim();
  const options = [...dom.pollOptions.querySelectorAll('input')]
    .map((input) => input.value.trim())
    .filter(Boolean);

  if (question.length < 3) {
    dom.pollError.textContent = 'Вопрос должен быть длиннее двух символов';
    dom.pollError.classList.remove('hidden');
    return;
  }
  if (options.length < 2) {
    dom.pollError.textContent = 'Добавьте минимум два варианта ответа';
    dom.pollError.classList.remove('hidden');
    return;
  }

  dom.pollSubmit.disabled = true;
  try {
    await Chat.sendPollMessage(state.activeChatId, state.user.uid, {
      question,
      options,
      multiple: dom.pollMultiple.checked,
    });
    closePollModal();
    state.stickToBottom = true;
    toast('Опрос создан', 'success');
  } catch (error) {
    console.error(error);
    dom.pollError.textContent = error.message || 'Не удалось создать опрос';
    dom.pollError.classList.remove('hidden');
  } finally {
    dom.pollSubmit.disabled = false;
  }
}

/* ============================================================
 *  Комментарии к постам канала (идея 13)
 * ============================================================ */

let commentsUnsubscribe = null;

/** Открыть окно комментариев к посту: подписка на /comments/$chat_id/$post_id. */
export function openCommentsModal(message) {
  if (!state.activeChatId || !state.user) return;
  state.commentsPost = { chatId: state.activeChatId, msgId: message.id, message };

  // Цитата поста в шапке окна.
  dom.commentsPost.innerHTML = '';
  const postAuthor = createEl('span', 'comments-post-author', getSenderName(message.sender));
  applyUserStatus(postAuthor, message.sender);
  dom.commentsPost.append(postAuthor);
  dom.commentsPost.append(createEl('span', 'comments-post-text',
    message.poll ? '📊 ' + (message.poll.question || '') : (message.text || '')));
  Emoji.parse(dom.commentsPost);

  dom.commentsInput.value = '';
  dom.commentsList.innerHTML = '';
  dom.commentsEmpty.classList.add('hidden');
  dom.commentsOverlay.classList.remove('hidden');
  window.setTimeout(() => dom.commentsInput.focus(), 50);

  commentsUnsubscribe?.();
  commentsUnsubscribe = Chat.subscribeToPostComments(
    state.commentsPost.chatId,
    state.commentsPost.msgId,
    (map) => {
      if (!state.commentsPost || state.commentsPost.msgId !== message.id) return;
      renderComments(map || {});
    },
  );
}

export function closeCommentsModal() {
  dom.commentsOverlay.classList.add('hidden');
  commentsUnsubscribe?.();
  commentsUnsubscribe = null;
  state.commentsPost = null;
}

/** Отрисовать список комментариев поста. */
export function renderComments(map) {
  const comments = Object.entries(map)
    .map(([id, comment]) => ({ id, ...comment }))
    .sort((a, b) => (a.timestamp - b.timestamp) || String(a.id).localeCompare(String(b.id)));

  dom.commentsList.innerHTML = '';
  dom.commentsEmpty.classList.toggle('hidden', comments.length > 0);

  const senderUids = [];
  for (const comment of comments) {
    const item = createEl('div', 'comment-item');

    const avatar = createEl('div', 'avatar');
    applyProfileAvatar(avatar, Chat.getCachedUserProfile(comment.sender), comment.sender);

    const body = createEl('div', 'comment-body');
    const head = createEl('div', 'comment-head');
    const author = createEl('span', 'comment-author', comment.sender === state.user?.uid ? 'Вы' : getSenderName(comment.sender));
    applyUserStatus(author, comment.sender);
    head.append(author);
    head.append(createEl('span', 'comment-time', formatListTime(comment.timestamp)));
    body.append(head);
    const textEl = createEl('div', 'comment-text');
    textEl.append(...buildMessageText(comment.text || '').childNodes);
    body.append(textEl);

    item.append(avatar, body);

    if (comment.sender === state.user?.uid || adminRightsOn()) {
      const del = createEl('button', 'comment-delete');
      del.type = 'button';
      del.title = 'Удалить комментарий';
      del.append(createIcon('close'));
      del.addEventListener('click', async () => {
        del.disabled = true;
        try {
          await Chat.deleteComment(state.commentsPost.chatId, state.commentsPost.msgId, comment.id, state.user.uid);
        } catch (error) {
          console.error(error);
          toast('Не удалось удалить комментарий', 'error');
          del.disabled = false;
        }
      });
      item.append(del);
    }

    dom.commentsList.append(item);
    senderUids.push(comment.sender);
  }

  Emoji.parse(dom.commentsList);
  hydrateUsers(senderUids);
  dom.commentsList.scrollTop = dom.commentsList.scrollHeight;
}

/* ============================================================
 *  Статистика канала (идея 14, только для админов)
 * ============================================================ */

/** Открыть статистику канала: карточки, график 14 дней, топ постов. */
export async function openStatsModal() {
  const chatId = state.activeChatId;
  const chat = state.chats.get(chatId) || null;
  if (!chat || chat.type !== 'channel' || !chat.admins?.[state.user?.uid]) return;

  dom.statsHeading.textContent = `Статистика · ${getChatTitle(chat)}`;
  dom.statsCards.innerHTML = createEl('p', 'stats-empty', 'Считаем…').outerHTML;
  dom.statsChart.innerHTML = '';
  dom.statsTop.innerHTML = '';
  if (dom.statsFullLink) {
    const target = chat.username ? '@' + chat.username : chatId;
    const safe = encodeURIComponent(target).replace(/%40/gi, '@');
    dom.statsFullLink.href = `dashboard/#channels/${safe}`;
    dom.statsFullLink.textContent = chat.username
      ? `Полная статистика @${chat.username} →`
      : 'Полная статистика →';
    dom.statsFullLink.classList.remove('hidden');
  }
  dom.statsOverlay.classList.remove('hidden');

  try {
    const [messages, viewsMap] = await Promise.all([
      Chat.getChatMessages(chatId),
      Chat.getChatViews(chatId),
    ]);
    if (dom.statsOverlay.classList.contains('hidden')) return; // закрыли, пока грузили
    renderStats(chatId, chat, messages || {}, viewsMap || {});
  } catch (error) {
    console.error(error);
    dom.statsCards.innerHTML = '';
    dom.statsCards.append(createEl('p', 'stats-empty', 'Не удалось загрузить статистику'));
  }
}

export function closeStatsModal() {
  dom.statsOverlay.classList.add('hidden');
}

/** Карточки (подписчики/посты/просмотры), график за 14 дней и топ постов. */
function renderStats(chatId, chat, messages, viewsMap) {
  const messageList = Object.entries(messages).map(([id, message]) => ({ id, ...message }));
  const subscribers = Number(chat.subscribersCount) || 0;

  const viewCount = (msgId) => Object.keys(viewsMap[msgId] || {}).length;
  const totalViews = messageList.reduce((sum, message) => sum + viewCount(message.id), 0);
  const avgViews = messageList.length ? Math.round(totalViews / messageList.length) : 0;

  // Карточки.
  dom.statsCards.innerHTML = '';
  const cards = [
    [subscribers, plural(subscribers, ['подписчик', 'подписчика', 'подписчиков'])],
    [messageList.length, plural(messageList.length, ['пост', 'поста', 'постов'])],
    [totalViews, pluralViews(totalViews).replace(/^п/, 'П')],
    [`${avgViews}`, 'в среднем на пост'],
  ];
  for (const [value, label] of cards) {
    const card = createEl('div', 'stats-card');
    card.append(createEl('div', 'stats-card-value', String(value)));
    card.append(createEl('div', 'stats-card-label', String(label)));
    dom.statsCards.append(card);
  }

  // График: просмотры за последние 14 дней (по времени просмотра).
  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    days.push({ key: day.toDateString(), label: `${day.getDate()}.${day.getMonth() + 1}`, count: 0 });
  }
  const dayIndex = new Map(days.map((day) => [day.key, day]));

  for (const msgViews of Object.values(viewsMap)) {
    for (const ts of Object.values(msgViews || {})) {
      const key = new Date(Number(ts) * 1000).toDateString();
      const day = dayIndex.get(key);
      if (day) day.count += 1;
    }
  }

  const max = Math.max(1, ...days.map((day) => day.count));
  dom.statsChart.innerHTML = '';
  for (const day of days) {
    const col = createEl('div', 'stats-bar-col');
    const bar = createEl('div', `stats-bar${day.count ? '' : ' empty'}`);
    bar.style.height = `${Math.max(3, Math.round((day.count / max) * 82))}px`;
    bar.title = `${day.label}: ${day.count} ${pluralViews(day.count)}`;
    col.append(bar);
    col.append(createEl('span', 'stats-bar-label', day.label));
    dom.statsChart.append(col);
  }

  // Топ-5 постов по просмотрам.
  const top = messageList
    .map((message) => ({ ...message, views: viewCount(message.id) }))
    .filter((message) => message.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  dom.statsTop.innerHTML = '';
  if (!top.length) {
    dom.statsTop.append(createEl('p', 'stats-empty', 'Просмотров пока нет'));
    return;
  }

  top.forEach((message, index) => {
    const item = createEl('div', 'stats-top-item');
    item.append(createEl('span', 'stats-top-rank', `${index + 1}`));

    const body = createEl('div', 'stats-top-body');
    const snippet = message.poll
      ? '📊 ' + (message.poll.question || '')
      : Chat.messageSnippet(message.text || '', 70);
    body.append(createEl('div', 'stats-top-text', snippet || 'Без текста'));
    body.append(createEl('div', 'stats-top-meta',
      `${formatListTime(message.timestamp)} · ${message.views} ${pluralViews(message.views)}`));
    item.append(body);

    item.addEventListener('click', () => {
      closeStatsModal();
      if (state.activeChatId === chatId && !flashMessage(message.id)) {
        toast('Пост не подгружен в историю');
      }
    });
    dom.statsTop.append(item);
  });
}


/** Навесить обработчики интерфейса этого модуля. */
export function initExtras() {
  // --- Опросы ---
  dom.pollBtn.addEventListener('click', openPollModal);
  dom.pollClose.addEventListener('click', closePollModal);
  dom.pollCancel.addEventListener('click', closePollModal);
  dom.pollOverlay.addEventListener('click', (event) => {
    if (event.target === dom.pollOverlay) closePollModal();
  });
  dom.pollAddOption.addEventListener('click', () => {
    if (dom.pollOptions.children.length >= 10) {
      toast('Не больше 10 вариантов');
      return;
    }
    addPollOptionRow();
    const inputs = dom.pollOptions.querySelectorAll('input');
    inputs[inputs.length - 1]?.focus();
  });
  dom.pollForm.addEventListener('submit', handlePollSubmit);

  // --- Комментарии к постам канала ---
  dom.commentsClose.addEventListener('click', closeCommentsModal);
  dom.commentsOverlay.addEventListener('click', (event) => {
    if (event.target === dom.commentsOverlay) closeCommentsModal();
  });
  dom.commentsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const post = state.commentsPost;
    if (!post || !state.user) return;
    const text = dom.commentsInput.value.trim();
    if (!text) return;

    dom.commentsInput.value = '';
    try {
      await Chat.sendComment(post.chatId, post.msgId, state.user.uid, text);
    } catch (error) {
      console.error(error);
      toast('Не удалось отправить комментарий', 'error');
      dom.commentsInput.value = text;
    }
  });

  // --- Статистика канала ---
  dom.statsClose.addEventListener('click', closeStatsModal);
  dom.statsOverlay.addEventListener('click', (event) => {
    if (event.target === dom.statsOverlay) closeStatsModal();
  });
}

