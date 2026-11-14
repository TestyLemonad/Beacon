/**
 * Эмодзи Beacon.
 *
 *  - Единый вид: все эмодзи в сообщениях, реакциях, заголовках и пикере
 *    заменяются на SVG из форка Twemoji (emoji.beacon.testylemonad.ru).
 *  - Парсинг: twemoji.parse() вызывается только для белого списка контейнеров,
 *    поэтому <input> и <textarea> не затрагиваются.
 *  - Динамика: MutationObserver добирает сообщения, реакции и заголовки,
 *    которые появляются после первичного рендера.
 *  - Пикер: общий компонент для вставки эмодзи в поле ввода и для выбора
 *    реакции. На ПК — поповер, на мобильных — панель снизу (bottom sheet).
 *
 * Каталог для поиска собран локально из открытых данных emojibase-data (ru)
 * и unicode-emoji-json; картинки всегда грузятся только с домена форка.
 */

const CDN_ORIGIN = 'https://emoji.beacon.testylemonad.ru';
const EMOJI_ASSET_BASE = `${CDN_ORIGIN}/assets/svg/`;
/**
 * Скрипт Twemoji всегда локальный: форк раздаёт только сами картинки.
 * Подключается в index.html обычным <script defer>, поэтому к моменту
 * первого рендера window.twemoji уже есть; здесь — запасная загрузка.
 */
const TWEMOJI_SRC = './vendor/twemoji.min.js?v=55';
const CATALOG_URL = './data/emoji.json?v=55';

/**
 * Контейнеры, где эмодзи заменяются на Twemoji. Специально не включаем
 * поля ввода и служебные панели: там эмодзи должны оставаться текстом.
 */
const ROOT_SELECTOR = [
  '#messages',
  '#chat-list',
  '.avatar',
  '#folders-bar',
  '#search-results',
  '#chat-title',
  '#preview-title',
  '#preview-description',
  '#chat-menu-title',
  '#chat-menu-description',
  '#pin-bar',
  '#composer-context',
  '#comments-list',
  '#comments-post',
  '#msg-menu',
  '#forward-list',
  '#blocked-list',
].join(',');

/** Иконки категорий пикера: реальные имена файлов на форке. */
const CATEGORY_ICONS = {
  0: '1f600',
  1: '1f44b',
  3: '1f43b',
  4: '1f354',
  5: '1f697',
  6: '26bd',
  7: '1f4a1',
  8: '2764',
  9: '1f3f3-fe0f-200d-1f308',
};

/**
 * Точечные исправления имён файлов: Twemoji оставляет FE0F в ZWJ-последовательностях,
 * а в наборе этой иконки файл лежит без вариационного селектора.
 */
const EMOJI_FILE_FIXES = {
  '1f441-fe0f-200d-1f5e8-fe0f': '1f441-200d-1f5e8',
};

let twemoji = null;
let twemojiLoading = null;
let observer = null;
let parseScheduled = false;
const pendingRoots = new Set();
const failedIcons = new Set();

let picker = null;
let catalog = null;
let catalogLoading = null;
let onSelect = null;
let initialized = false;

let isOpen = false;
let sheetMode = false;
let mode = 'insert';
let activeMessage = null;
let activeTrigger = null;
let focusSource = null;
let anchorRect = null;
let selectedEmojis = new Set();
let activeCategory = null;
let scrollFrame = 0;
let cachedSections = null;
let searchTimer = 0;
// Очередь порционного наполнения сеток категорий и id запланированного захода.
let fillQueue = [];
let fillHandle = 0;

/* ============================================================
 *  Twemoji: загрузка и парсинг
 * ============================================================ */

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`Не удалось загрузить ${src}`));
    };
    document.head.append(script);
  });
}

