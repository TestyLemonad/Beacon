/**
 * Beacon — страница /dashboard.
 *
 * Четыре вкладки:
 *  - «Обзор» — публичные агрегаты, доступны без входа;
 *  - «Моя статистика» — после входа;
 *  - «Каналы» — статистика канала для подписчиков и администраторов;
 *  - «Весь Beacon» — только для супер-администраторов.
 *
 * Публичные цифры берутся из /public_stats; если правила базы ещё не
 * опубликованы, показывается статический снимок public-stats.json.
 */
import { displayName } from '../services/stats-core.js?v=39';

/*
 * Firebase подключается лениво: вкладка «Обзор» должна открываться и без
 * доступа к gstatic (например, при блокировке CDN или офлайне), показывая
 * сохранённый снимок public-stats.json.
 */
let Firebase = null;   // модуль firebase-auth
let auth = null;
let Stats = null;      // services/stats.js
let firebaseReady = false;

const $ = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat('ru-RU');

const TAB_NAMES = ['overview', 'me', 'channels', 'global'];

const state = {
  user: null,
  uid: null,
  isRoot: false,
  authToken: 0,
  activeTab: 'overview',
  pendingTab: '',
  overview: {
    data: null,
    source: '',
    loading: false,
    liveStarted: false,
    liveUnsub: null,
  },
  me: {
    data: null,
    loadedUid: null,
    loading: false,
    token: 0,
  },
  channels: {
    list: [],
    selectedId: null,
    data: null,
    loading: false,
    token: 0,
    loaded: false,
  },
  global: {
    data: null,
    loading: false,
    token: 0,
  },
};

/* ============================================================
 *  Мелкие помощники DOM и форматирования
 * ============================================================ */

function el(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = String(text);
  return node;
}

function clear(node) {
  if (node) node.replaceChildren();
}

function setHidden(node, hidden) {
  if (node) node.classList.toggle('hidden', Boolean(hidden));
}

function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