function loadTwemoji() {
  if (twemoji) return Promise.resolve(twemoji);
  if (twemojiLoading) return twemojiLoading;

  twemojiLoading = (async () => {
    // Обычно скрипт уже подключён в index.html и просто ждёт в window.
    if (!window.twemoji) {
      await loadScript(TWEMOJI_SRC);
      if (!window.twemoji) throw new Error('Скрипт Twemoji не инициализировался');
    }

    twemoji = window.twemoji;
    // Картинки берём только с форка: скрипт локальный, ассеты — оттуда.
    twemoji.base = `${CDN_ORIGIN}/assets/`;
    twemoji.ext = '.svg';
    twemoji.size = 'svg';
    twemoji.className = 'emoji';

    parseRoots(document.querySelectorAll(ROOT_SELECTOR));
    drainPending();
    return twemoji;
  })().catch((error) => {
    console.error('Эмодзи: Twemoji не загрузился', error);
    return null;
  });

  return twemojiLoading;
}

/** Одна картинка Twemoji с ленивой загрузкой и текстовым alt. */
function emojiImageSrc(icon, options) {
  if (failedIcons.has(icon)) return null;
  const file = EMOJI_FILE_FIXES[icon] || icon;
  return `${options.base}${options.size}/${file}${options.ext}`;
}

function handleEmojiImageError() {
  const icon = this.getAttribute?.('data-emoji-icon');
  if (icon) failedIcons.add(icon);
  const alt = this.alt || '';
  if (this.parentNode) this.parentNode.replaceChild(document.createTextNode(alt), this);
}

function parseRoot(root) {
  if (!twemoji || !root || !root.isConnected) return;

  twemoji.parse(root, {
    base: `${CDN_ORIGIN}/assets/`,
    folder: 'svg',
    ext: '.svg',
    className: 'emoji',
    callback: emojiImageSrc,
    attributes: (raw, icon) => ({
      loading: 'lazy',
      decoding: 'async',
      'data-emoji-icon': icon,
    }),
    onerror: handleEmojiImageError,
  });
}

function parseRoots(roots) {
  for (const root of roots) parseEmoji(root);
}

/** Разобрать эмодзи внутри разрешённого контейнера. */
export function parseEmoji(root) {
  if (!root) return;
  const element = root.nodeType === 1 ? root : root.parentElement;
  if (!element) return;

  if (!twemoji) {
    pendingRoots.add(element);
    loadTwemoji();
    return;
  }

  parseRoot(element);
}

/** Короткий псевдоним: UI-слой вызывает Emoji.parse(container). */
export const parse = parseEmoji;

function drainPending() {
  if (!pendingRoots.size) return;
  const roots = [...pendingRoots];
  pendingRoots.clear();
  for (const root of roots) {
    if (root.isConnected) parseRoot(root);
  }
}

function queueParse(root) {
  if (!root || !root.isConnected) return;
  pendingRoots.add(root);
  if (!twemoji || parseScheduled) return;

  parseScheduled = true;
  // Микрозадача, а не requestAnimationFrame: в фоновой вкладке кадры
  // не приходят, и эмодзи оставались бы текстом.
  queueMicrotask(() => {
    parseScheduled = false;
    if (!twemoji) return;
    const roots = [...pendingRoots];
    pendingRoots.clear();
    for (const item of roots) {
      if (item.isConnected) parseRoot(item);
    }
  });
}

function closestRoot(node) {
  if (!node) return null;
  const element = node.nodeType === 1 ? node : node.parentElement;
  return element?.closest?.(ROOT_SELECTOR) || null;
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') {
        const parent = record.target.parentElement;
        if (parent && closestRoot(parent)) queueParse(parent);
        continue;
      }

      for (const node of record.addedNodes) {
        if (node.nodeType === 1 && node.classList?.contains('emoji')) continue;
        const element = node.nodeType === 1 ? node : node.parentElement;
        if (!element || element.classList?.contains('emoji')) continue;
        // Разбираем только добавленный узел, а не весь контейнер целиком:
        // иначе на каждое новое сообщение перепроверялась вся история чата.
        if (element.matches?.(ROOT_SELECTOR) || closestRoot(element)) queueParse(element);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

/* ============================================================
 *  Каталог эмодзи
 * ============================================================ */

function normalizeSearch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCatalog(payload) {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  const byGroup = new Map(categories.map((category) => [category.id, []]));
  const names = new Map(categories.map((category) => [category.id, category.name]));

  for (const item of payload?.emojis || []) {
    if (!item || !item.e || !item.h) continue;
    item.label = item.l || item.n || item.e;
    item.search = normalizeSearch([
      item.l,
      item.n,
      item.t,
      names.get(item.g),
    ].filter(Boolean).join(' '));
    if (!byGroup.has(item.g)) byGroup.set(item.g, []);
    byGroup.get(item.g).push(item);
  }

  return { categories, byGroup, emojis: payload.emojis || [] };
}

function ensureCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (catalogLoading) return catalogLoading;

  catalogLoading = fetch(CATALOG_URL, { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      catalog = normalizeCatalog(payload);
      return catalog;
    })
    .catch((error) => {
      catalogLoading = null;
      throw error;
    });

  return catalogLoading;
}

function searchCatalog(query) {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return catalog.emojis.filter((item) => words.every((word) => item.search.includes(word)));
}

/* ============================================================
 *  Пикер
 * ============================================================ */

function cachePickerElements() {
  picker = {
    overlay: document.getElementById('emoji-picker-overlay'),
    root: document.getElementById('emoji-picker'),
    caption: document.getElementById('emoji-picker-caption'),
    search: document.getElementById('emoji-picker-search'),
    clear: document.getElementById('emoji-picker-clear'),
    close: document.getElementById('emoji-picker-close'),
    cats: document.getElementById('emoji-picker-cats'),
    body: document.getElementById('emoji-picker-body'),
    empty: document.getElementById('emoji-picker-empty'),
  };
  return Boolean(picker.root && picker.overlay && picker.body);
}

function isMobileSheet() {
  return window.matchMedia?.('(max-width: 768px)').matches ?? window.innerWidth <= 768;
}

function rectOf(anchor) {
  if (!anchor) return { top: window.innerHeight, right: window.innerWidth, bottom: window.innerHeight };
  if (typeof anchor.getBoundingClientRect === 'function') return anchor.getBoundingClientRect();
  return anchor;
}

function positionPicker() {
  if (!picker?.root || sheetMode) return;

  const root = picker.root;
  const rect = anchorRect || { top: window.innerHeight - 70, right: window.innerWidth - 16, bottom: window.innerHeight - 28 };
  const margin = 8;
  const width = root.offsetWidth || 340;
  const height = root.offsetHeight || 420;

  let left = rect.right - width;
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

  let top = rect.top - height - margin;
  if (top < margin) top = rect.bottom + margin;
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

  root.style.left = `${Math.round(left)}px`;
  root.style.top = `${Math.round(top)}px`;
}

function applySheetMode() {
  if (!picker?.root) return;
  picker.root.classList.toggle('emoji-picker--sheet', sheetMode);
  picker.overlay.classList.toggle('emoji-picker-overlay--sheet', sheetMode);
  if (sheetMode) {
    picker.root.style.left = '';
    picker.root.style.top = '';
  } else {
    positionPicker();
  }
}

function showPickerMessage(text) {
  if (!picker) return;
  picker.body.innerHTML = '';
  picker.empty.textContent = text;
  picker.empty.classList.remove('hidden');
}

function makeImage(src, alt, className = '') {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  if (className) img.className = className;
  return img;
}

/** Ошибка загрузки картинки в пикере: показываем родной эмодзи текстом. */
function handlePickerImageError(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  const fallback = document.createElement('span');
  fallback.className = 'emoji-native';
  fallback.textContent = img.alt || '';
  img.replaceWith(fallback);
}