function plural(value, forms) {
  const abs = Math.abs(Number(value) || 0) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

function withPlural(value, forms) {
  return `${formatNumber(value)} ${plural(value, forms)}`;
}

function formatDate(seconds) {
  const value = Number(seconds);
  if (!value) return '—';
  return new Date(value * 1000).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(seconds) {
  const value = Number(seconds);
  if (!value) return '—';
  return new Date(value * 1000).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function timeAgo(seconds) {
  const value = Number(seconds);
  if (!value) return 'давно';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - value);
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`;
  return formatDay(value);
}

function userErrorMessage(error) {
  if (Stats.isPermissionDenied(error)) {
    return 'Недостаточно прав: опубликуйте обновлённые правила Realtime Database из RTDB-rules.json.';
  }
  return error?.message || 'Не удалось загрузить статистику';
}

function showError(id, message) {
  const node = $(id);
  if (!node) return;
  node.textContent = message;
  node.classList.remove('hidden');
}

function hideError(id) {
  const node = $(id);
  if (!node) return;
  node.textContent = '';
  node.classList.add('hidden');
}

const OFFLINE_MESSAGE = 'Нет связи с Firebase: живые данные сейчас недоступны. Обновите страницу, когда соединение восстановится.';

function showOfflineNote() {
  const target = state.activeTab === 'channels'
    ? 'channel-error'
    : state.activeTab === 'global' ? 'global-error' : 'me-error';
  showError(target, OFFLINE_MESSAGE);
}

function setProgress(barId, textId, done, total, message) {
  const bar = $(barId);
  const text = $(textId);
  if (bar) bar.style.width = `${total ? Math.min(100, Math.round((done / total) * 100)) : 0}%`;
  if (text) {
    if (message) text.textContent = total ? `${message} (${done}/${total})` : message;
    else text.textContent = total ? `${done}/${total}` : '';
  }
}

function profileInitials(profile) {
  const first = String(profile?.firstName || '').trim();
  const last = String(profile?.lastName || '').trim();
  if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
  const username = String(profile?.username || '').replace(/^@+/, '');
  if (username) return username.charAt(0).toUpperCase();
  return '?';
}

function seedColor(seed) {
  const text = String(seed || 'beacon');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 360;
  }
  return `hsl(${hash} 52% 42%)`;
}

/** Аватар профиля или канала в стиле мессенджера. */
function renderAvatar(profile, seed = '') {
  const node = el('span', 'dash-avatar');
  const avatar = profile?.avatar;
  if (avatar && avatar.value && avatar.bg1) {
    node.style.background = avatar.bgType === 'gradient'
      ? `linear-gradient(135deg, ${avatar.bg1}, ${avatar.bg2 || avatar.bg1})`
      : avatar.bg1;
    const glyph = el('span', 'avatar-glyph', avatar.value);
    if (avatar.kind === 'emoji') glyph.classList.add('avatar-emoji');
    node.append(glyph);
    return node;
  }
  node.style.background = seedColor(seed || profile?.username || profile?.title);
  node.textContent = profileInitials(profile);
  return node;
}

/* ============================================================
 *  Общие блоки отрисовки
 * ============================================================ */

function renderMetrics(container, items) {
  if (!container) return;
  clear(container);
  for (const item of items) {
    const card = el('div', 'dash-metric');
    const value = el('div', 'dash-metric-value');
    value.textContent = typeof item.value === 'string' ? item.value : formatNumber(item.value);
    card.append(value);
    card.append(el('div', 'dash-metric-label', item.label));
    if (item.hint) card.append(el('div', 'dash-metric-hint', item.hint));
    if (item.title) card.title = item.title;
    container.append(card);
  }
}

function renderBarChart(container, series, { emptyText = 'Пока нет данных', title = '' } = {}) {
  if (!container) return;
  clear(container);
  const list = Array.isArray(series) ? series : [];
  const total = list.reduce((sum, day) => sum + (Number(day.count) || 0), 0);
  if (!list.length || !total) {
    container.append(el('p', 'dash-chart-empty', emptyText));
    return;
  }

  const max = Math.max(1, ...list.map((day) => Number(day.count) || 0));
  const labelEvery = Math.max(1, Math.ceil(list.length / 8));

  list.forEach((day, index) => {
    const col = el('div', 'dash-bar-col');
    const bar = el('div', 'dash-bar');
    bar.style.height = `${Math.max(2, Math.round(((Number(day.count) || 0) / max) * 100))}%`;
    if (!day.count) bar.classList.add('empty');
    bar.title = `${day.label || day.key}: ${formatNumber(day.count)}${title ? ' ' + title : ''}`;

    const track = el('div', 'dash-bar-track-col');
    track.append(bar);
    col.append(track);

    const showLabel = index === list.length - 1 || index % labelEvery === 0;
    const label = el('span', 'dash-bar-label', showLabel ? (day.label || '') : '');
    col.append(label);
    container.append(col);
  });
}

function renderBarList(container, items, { emptyText = 'Пока нет данных', valueSuffix = '' } = {}) {
  if (!container) return;
  clear(container);
  const list = Array.isArray(items) ? items.filter((item) => item && item.value !== undefined) : [];
  if (!list.length) {
    container.append(el('p', 'dash-empty-small', emptyText));
    return;
  }

  const max = Math.max(1, ...list.map((item) => Number(item.value) || 0));
  for (const item of list) {
    const row = el('div', 'dash-bar-row');
    const head = el('div', 'dash-bar-head');
    head.append(el('span', 'dash-bar-title', item.label));
    head.append(el('span', 'dash-bar-value',
      `${formatNumber(item.value)}${valueSuffix ? ' ' + valueSuffix : ''}`));
    row.append(head);

    const track = el('div', 'dash-bar-track');
    const fill = el('span', 'dash-bar-fill');
    fill.style.width = `${Math.max(2, Math.round(((Number(item.value) || 0) / max) * 100))}%`;
    track.append(fill);
    row.append(track);
    if (item.hint) row.append(el('div', 'dash-bar-hint', item.hint));
    container.append(row);
  }
}

function renderKeyValues(container, rows) {
  if (!container) return;
  clear(container);
  const list = el('div', 'dash-kv-list');
  for (const row of rows) {
    const item = el('div', 'dash-kv');
    const label = el('span', 'dash-kv-label', row.label);
    const value = el('span', 'dash-kv-value');
    if (row.value instanceof Node) value.append(row.value);
    else value.textContent = row.value === null || row.value === undefined ? '—' : String(row.value);
    item.append(label, value);
    if (row.hint) item.title = row.hint;
    list.append(item);
  }
  container.append(list);
}

function renderTable(container, headers, rows, emptyText = 'Пока нет данных') {
  if (!container) return;
  clear(container);
  if (!rows.length) {
    container.append(el('p', 'dash-empty-small', emptyText));
    return;
  }

  const table = el('table', 'dash-table');
  const head = el('thead');
  const headRow = el('tr');
  for (const header of headers) headRow.append(el('th', '', header));
  head.append(headRow);
  table.append(head);

  const body = el('tbody');
  for (const row of rows) {
    const tr = el('tr');
    for (const cell of row) {
      const td = el('td');
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell === null || cell === undefined ? '—' : String(cell);
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  const wrap = el('div', 'dash-table-wrap');
  wrap.append(table);
  container.append(wrap);
}

function renderPosts(container, posts, metric, emptyText) {
  if (!container) return;
  clear(container);
  const list = Array.isArray(posts) ? posts : [];
  if (!list.length) {
    container.append(el('p', 'dash-empty-small', emptyText));
    return;
  }

  const metricLabels = {
    views: ['просмотр', 'просмотра', 'просмотров'],
    comments: ['комментарий', 'комментария', 'комментариев'],
    reactions: ['реакция', 'реакции', 'реакций'],
  };
  const forms = metricLabels[metric] || ['', '', ''];

  list.forEach((post, index) => {
    const item = el('div', 'dash-list-item');
    item.append(el('span', 'dash-list-rank', String(index + 1)));

    const body = el('div', 'dash-list-body');
    body.append(el('div', 'dash-list-title', post.text || (post.isPoll ? 'Опрос' : 'Без текста')));
    const meta = [
      post.timestamp ? formatDay(post.timestamp) : '',
      `${formatNumber(post[metric])} ${plural(post[metric], forms)}`,
      post.comments && metric !== 'comments' ? `${formatNumber(post.comments)} комм.` : '',
    ].filter(Boolean).join(' · ');
    body.append(el('div', 'dash-list-meta', meta));
    item.append(body);
    container.append(item);
  });
}

function channelRow(cellTitle, username) {
  const wrap = el('div', 'dash-table-title-wrap');
  wrap.append(el('span', 'dash-table-title', cellTitle || 'Канал'));
  if (username) wrap.append(el('span', 'dash-table-sub', '@' + username));
  return wrap;
}

/* ============================================================
 *  Тема
 * ============================================================ */

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  try {
    localStorage.setItem('beacon-theme', theme);
  } catch (error) {
    // Приватный режим — тема просто не сохранится.
  }
  const button = $('dash-theme');
  if (button) button.textContent = theme === 'light' ? '☾' : '☀';
}

/* ============================================================
 *  Вкладки
 * ============================================================ */

function allowedTabs() {
  const tabs = ['overview'];
  if (state.user) tabs.push('me', 'channels');
  if (state.user && state.isRoot) tabs.push('global');
  return tabs;
}

function setTab(name, { updateHash = true, force = false } = {}) {
  const allowed = allowedTabs();
  const next = allowed.includes(name) ? name : 'overview';
  state.activeTab = next;

  for (const button of document.querySelectorAll('.dash-tab')) {
    const active = button.dataset.tab === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const tabName of TAB_NAMES) {
    setHidden($(`tab-${tabName}`), tabName !== next);
  }

  if (updateHash && location.hash !== `#${next}`) {
    history.replaceState(null, '', `#${next}`);
  }

  if (next === 'overview') loadOverview({ force });
  if (next === 'me') loadMe({ force });
  if (next === 'channels') ensureChannels({ force });
  if (next === 'global') loadGlobal({ force });
}

function syncAuthUi() {
  const loggedIn = Boolean(state.user);
  setHidden($('dash-auth-note'), loggedIn);
  setHidden($('channels-tools'), !loggedIn);
  setHidden($('channels-gate'), loggedIn);
  setHidden($('me-gate'), loggedIn);
  setHidden($('global-gate'), !state.isRoot);

  const account = $('dash-account');
  if (account) {
    account.textContent = loggedIn
      ? (state.profileLabel || 'Аккаунт')
      : 'Без входа';
  }

  for (const button of document.querySelectorAll('.dash-tab')) {
    button.classList.toggle('hidden', !allowedTabs().includes(button.dataset.tab));
  }

  if (!allowedTabs().includes(state.activeTab)) {
    setTab('overview', { updateHash: false });
  } else {
    setTab(state.activeTab, { updateHash: false });
  }

  if (!loggedIn) {
    clearMe();
    clearChannels();
    clearGlobal();
  }
  updateGlobalNote();
}

/* ============================================================
 *  Публичный обзор
 * ============================================================ */

async function loadStaticSnapshot() {
  try {
    const response = await fetch('./public-stats.json?v=39', { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

function startOverviewLive() {
  if (!firebaseReady || state.overview.liveStarted) return;
  state.overview.liveStarted = true;
  state.overview.liveUnsub = Stats.subscribeToPublicSnapshot(
    (data) => {
      if (data) renderOverview(data, 'live');
    },
    () => {
      // Правила ещё не опубликованы — остаётся статический снимок.
    },
  );
}

async function loadOverview({ force = false } = {}) {
  if (state.overview.loading) return;
  if (state.overview.data && !force) return;

  state.overview.loading = true;
  setHidden($('overview-loading'), false);
  setHidden($('overview-content'), true);
  hideError('overview-error');

  try {
    let data = null;
    let source = '';

    if (firebaseReady) {
      try {
        data = await Stats.fetchPublicSnapshot();
        if (data) source = 'live';
      } catch (error) {
        if (!Stats.isPermissionDenied(error)) throw error;
      }
    }

    if (!data) {
      data = await loadStaticSnapshot();
      if (data) source = 'static';
    }

    if (!data) {
      throw new Error('Публичная статистика ещё не опубликована. Владельцу нужно добавить /public_stats в правила базы и нажать «Опубликовать снимок».');
    }

    renderOverview(data, source);
    if (source === 'live') startOverviewLive();
  } catch (error) {
    showError('overview-error', error?.message || 'Не удалось загрузить публичную статистику.');
  } finally {
    state.overview.loading = false;
    setHidden($('overview-loading'), true);
  }
}

function renderOverview(data, source) {
  state.overview.data = data;
  state.overview.source = source;
  setHidden($('overview-content'), false);

  const summary = data?.summary || {};
  const updatedAt = Number(data?.updatedAt || data?.generatedAt || 0);
  const sourceNode = $('overview-source');
  if (sourceNode) {
    sourceNode.textContent = source === 'live'
      ? `Живые данные · обновлено ${timeAgo(updatedAt)}`
      : `Снимок на ${formatDate(updatedAt)} · обновляется администратором Beacon`;
  }

  renderMetrics($('overview-cards'), [
    { value: summary.users, label: 'пользователей', hint: `+${formatNumber(summary.usersRegisteredWeek)} за неделю` },
    { value: summary.channels, label: 'каналов', hint: `${formatNumber(summary.subscribers)} подписок` },
    { value: summary.messages, label: 'сообщений', hint: `${formatNumber(summary.messagesToday)} сегодня` },
    { value: summary.groups, label: 'групп', hint: `${formatNumber(summary.privateChats)} личных чатов` },
    { value: summary.online, label: 'онлайн сейчас', hint: `${formatNumber(summary.activeMonth)} активны за месяц` },
    { value: summary.views, label: 'просмотров постов' },
    { value: summary.comments, label: 'комментариев' },
    { value: summary.reactions, label: 'реакций' },
    { value: summary.polls, label: 'опросов', hint: `${formatNumber(summary.pollVotes)} голосов` },
  ]);

  renderBarChart($('overview-chart-messages'), data?.dailyMessages, {
    emptyText: 'Сообщений пока нет',
    title: 'сообщений',
  });
  renderBarChart($('overview-chart-users'), data?.dailyUsers, {
    emptyText: 'Новых пользователей пока нет',
    title: 'пользователей',
  });

  const channels = Array.isArray(data?.topChannels) ? data.topChannels : [];
  renderTable(
    $('overview-top-channels'),
    ['Канал', 'Подписчики', 'Посты', 'Просмотры'],
    channels.map((channel) => [
      channelRow(channel.title, channel.username),
      formatNumber(channel.subscribers),
      formatNumber(channel.messages),
      formatNumber(channel.views),
    ]),
    'Публичных каналов пока нет',
  );

  renderKeyValues($('overview-extra'), [
    { label: 'Сообщений за неделю', value: formatNumber(summary.messagesWeek) },
    { label: 'Сообщений за месяц', value: formatNumber(summary.messagesMonth) },
    { label: 'Активны за неделю', value: formatNumber(summary.activeWeek) },
    { label: 'Активны за месяц', value: formatNumber(summary.activeMonth) },
    { label: 'Голосов в опросах', value: formatNumber(summary.pollVotes) },
    { label: 'Подписок на каналы', value: formatNumber(summary.subscribers) },
    { label: 'Комментариев', value: formatNumber(summary.comments) },
    { label: 'Реакций', value: formatNumber(summary.reactions) },
  ]);

  const live = source === 'live';
  setHidden($('global-note'), live || !state.global.data);
}

/* ============================================================
 *  Личная статистика
 * ============================================================ */

function clearMe() {
  state.me.data = null;
  state.me.loadedUid = null;
  state.me.loading = false;
  state.me.token += 1;
  setHidden($('me-content'), true);
  setHidden($('me-loading'), true);
  hideError('me-error');
}

async function loadMe({ force = false } = {}) {
  if (!state.user) {
    clearMe();
    setHidden($('me-gate'), false);
    return;
  }
  if (!firebaseReady) {
    showOfflineNote();
    return;
  }
  if (state.me.loading) return;
  if (state.me.data && state.me.loadedUid === state.uid && !force) return;

  setHidden($('me-gate'), true);
  setHidden($('me-content'), true);
  setHidden($('me-loading'), false);
  hideError('me-error');

  const token = ++state.me.token;
  state.me.loading = true;
  const uid = state.uid;

  try {
    const data = await Stats.loadPersonalStats(uid, {
      onProgress: (info) => setProgress('me-progress-bar', 'me-progress-text', info.done || 0, info.total || 0, info.message),
    });
    if (token !== state.me.token || uid !== state.uid) return;
    state.me.data = data;
    state.me.loadedUid = uid;
    renderMe(data);
    setHidden($('me-content'), false);
  } catch (error) {
    if (token !== state.me.token) return;
    showError('me-error', userErrorMessage(error));
  } finally {
    if (token === state.me.token) {
      state.me.loading = false;
      setHidden($('me-loading'), true);
    }
  }
}

function renderMe(stats) {
  const profile = stats.profile || {};
  const profileNode = $('me-profile');
  clear(profileNode);

  const avatar = renderAvatar(profile, stats.uid);
  const info = el('div', 'dash-profile-info');
  const myName = String(profile.name || '').trim() || displayName(profile, stats.uid);
  info.append(el('h2', 'dash-profile-name', myName));
  const meta = [];
  if (profile.username) meta.push('@' + profile.username);
  if (profile.createdAt) meta.push(`в Beacon с ${formatDay(profile.createdAt)}`);
  if (profile.ageDays) meta.push(withPlural(profile.ageDays, ['день', 'дня', 'дней']));
  info.append(el('p', 'dash-profile-meta', meta.join(' · ')));
  profileNode.append(avatar, info);

  const subtitle = $('me-subtitle');
  if (subtitle) {
    const handle = profile.username && !myName.startsWith('@') ? ` (@${profile.username})` : '';
    subtitle.textContent = `Аккаунт ${myName}${handle}. Данные обновлены ${timeAgo(stats.generatedAt)}.`;
  }

  renderMetrics($('me-cards'), [
    { value: stats.messages.total, label: 'моих сообщений', hint: `${formatNumber(stats.messages.today)} сегодня` },
    { value: stats.chats.total, label: 'чатов', hint: `${formatNumber(stats.chats.private)} личных · ${formatNumber(stats.chats.groups)} групп` },
    { value: stats.chats.channels, label: 'каналов', hint: `${formatNumber(stats.chats.subscribedChannels)} подписок` },
    { value: stats.unread.chats, label: 'чатов с непрочитанным', hint: `${formatNumber(stats.unread.messages)} сообщений` },
    { value: stats.engagement.reactionsReceived, label: 'реакций на мои сообщения' },
    { value: stats.engagement.viewsOnMyPosts, label: 'просмотров моих постов' },
    { value: stats.engagement.commentsOnMyPosts, label: 'комментариев к моим постам' },
    { value: stats.channelTotals.subscribers, label: 'подписчиков у моих каналов' },
  ]);

  renderBarChart($('me-chart'), stats.messages.daily, {
    emptyText: 'Вы пока не отправляли сообщений',
    title: 'сообщений',
  });

  const kinds = [
    { label: 'Личные чаты', value: stats.messages.byKind.private || 0 },
    { label: 'Группы', value: stats.messages.byKind.group || 0 },
    { label: 'Каналы', value: stats.messages.byKind.channel || 0 },
    { label: 'Избранное', value: stats.messages.byKind.saved || 0 },
  ];
  renderBarList($('me-breakdown'), kinds, { emptyText: 'Сообщений пока нет' });

  renderBarList($('me-top-chats'), (stats.topChats || []).map((chat) => ({
    label: chat.title,
    value: chat.count,
    hint: chat.kind === 'channel' ? 'канал' : chat.kind === 'group' ? 'группа' : chat.kind === 'saved' ? 'избранное' : 'личный чат',
  })), { emptyText: 'Пока нет отправленных сообщений', valueSuffix: 'сообщ.' });

  renderKeyValues($('me-engagement'), [
    { label: 'Реакций поставил(а)', value: formatNumber(stats.engagement.reactionsGiven) },
    { label: 'Реакций получил(а)', value: formatNumber(stats.engagement.reactionsReceived) },
    { label: 'Ответов на мои сообщения', value: formatNumber(stats.engagement.repliesToMe) },
    { label: 'Мои сообщения переслали', value: formatNumber(stats.engagement.forwardsOfMe) },
    { label: 'Просмотров моих постов', value: formatNumber(stats.engagement.viewsOnMyPosts) },
    { label: 'Комментариев к моим постам', value: formatNumber(stats.engagement.commentsOnMyPosts) },
    { label: 'Голосов в моих опросах', value: formatNumber(stats.engagement.votesOnMyPolls) },
    { label: 'Мои просмотры каналов', value: formatNumber(stats.engagement.myViews) },
    { label: 'Мои комментарии', value: formatNumber(stats.engagement.myComments) },
    { label: 'Мои голоса в опросах', value: formatNumber(stats.engagement.myVotes) },
  ]);

  const channelRows = (stats.channels || []).map((channel) => [
    channelRow(channel.title, channel.username),
    channel.role === 'owner' ? 'владелец' : 'админ',
    formatNumber(channel.subscribers),
    formatNumber(channel.posts),
    formatNumber(channel.views),
  ]);
  renderTable(
    $('me-channels'),
    ['Канал', 'Роль', 'Подписчики', 'Посты', 'Просмотры'],
    channelRows,
    'Вы пока не владеете каналами и не администрируете их',
  );

  const profileFlags = [
    profile.hasUsername ? 'юзернейм' : '',
    profile.hasName ? 'имя' : '',
    profile.hasAvatar ? 'аватар' : '',
    profile.hasBio ? 'био' : '',
  ].filter(Boolean);

  renderKeyValues($('me-account'), [
    { label: 'Дата регистрации', value: profile.createdAt ? formatDate(profile.createdAt) : '—' },
    { label: 'Возраст аккаунта', value: profile.ageDays ? withPlural(profile.ageDays, ['день', 'дня', 'дней']) : '—' },
    { label: 'Заполнено в профиле', value: profileFlags.length ? profileFlags.join(', ') : 'ничего' },
    { label: 'Статус', value: stats.account.online ? 'онлайн' : `был(а) ${timeAgo(stats.account.lastSeen)}` },
    { label: 'Сессии', value: `${formatNumber(stats.account.sessionsActive)} активных из ${formatNumber(stats.account.sessionsTotal)}` },
    { label: 'Последняя активная сессия', value: stats.account.lastSessionAt ? timeAgo(stats.account.lastSessionAt) : '—' },
    { label: 'Папки', value: stats.account.folders ? stats.account.folderNames.join(', ') : '—' },
    { label: 'Архив', value: formatNumber(stats.chats.archived) },
    { label: 'Закреплённые чаты', value: formatNumber(stats.chats.pinned) },
    { label: 'Приватность визита', value: stats.account.lastSeenPrivacy === 'nobody' ? 'скрыт' : 'виден всем' },
  ]);
}

/* ============================================================
 *  Каналы
 * ============================================================ */

function clearChannels() {
  state.channels.list = [];
  state.channels.selectedId = null;
  state.channels.data = null;
  state.channels.loading = false;
  state.channels.loaded = false;
  state.channels.token += 1;
  setHidden($('channel-content'), true);
  setHidden($('channels-loading'), true);
  setHidden($('channels-empty'), false);
  hideError('channel-error');
  const select = $('channel-select');
  if (select) clear(select);
}

function populateChannelSelect() {
  const select = $('channel-select');
  if (!select) return;
  clear(select);

  if (!state.channels.list.length) {
    select.append(el('option', '', 'Каналов нет'));
    select.disabled = true;
    return;
  }

  select.disabled = false;
  for (const channel of state.channels.list) {
    const option = el('option', '', `${channel.title}${channel.username ? ' · @' + channel.username : ''}`);
    option.value = channel.id;
    select.append(option);
  }
  if (state.channels.selectedId) select.value = state.channels.selectedId;
}

async function ensureChannels({ force = false } = {}) {
  if (!state.user) {
    setHidden($('channels-gate'), false);
    setHidden($('channels-tools'), true);
    setHidden($('channel-content'), true);
    return;
  }
  if (!firebaseReady) {
    showOfflineNote();
    return;
  }

  setHidden($('channels-gate'), true);
  setHidden($('channels-tools'), false);

  if (!state.channels.loaded || force) {
    state.channels.loaded = false;
    state.channels.list = [];
    state.channels.selectedId = null;
    populateChannelSelect();
    setHidden($('channels-loading'), false);
    setHidden($('channels-empty'), true);
    setHidden($('channel-content'), true);
    setProgress('channels-progress-bar', 'channels-progress-text', 0, 0, 'Ищем каналы…');

    try {
      state.channels.list = await Stats.loadMyChannels(state.uid, {
        onProgress: (info) => setProgress(
          'channels-progress-bar',
          'channels-progress-text',
          info.done || 0,
          info.total || 0,
          info.message,
        ),
      });
      state.channels.loaded = true;
      if (!state.channels.list.length) {
        setHidden($('channels-empty'), false);
        setHidden($('channels-loading'), true);
        populateChannelSelect();
        return;
      }
      state.channels.selectedId = state.channels.list[0].id;
      populateChannelSelect();
    } catch (error) {
      showError('channel-error', userErrorMessage(error));
      setHidden($('channels-loading'), true);
      return;
    }
  }

  if (!state.channels.selectedId && state.channels.list.length) {
    state.channels.selectedId = state.channels.list[0].id;
    populateChannelSelect();
  }

  if (state.channels.selectedId) {
    await loadChannel(state.channels.selectedId, { force });
  }
}

async function loadChannel(chatId, { force = false } = {}) {
  if (!chatId || state.channels.loading) return;
  if (state.channels.data && state.channels.data.id === chatId && !force) return;

  const token = ++state.channels.token;
  state.channels.loading = true;
  setHidden($('channels-loading'), false);
  setHidden($('channel-content'), true);
  setHidden($('channels-empty'), true);
  hideError('channel-error');
  setProgress('channels-progress-bar', 'channels-progress-text', 0, 5, 'Читаем канал…');

  try {
    const data = await Stats.loadChannelStats({
      chatId,
      uid: state.uid,
      isRoot: state.isRoot,
      onProgress: (info) => setProgress(
        'channels-progress-bar',
        'channels-progress-text',
        info.done || 0,
        info.total || 0,
        info.message,
      ),
    });
    if (token !== state.channels.token) return;
    state.channels.data = data;
    renderChannel(data);
    setHidden($('channel-content'), false);
  } catch (error) {
    if (token !== state.channels.token) return;
    showError('channel-error', userErrorMessage(error));
    setHidden($('channels-empty'), true);
  } finally {
    if (token === state.channels.token) {
      state.channels.loading = false;
      setHidden($('channels-loading'), true);
    }
  }
}

function renderChannel(stats) {
  const head = $('channel-header');
  clear(head);
  const avatar = renderAvatar(stats, stats.id);
  const info = el('div', 'dash-profile-info');
  info.append(el('h2', 'dash-profile-name', stats.title));
  const meta = [];
  if (stats.username) meta.push('@' + stats.username);
  meta.push(`${formatNumber(stats.totals.subscribers)} ${plural(stats.totals.subscribers, ['подписчик', 'подписчика', 'подписчиков'])}`);
  if (stats.createdAt) meta.push(`с ${formatDay(stats.createdAt)}`);
  if (stats.requiresSubscription) meta.push('чтение по подписке');
  info.append(el('p', 'dash-profile-meta', meta.join(' · ')));
  if (stats.description) info.append(el('p', 'dash-channel-description', stats.description));

  const roles = [];
  if (stats.roles.isOwner) roles.push('владелец');
  else if (stats.roles.isAdmin) roles.push('администратор');
  if (stats.roles.isSubscriber) roles.push('подписчик');
  if (roles.length) {
    const chips = el('div', 'dash-chips');
    for (const role of roles) chips.append(el('span', 'dash-chip', role));
    info.append(chips);
  }
  head.append(avatar, info);

  const restricted = $('channel-restricted');
  const content = $('channel-content');
  const panels = content ? [...content.querySelectorAll('.dash-panel')] : [];

  if (!stats.roles.canRead) {
    setHidden(restricted, false);
    clear(restricted);
    restricted.append(
      el('h2', '', 'Канал закрыт'),
      el('p', '', 'Подробная статистика доступна подписчикам, администраторам канала и супер-администраторам Beacon.'),
    );
    setHidden($('channel-cards'), true);
    for (const panel of panels) setHidden(panel, true);
    return;
  }

  setHidden(restricted, true);
  setHidden($('channel-cards'), false);
  for (const panel of panels) setHidden(panel, false);

  renderMetrics($('channel-cards'), [
    { value: stats.totals.subscribers, label: 'подписчиков', hint: stats.totals.subscribersCount && stats.totals.subscribersCount !== stats.totals.subscribers ? `в счётчике ${formatNumber(stats.totals.subscribersCount)}` : '' },
    { value: stats.totals.posts, label: 'постов', hint: `${formatNumber(stats.growth.postsMonth)} за месяц` },
    { value: stats.totals.views, label: 'просмотров', hint: `${formatNumber(stats.averages.viewsPerPost)} в среднем на пост` },
    { value: stats.totals.uniqueViewers, label: 'уникальных зрителей' },
    { value: stats.totals.comments, label: 'комментариев', hint: `${formatNumber(stats.totals.commenters)} авторов` },
    { value: stats.totals.reactions, label: 'реакций', hint: `${formatNumber(stats.totals.reactors)} человек` },
    { value: stats.totals.pollVotes, label: 'голосов в опросах', hint: `${formatNumber(stats.totals.polls)} опросов` },
    { value: `${stats.rates.engagementRate}%`, label: 'вовлечённость', hint: 'просмотры и реакции к подписчикам' },
  ]);

  renderBarChart($('channel-chart-views'), stats.dailyViews, {
    emptyText: 'Просмотров пока нет',
    title: 'просмотров',
  });
  renderBarChart($('channel-chart-posts'), stats.monthlyPosts, {
    emptyText: 'Постов пока нет',
    title: 'постов',
  });

  renderPosts($('channel-top-views'), stats.topPostsByViews, 'views', 'Просмотров пока нет');
  renderPosts($('channel-top-comments'), stats.topPostsByComments, 'comments', 'Комментариев пока нет');

  const schedule = $('channel-schedule');
  clear(schedule);
  schedule.append(el('h3', 'dash-mini-title', 'По дням недели'));
  const weekdays = el('div', 'dash-chart dash-chart-compact');
  renderBarChart(weekdays, stats.byWeekday, { emptyText: 'Постов пока нет', title: 'постов' });
  schedule.append(weekdays);
  schedule.append(el('h3', 'dash-mini-title', 'По часам суток'));
  const hours = el('div', 'dash-chart dash-chart-compact');
  renderBarChart(hours, stats.byHour, { emptyText: 'Постов пока нет', title: 'постов' });
  schedule.append(hours);

  const reactions = $('channel-reactions');
  clear(reactions);
  if (stats.reactionEmoji.length) {
    const chips = el('div', 'dash-chips dash-chips-wrap');
    for (const item of stats.reactionEmoji) {
      chips.append(el('span', 'dash-chip', `${item.emoji} ${formatNumber(item.count)}`));
    }
    reactions.append(chips);
  } else {
    reactions.append(el('p', 'dash-empty-small', 'Реакций пока нет'));
  }

  if (stats.polls.length) {
    reactions.append(el('h3', 'dash-mini-title', 'Опросы'));
    for (const poll of stats.polls) {
      const block = el('div', 'dash-poll');
      block.append(el('div', 'dash-poll-question', poll.question));
      block.append(el('div', 'dash-poll-meta',
        `${formatNumber(poll.voters)} ${plural(poll.voters, ['голос', 'голоса', 'голосов'])}${poll.multiple ? ' · несколько вариантов' : ''}`));
      const max = Math.max(1, ...poll.options.map((option) => option.count));
      for (const option of poll.options) {
        const row = el('div', 'dash-poll-option');
        const head = el('div', 'dash-poll-option-head');
        head.append(el('span', '', option.text || 'Вариант'));
        head.append(el('span', '', formatNumber(option.count)));
        row.append(head);
        const track = el('div', 'dash-bar-track');
        const fill = el('span', 'dash-bar-fill');
        fill.style.width = `${Math.max(2, Math.round((option.count / max) * 100))}%`;
        track.append(fill);
        row.append(track);
        block.append(row);
      }
      reactions.append(block);
    }
  } else {
    reactions.append(el('p', 'dash-empty-small', 'Опросов пока нет'));
  }

  const audience = $('channel-audience');
  clear(audience);
  if (!stats.roles.canSeeAudience) {
    audience.append(el('p', 'dash-empty-small', 'Имена аудитории видны владельцу и администраторам канала.'));
  } else {
    const profiles = stats.profiles || {};
    const renderPeople = (title, rows) => {
      audience.append(el('h3', 'dash-mini-title', title));
      if (!rows.length) {
        audience.append(el('p', 'dash-empty-small', 'Пока нет данных'));
        return;
      }
      const list = el('div', 'dash-people');
      for (const row of rows) {
        const item = el('div', 'dash-person');
        const profile = profiles[row.uid] || {};
        item.append(renderAvatar(profile, row.uid));
        const body = el('div', 'dash-person-body');
        body.append(el('div', 'dash-person-name', displayName(profile, row.uid)));
        if (profile.username) body.append(el('div', 'dash-person-meta', '@' + profile.username));
        item.append(body);
        item.append(el('span', 'dash-person-count', formatNumber(row.count)));
        list.append(item);
      }
      audience.append(list);
    };
    renderPeople('Топ комментаторов', stats.topCommenters);
    renderPeople('Топ зрителей', stats.topViewers);
    renderPeople('Топ по реакциям', stats.topReactors);
  }

  const lastPost = stats.growth.lastPostAt
    ? `${formatDay(stats.growth.lastPostAt)} (${timeAgo(stats.growth.lastPostAt)})`
    : 'постов ещё не было';
  renderKeyValues($('channel-summary'), [
    { label: 'Юзернейм', value: stats.username ? '@' + stats.username : '—' },
    { label: 'Создан', value: stats.createdAt ? formatDate(stats.createdAt) : '—' },
    { label: 'Возраст канала', value: stats.ageDays ? withPlural(stats.ageDays, ['день', 'дня', 'дней']) : '—' },
    { label: 'Администраторов', value: formatNumber(stats.totals.admins) },
    { label: 'Последний пост', value: lastPost },
    { label: 'Постов сегодня / 7 / 30 дней', value: `${formatNumber(stats.growth.postsToday)} / ${formatNumber(stats.growth.postsWeek)} / ${formatNumber(stats.growth.postsMonth)}` },
    { label: 'Просмотров сегодня / 7 / 30 дней', value: `${formatNumber(stats.growth.viewsToday)} / ${formatNumber(stats.growth.viewsWeek)} / ${formatNumber(stats.growth.viewsMonth)}` },
    { label: 'Среднее на пост', value: `${formatNumber(stats.averages.viewsPerPost)} просм. · ${stats.averages.commentsPerPost} комм. · ${stats.averages.reactionsPerPost} реакц.` },
    { label: 'Постов в неделю', value: stats.averages.postsPerWeek },
    { label: 'Просмотров на подписчика', value: `${stats.rates.viewRate}%` },
    { label: 'Лучший день по просмотрам', value: stats.bestDays.views ? `${stats.bestDays.views.label}: ${formatNumber(stats.bestDays.views.count)}` : '—' },
    { label: 'Лучший день по постам', value: stats.bestDays.posts ? `${stats.bestDays.posts.label}: ${formatNumber(stats.bestDays.posts.count)}` : '—' },
  ]);
}

async function findChannel(event) {
  event.preventDefault();
  if (!firebaseReady) {
    showError('channel-error', OFFLINE_MESSAGE);
    return;
  }
  hideError('channel-error');
  const input = $('channel-find-input');
  const value = String(input?.value || '').trim();
  if (!value) return;

  try {
    const found = await Stats.findChannelByUsername(value);
    if (!found) throw new Error('Канал с таким @username не найден');
    const chat = found.chat;
    const item = {
      id: found.id,
      title: String(chat.title || (chat.username ? '@' + chat.username : 'Канал')),
      username: String(chat.username || ''),
      subscribers: chat.subscribers ? Object.keys(chat.subscribers).length : Number(chat.subscribersCount) || 0,
      requiresSubscription: chat.requiresSubscription === true,
      isOwner: chat.owner === state.uid,
      isAdmin: chat.owner === state.uid || Boolean(chat.admins?.[state.uid]),
    };

    const existing = state.channels.list.find((channel) => channel.id === item.id);
    if (existing) Object.assign(existing, item);
    else state.channels.list.unshift(item);

    state.channels.selectedId = item.id;
    state.channels.loaded = true;
    populateChannelSelect();
    if (input) input.value = '';
    setHidden($('channels-empty'), true);
    await loadChannel(item.id, { force: true });
  } catch (error) {
    showError('channel-error', userErrorMessage(error));
  }
}

/* ============================================================
 *  Весь Beacon
 * ============================================================ */

function clearGlobal() {
  state.global.data = null;
  state.global.loading = false;
  state.global.token += 1;
  setHidden($('global-content'), true);
  setHidden($('global-loading'), true);
  hideError('global-error');
  hideStatus('global-status');
}

function showStatus(id, message) {
  const node = $(id);
  if (!node) return;
  node.textContent = message;
  node.classList.remove('hidden');
}

function hideStatus(id) {
  const node = $(id);
  if (!node) return;
  node.textContent = '';
  node.classList.add('hidden');
}

function updateGlobalNote() {
  const note = $('global-note');
  if (!note) return;
  const show = Boolean(state.isRoot && state.global.data && state.overview.source !== 'live');
  note.classList.toggle('hidden', !show);
}

async function loadGlobal({ force = false } = {}) {
  if (!state.isRoot) {
    setHidden($('global-gate'), false);
    setHidden($('global-content'), true);
    return;
  }
  if (!firebaseReady) {
    showOfflineNote();
    return;
  }
  if (state.global.loading) return;
  if (state.global.data && !force) {
    setHidden($('global-gate'), true);
    setHidden($('global-content'), false);
    updateGlobalNote();
    return;
  }

  setHidden($('global-gate'), true);
  setHidden($('global-content'), true);
  setHidden($('global-loading'), false);
  hideError('global-error');
  hideStatus('global-status');

  const token = ++state.global.token;
  state.global.loading = true;

  try {
    const data = await Stats.loadGlobalStats({
      onProgress: (info) => setProgress(
        'global-progress-bar',
        'global-progress-text',
        info.done || 0,
        info.total || 0,
        info.message,
      ),
    });
    if (token !== state.global.token) return;
    state.global.data = data;
    renderGlobal(data);
    setHidden($('global-content'), false);
    showStatus('global-status', `Пересчитано ${timeAgo(data.generatedAt)}`);
  } catch (error) {
    if (token !== state.global.token) return;
    showError('global-error', userErrorMessage(error));
  } finally {
    if (token === state.global.token) {
      state.global.loading = false;
      setHidden($('global-loading'), true);
    }
  }
}

function renderGlobal(stats) {
  renderMetrics($('global-cards'), [
    { value: stats.users.active, label: 'пользователей', hint: `${formatNumber(stats.users.deleted)} удалённых · ${formatNumber(stats.users.banned)} забаненных` },
    { value: stats.chats.total, label: 'чатов', hint: `${formatNumber(stats.chats.channels)} каналов · ${formatNumber(stats.chats.groups)} групп` },
    { value: stats.messages.total, label: 'сообщений', hint: `${formatNumber(stats.messages.today)} сегодня` },
    { value: stats.presence.online, label: 'онлайн сейчас', hint: `${formatNumber(stats.presence.activeWeek)} за неделю` },
    { value: stats.engagement.views, label: 'просмотров', hint: `${formatNumber(stats.engagement.uniqueViewers)} зрителей` },
    { value: stats.engagement.comments, label: 'комментариев', hint: `${formatNumber(stats.engagement.commenters)} авторов` },
    { value: stats.engagement.reactions, label: 'реакций', hint: `${formatNumber(stats.engagement.reactors)} человек` },
    { value: stats.engagement.pollVotes, label: 'голосов в опросах', hint: `${formatNumber(stats.engagement.polls)} опросов` },
    { value: stats.engagement.subscribers, label: 'подписок на каналы' },
    { value: stats.invites.redeemed, label: 'использовано инвайтов', hint: `${formatNumber(stats.invites.active)} активных кодов` },
  ]);

  renderBarChart($('global-chart-messages'), stats.messages.daily, {
    emptyText: 'Сообщений пока нет',
    title: 'сообщений',
  });
  renderBarChart($('global-chart-users'), stats.users.daily, {
    emptyText: 'Новых пользователей пока нет',
    title: 'пользователей',
  });

  renderBarList($('global-chats'), [
    { label: 'Личные чаты', value: stats.chats.private },
    { label: 'Группы', value: stats.chats.groups, hint: `${formatNumber(stats.chats.groupsPublic)} публичных · ${formatNumber(stats.chats.groupsPrivate)} приватных` },
    { label: 'Каналы', value: stats.chats.channels, hint: `${formatNumber(stats.chats.channelsWithUsername)} с @username` },
    { label: 'Избранное', value: stats.chats.saved },
    { label: 'Неизвестные', value: stats.chats.unknown },
  ], { emptyText: 'Чатов пока нет' });

  renderKeyValues($('global-engagement'), [
    { label: 'Сообщений с текстом', value: formatNumber(stats.messages.withText) },
    { label: 'Постов-опросов', value: formatNumber(stats.messages.withPoll) },
    { label: 'Пересланных сообщений', value: formatNumber(stats.messages.withForward) },
    { label: 'Ответов', value: formatNumber(stats.messages.withReply) },
    { label: 'Отредактированных', value: formatNumber(stats.messages.edited) },
    { label: 'Средняя длина', value: `${formatNumber(stats.messages.avgLength)} симв.` },
    { label: 'Уникальных авторов', value: formatNumber(stats.messages.uniqueSenders) },
    { label: 'Просмотров', value: formatNumber(stats.engagement.views) },
    { label: 'Уникальных зрителей', value: formatNumber(stats.engagement.uniqueViewers) },
    { label: 'Комментариев', value: formatNumber(stats.engagement.comments) },
    { label: 'Реакций', value: formatNumber(stats.engagement.reactions) },
    { label: 'Голосов в опросах', value: `${formatNumber(stats.engagement.pollVotes)} (${formatNumber(stats.engagement.pollSelections)} отметок)` },
  ]);

  renderTable(
    $('global-top-channels'),
    ['Канал', 'Подписчики', 'Посты', 'Просмотры', 'Комм.'],
    (stats.topChannels || []).map((channel) => [
      channelRow(channel.title, channel.username),
      formatNumber(channel.subscribers),
      formatNumber(channel.messages),
      formatNumber(channel.views),
      formatNumber(channel.comments),
    ]),
    'Каналов пока нет',
  );

  renderTable(
    $('global-top-users'),
    ['Пользователь', 'Сообщений'],
    (stats.topUsers || []).map((user) => [
      (() => {
        const wrap = el('div', 'dash-table-title-wrap');
        wrap.append(el('span', 'dash-table-title', user.name));
        if (user.username) wrap.append(el('span', 'dash-table-sub', '@' + user.username));
        return wrap;
      })(),
      formatNumber(user.messages),
    ]),
    'Сообщений пока нет',
  );

  renderBarChart($('global-hours'), stats.messages.byHour, {
    emptyText: 'Сообщений пока нет',
    title: 'сообщений',
  });

  renderKeyValues($('global-users'), [
    { label: 'Всего аккаунтов', value: formatNumber(stats.users.total) },
    { label: 'Активных', value: formatNumber(stats.users.active) },
    { label: 'Удалённых', value: formatNumber(stats.users.deleted) },
    { label: 'Забаненных', value: formatNumber(stats.users.banned) },
    { label: 'С @username', value: formatNumber(stats.users.withUsername) },
    { label: 'С аватаром', value: formatNumber(stats.users.withAvatar) },
    { label: 'С био', value: formatNumber(stats.users.withBio) },
    { label: 'Регистраций сегодня / 7 / 30 дней', value: `${formatNumber(stats.users.registeredToday)} / ${formatNumber(stats.users.registeredWeek)} / ${formatNumber(stats.users.registeredMonth)}` },
    { label: 'Онлайн / за день / за неделю', value: `${formatNumber(stats.presence.online)} / ${formatNumber(stats.presence.activeToday)} / ${formatNumber(stats.presence.activeWeek)}` },
    { label: 'Активны за месяц', value: formatNumber(stats.presence.activeMonth) },
    { label: 'Инвайт-коды', value: `${formatNumber(stats.invites.total)} (${formatNumber(stats.invites.active)} активных)` },
    { label: 'Погашено / отозвано / истекло', value: `${formatNumber(stats.invites.redeemed)} / ${formatNumber(stats.invites.revoked)} / ${formatNumber(stats.invites.expired)}` },
  ]);

  updateGlobalNote();
}

async function publishSnapshot() {
  if (!state.isRoot || !state.global.data || !firebaseReady) return;
  const button = $('global-publish');
  hideError('global-error');
  hideStatus('global-status');
  if (button) button.disabled = true;

  try {
    const payload = await Stats.publishPublicSnapshot(state.global.data);
    state.overview.data = payload;
    state.overview.source = 'live';
    renderOverview(payload, 'live');
    startOverviewLive();
    setHidden($('global-note'), true);
    showStatus('global-status', `Публичный снимок опубликован ${timeAgo(payload.updatedAt)}`);
  } catch (error) {
    const message = Stats.isPermissionDenied(error)
      ? 'Не удалось записать /public_stats: правила базы ещё не разрешают запись. Опубликуйте RTDB-rules.json в Firebase Console.'
      : userErrorMessage(error);
    showError('global-error', message);
  } finally {
    if (button) button.disabled = false;
  }
}

/* ============================================================
 *  Авторизация и запуск
 * ============================================================ */

function setAccountLabel(profile) {
  if (!profile) {
    state.profileLabel = '';
    return;
  }
  const name = displayName(profile, state.uid);
  state.profileLabel = profile.username && !name.startsWith('@')
    ? `${name} · @${profile.username}`
    : name;
}

async function handleAuth(user) {
  const token = ++state.authToken;
  if (!Stats) return;
  state.user = user || null;
  state.uid = user?.uid || null;
  state.isRoot = false;

  if (user) {
    try {
      const [root, profile] = await Promise.all([
        Stats.isRootAdmin(user.uid),
        Stats.loadAccountProfile(user.uid),
      ]);
      if (token !== state.authToken) return;
      state.isRoot = Boolean(root);
      setAccountLabel(profile);
      state.me.loadedUid = null;
      state.me.data = null;
    } catch (error) {
      if (token !== state.authToken) return;
      console.warn('Не удалось определить права аккаунта:', error);
    }
  } else {
    state.profileLabel = '';
  }

  syncAuthUi();

  const pending = state.pendingTab || '';
  state.pendingTab = '';
  if (pending && allowedTabs().includes(pending)) {
    setTab(pending, { updateHash: false });
  }
}

/* ============================================================
 *  Ленивое подключение Firebase
 * ============================================================ */

async function upgradeOverviewToLive() {
  if (!firebaseReady) return;
  try {
    const data = await Stats.fetchPublicSnapshot();
    if (data) {
      renderOverview(data, 'live');
      startOverviewLive();
    }
  } catch (error) {
    // Правила /public_stats ещё не опубликованы — остаётся статический снимок.
  }
}

async function connectFirebase() {
  try {
    const [authModule, config, statsModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
      import('../firebase-config.js?v=39'),
      import('../services/stats.js?v=39'),
    ]);
    Firebase = authModule;
    auth = config.auth;
    Stats = statsModule;
    firebaseReady = true;
  } catch (error) {
    console.warn('Firebase не загрузился, остаётся статический снимок:', error);
    return;
  }

  try {
    Firebase.onAuthStateChanged(auth, (user) => {
      handleAuth(user).catch((error) => console.error('Ошибка авторизации в дашборде:', error));
    });
  } catch (error) {
    console.warn('Не удалось подписаться на состояние входа:', error);
    return;
  }

  // Снимок уже показан — пробуем заменить его живыми данными.
  upgradeOverviewToLive();
  if (state.activeTab !== 'overview') setTab(state.activeTab, { updateHash: false });
}

function init() {
  applyTheme(currentTheme());

  $('dash-theme')?.addEventListener('click', () => {
    applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
  });

  for (const button of document.querySelectorAll('.dash-tab')) {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  }

  $('overview-refresh')?.addEventListener('click', () => loadOverview({ force: true }));
  $('me-refresh')?.addEventListener('click', () => loadMe({ force: true }));
  $('channels-refresh')?.addEventListener('click', () => ensureChannels({ force: true }));
  $('global-recalc')?.addEventListener('click', () => loadGlobal({ force: true }));
  $('global-publish')?.addEventListener('click', publishSnapshot);

  $('channel-select')?.addEventListener('change', (event) => {
    state.channels.selectedId = event.target.value;
    loadChannel(state.channels.selectedId, { force: true });
  });
  $('channel-find-form')?.addEventListener('submit', findChannel);

  window.addEventListener('hashchange', () => {
    const name = location.hash.replace(/^#/, '') || 'overview';
    setTab(name, { updateHash: false });
  });

  state.pendingTab = location.hash.replace(/^#/, '') || '';
  setTab('overview', { updateHash: false });
  loadOverview();

  connectFirebase();
}

init();