function buildEmojiButton(item) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'emoji-item';
  button.dataset.emoji = item.e;
  button.title = item.label;
  button.setAttribute('aria-label', item.label);
  if (selectedEmojis.has(item.e)) button.classList.add('active');

  const img = makeImage(`${EMOJI_ASSET_BASE}${item.h}.svg`, item.e);
  button.append(img);
  return button;
}

function buildEmojiGrid(items) {
  const grid = document.createElement('div');
  grid.className = 'emoji-grid';
  const fragment = document.createDocumentFragment();
  for (const item of items) fragment.append(buildEmojiButton(item));
  grid.append(fragment);
  return grid;
}

function renderCategoryTabs() {
  if (!picker || !catalog) return;
  picker.cats.innerHTML = '';

  for (const category of catalog.categories) {
    const items = catalog.byGroup.get(category.id) || [];
    if (!items.length) continue;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-cat-btn';
    button.dataset.cat = String(category.id);
    button.title = category.name;
    button.setAttribute('aria-label', category.name);

    const file = CATEGORY_ICONS[category.id];
    if (file) {
      button.append(makeImage(`${EMOJI_ASSET_BASE}${file}.svg`, category.name, 'emoji-cat-img'));
    } else {
      button.textContent = category.name.slice(0, 1);
    }

    button.addEventListener('click', () => {
      scrollToCategory(category.id);
    });
    picker.cats.append(button);
  }

  setActiveCategory(catalog.categories[0]?.id ?? null);
}

function setActiveCategory(id) {
  activeCategory = id;
  if (!picker) return;
  for (const button of picker.cats.querySelectorAll('.emoji-cat-btn')) {
    const active = button.dataset.cat === String(id);
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'true' : 'false');
  }
}

function scrollToCategory(id) {
  if (!picker || !catalog) return;
  const section = picker.body.querySelector(`.emoji-category[data-cat="${id}"]`);
  if (!section) return;

  // Секции выше наполняются кнопками не сразу, без этого высоты другие
  // и прокрутка уезжает не туда.
  fillThrough(section);

  const jump = () => {
    const bodyRect = picker.body.getBoundingClientRect();
    const top = section.getBoundingClientRect().top - bodyRect.top + picker.body.scrollTop;
    picker.body.scrollTop = Math.max(0, top - 4);
  };

  jump();
  // Секции вне экрана не разложены (content-visibility): после прокрутки
  // их высоты уточняются, поэтому позицию поправляем на ближайших кадрах.
  let attempts = 0;
  const settle = () => {
    if (!isOpen || attempts >= 6) return;
    attempts += 1;
    const bodyRect = picker.body.getBoundingClientRect();
    const delta = section.getBoundingClientRect().top - bodyRect.top - 4;
    if (Math.abs(delta) > 2) {
      jump();
      requestAnimationFrame(settle);
    }
  };
  requestAnimationFrame(settle);
  setActiveCategory(id);
}

function updateActiveCategory() {
  if (!picker || !catalog || picker.root.classList.contains('emoji-picker--searching')) return;
  const bodyRect = picker.body.getBoundingClientRect();
  const threshold = picker.body.scrollTop + 16;
  let current = activeCategory;

  for (const section of picker.body.querySelectorAll('.emoji-category')) {
    const top = section.getBoundingClientRect().top - bodyRect.top + picker.body.scrollTop;
    if (top <= threshold) current = Number(section.dataset.cat);
    else break;
  }

  if (current !== activeCategory) setActiveCategory(current);
}

function renderPickerBody() {
  if (!picker || !catalog) return;

  const query = picker.search.value.trim();
  const searching = Boolean(normalizeSearch(query));
  picker.root.classList.toggle('emoji-picker--searching', searching);
  picker.empty.classList.add('hidden');
  picker.body.scrollTop = 0;

  if (searching) {
    const items = searchCatalog(query);
    if (!items.length) {
      picker.body.replaceChildren();
      showPickerMessage('Ничего не найдено. Попробуйте другое слово.');
      return;
    }
    picker.body.replaceChildren(buildEmojiGrid(items));
    return;
  }

  // Секции категорий собираются один раз и дальше переиспользуются:
  // открытие пикера не должно заново создавать ~1900 кнопок.
  if (!cachedSections) cachedSections = buildSections();
  if (picker.body.firstElementChild !== cachedSections[0]) {
    picker.body.replaceChildren(...cachedSections);
  }
  // Первую порцию рисуем сразу, иначе пикер на мгновение пустой:
  // остальное досыпается в простое.
  fillNextChunk(performance.now() + 24);
  scheduleFill();
  refineIntrinsicSizes();
  requestAnimationFrame(updateActiveCategory);
}

/**
 * Уточнить предполагаемые высоты секций по первой отрисованной.
 * Без этого полоса прокрутки скачет, пока секции не разложены
 * (content-visibility).
 */
function refineIntrinsicSizes() {
  const first = cachedSections?.[0];
  if (!first || first.dataset.sized === '1') return;

  const grid = first.querySelector('.emoji-grid');
  const total = Number(first.dataset.count) || 0;
  const filled = grid?.children.length || 0;
  if (!grid || !total || !filled) return;

  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
  const rowsFilled = Math.ceil(filled / columns);
  const gridHeight = grid.getBoundingClientRect().height;
  if (!columns || !rowsFilled || !gridHeight) return;

  const rowHeight = gridHeight / rowsFilled;
  const titleHeight = first.getBoundingClientRect().height - gridHeight;

  for (const section of cachedSections) {
    const count = Number(section.dataset.count) || 0;
    const height = Math.round(titleHeight + Math.ceil(count / columns) * rowHeight);
    section.style.containIntrinsicSize = `auto ${height}px`;
  }
  first.dataset.sized = '1';
}

/**
 * Секции категорий: заголовок и пустая сетка. Наполняются порциями
 * в простое, чтобы первое открытие пикера не блокировало кадр.
 */
function buildSections() {
  const sections = [];
  fillQueue = [];

  for (const category of catalog.categories) {
    const items = catalog.byGroup.get(category.id) || [];
    if (!items.length) continue;

    const section = document.createElement('section');
    section.className = 'emoji-category';
    section.dataset.cat = String(category.id);
    section.dataset.count = String(items.length);

    const title = document.createElement('h4');
    title.className = 'emoji-category-title';
    title.textContent = category.name;

    const grid = document.createElement('div');
    grid.className = 'emoji-grid';

    section.append(title, grid);
    sections.push(section);
    fillQueue.push({ section, grid, items, index: 0 });
  }
  return sections;
}

/** Дозаполнить сетки порциями, пока не выйдет бюджет времени. */
function fillNextChunk(deadline) {
  while (fillQueue.length && performance.now() < deadline) {
    const entry = fillQueue[0];
    const end = Math.min(entry.items.length, entry.index + 80);
    const fragment = document.createDocumentFragment();
    for (let i = entry.index; i < end; i += 1) fragment.append(buildEmojiButton(entry.items[i]));
    entry.grid.append(fragment);
    entry.index = end;
    if (entry.index >= entry.items.length) fillQueue.shift();
  }
}

function scheduleFill() {
  if (fillHandle || !fillQueue.length || !isOpen) return;

  const run = () => {
    fillHandle = 0;
    // Пока идёт поиск, секции отцеплены от документа — наполнять нечего.
    if (!isOpen || picker?.root.classList.contains('emoji-picker--searching')) return;
    fillNextChunk(performance.now() + 8);
    if (fillQueue.length) scheduleFill();
  };

  fillHandle = typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(run, { timeout: 200 })
    : window.setTimeout(run, 16);
}

/** Заполнить всё до нужной секции включительно: высоты важны для прокрутки. */
function fillThrough(section) {
  while (fillQueue.length) {
    const entry = fillQueue[0];
    const fragment = document.createDocumentFragment();
    for (let i = entry.index; i < entry.items.length; i += 1) fragment.append(buildEmojiButton(entry.items[i]));
    entry.grid.append(fragment);
    fillQueue.shift();
    if (entry.section === section) return;
  }
}

/** Подсветить уже выбранные реакции (секции кэшируются между открытиями). */
function syncSelectedMarks() {
  if (!picker) return;
  const marked = picker.body.querySelectorAll('.emoji-item.active');
  if (!marked.length && !selectedEmojis.size) return;

  for (const button of picker.body.querySelectorAll('.emoji-item')) {
    const active = selectedEmojis.has(button.dataset.emoji);
    if (button.classList.contains('active') !== active) button.classList.toggle('active', active);
  }
}

function chooseEmoji(emoji) {
  if (!emoji) return;
  if (mode === 'reaction') {
    const message = activeMessage;
    closePicker();
    onSelect?.(emoji, { mode: 'reaction', message });
    return;
  }
  onSelect?.(emoji, { mode: 'insert' });
}

/** Открыть общий пикер. anchor — элемент или DOMRect, trigger — кнопка для aria-expanded. */
export async function openPicker(options = {}) {
  if (!cachePickerElements()) return;

  const nextMode = options.mode === 'reaction' ? 'reaction' : 'insert';
  const trigger = options.trigger || (options.anchor instanceof Element ? options.anchor : null);

  if (isOpen && trigger && activeTrigger === trigger && mode === nextMode) {
    closePicker();
    return;
  }

  mode = nextMode;
  activeMessage = options.message || null;
  selectedEmojis = new Set(options.selected || Object.keys(activeMessage?.reactions || {}));
  focusSource = options.focusSource || null;
  anchorRect = rectOf(options.anchor || trigger);
  activeTrigger = trigger;
  sheetMode = isMobileSheet();
  isOpen = true;

  if (sheetMode) focusSource?.blur?.();

  picker.search.value = '';
  picker.clear.classList.add('hidden');
  picker.root.classList.toggle('emoji-picker--searching', false);
  picker.caption.textContent = mode === 'reaction' ? 'Выберите реакцию' : '';
  picker.caption.classList.toggle('hidden', mode !== 'reaction');
  picker.search.placeholder = mode === 'reaction' ? 'Найти реакцию' : 'Поиск эмодзи';

  picker.overlay.classList.remove('hidden');
  picker.root.classList.remove('hidden');
  picker.root.dataset.mode = mode;
  activeTrigger?.setAttribute('aria-expanded', 'true');
  applySheetMode();

  if (!catalog) showPickerMessage('Загружаем эмодзи…');
  if (!sheetMode) positionPicker();

  try {
    await ensureCatalog();
    if (!isOpen) return;
    renderCategoryTabs();
    renderPickerBody();
    syncSelectedMarks();
    positionPicker();
  } catch (error) {
    console.error('Эмодзи: не удалось загрузить каталог', error);
    showPickerMessage('Не удалось загрузить список эмодзи. Проверьте соединение.');
    return;
  }

  if (!sheetMode) {
    requestAnimationFrame(() => {
      if (isOpen && !sheetMode) picker.search.focus({ preventScroll: true });
    });
  }
}

/** Закрыть пикер. */
export function closePicker() {
  if (!isOpen || !picker) return;

  const wasSheet = sheetMode;
  const trigger = activeTrigger;
  isOpen = false;
  sheetMode = false;
  mode = 'insert';
  activeMessage = null;
  activeTrigger = null;
  focusSource = null;
  anchorRect = null;
  selectedEmojis.clear();
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = 0;
  }
  // Наполнение сеток в простое останавливаем: пока пикер закрыт, оно ни к чему.
  if (fillHandle) {
    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(fillHandle);
    else clearTimeout(fillHandle);
    fillHandle = 0;
  }

  picker.root.classList.add('hidden');
  picker.overlay.classList.add('hidden');
  picker.root.classList.remove('emoji-picker--sheet', 'emoji-picker--searching');
  picker.overlay.classList.remove('emoji-picker-overlay--sheet');
  trigger?.setAttribute('aria-expanded', 'false');

  // На ПК возвращаем фокус на кнопку; на мобильных не трогаем поле,
  // иначе снова откроется системная клавиатура.
  if (!wasSheet && trigger?.isConnected && trigger.offsetParent !== null) {
    try {
      trigger.focus({ preventScroll: true });
    } catch {
      trigger.focus();
    }
  }
}

export function isPickerOpen() {
  return isOpen;
}

function bindPickerEvents() {
  picker.overlay.addEventListener('click', closePicker);
  picker.close.addEventListener('click', closePicker);

  picker.search.addEventListener('input', () => {
    picker.clear.classList.toggle('hidden', !picker.search.value);
    // Пересобираем сетку с задержкой: без неё каждый символ перестраивал
    // весь список и ввод заметно тормозил.
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      searchTimer = 0;
      renderPickerBody();
    }, 90);
  });

  picker.clear.addEventListener('click', () => {
    picker.search.value = '';
    picker.clear.classList.add('hidden');
    if (searchTimer) { clearTimeout(searchTimer); searchTimer = 0; }
    renderPickerBody();
    picker.search.focus({ preventScroll: true });
  });

  // Один обработчик на контейнер вместо слушателя на каждой картинке.
  picker.body.addEventListener('error', handlePickerImageError, true);
  picker.cats.addEventListener('error', handlePickerImageError, true);

  picker.body.addEventListener('click', (event) => {
    const button = event.target.closest?.('.emoji-item');
    if (button) chooseEmoji(button.dataset.emoji);
  });

  picker.body.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (fillQueue.length
        && picker.body.scrollTop + picker.body.clientHeight >= picker.body.scrollHeight - 240) {
        // Пользователь дошёл до конца списка: досыпаем следующую категорию,
        // чтобы прокрутка не обрывалась на полупустой секции.
        fillThrough(fillQueue[0].section);
      }
      updateActiveCategory();
    });
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (!isOpen || event.key !== 'Escape') return;
    if (document.activeElement === picker.search && picker.search.value) {
      picker.search.value = '';
      picker.clear.classList.add('hidden');
      renderPickerBody();
      return;
    }
    event.preventDefault();
    closePicker();
  });

  // Мобильный сценарий: пользователь вернулся в поле ввода — панель прячется,
  // системная клавиатура освобождает место.
  document.addEventListener('focusin', (event) => {
    if (!isOpen || !sheetMode || !focusSource) return;
    if (event.target === focusSource) closePicker();
  });

  window.addEventListener('resize', () => {
    if (!isOpen) return;
    const nextSheet = isMobileSheet();
    if (nextSheet !== sheetMode) {
      sheetMode = nextSheet;
      applySheetMode();
    } else if (!sheetMode) {
      positionPicker();
    }
  });
}

/* ============================================================
 *  Инициализация
 * ============================================================ */

export function init(options = {}) {
  if (initialized) return;
  initialized = true;
  onSelect = typeof options.onSelect === 'function' ? options.onSelect : null;

  if (cachePickerElements()) bindPickerEvents();
  startObserver();
  loadTwemoji();
  parseRoots(document.querySelectorAll(ROOT_SELECTOR));

  // Каталог грузим заранее в простое: к первому открытию пикера он уже готов,
  // и нажатие на кнопку не ждёт сеть.
  const preloadCatalog = () => { ensureCatalog().catch(() => {}); };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(preloadCatalog, { timeout: 3000 });
  } else {
    window.setTimeout(preloadCatalog, 1200);
  }
}
