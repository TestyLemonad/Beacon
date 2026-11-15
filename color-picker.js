/**
 * Пикер цвета Beacon.
 *
 * Один общий компонент вместо нативного <input type="color">, который в каждой
 * системе выглядит по-своему и не попадает в стиль интерфейса:
 *  - поле «насыщенность/яркость» с перетаскиваемой точкой и ползунок оттенка;
 *  - поле HEX, превью и палитра быстрых цветов;
 *  - пипетка — там, где браузер поддерживает EyeDropper API;
 *  - живое применение: каждое изменение сразу отдаётся в onInput.
 *
 * Используется в профиле и настройках канала (цвет аватарки), а также
 * в админке (цвет фона статуса). Для пары «кнопка-чип + поле HEX»
 * есть bindColorField() и syncColorChip().
 */

/** Палитра быстрых цветов по умолчанию, если вызывающий код не передал свою. */
const DEFAULT_PRESETS = [
  '#f0a24a', '#e06c75', '#61afef', '#98c379',
  '#c678dd', '#56b6c2', '#d19a66', '#8f9ff5',
];

const PANEL_MARGIN = 8;
const FALLBACK_COLOR = '#f0a24a';

/** Открытая панель и её состояние (одна на всю страницу). */
let panel = null;
let pickerState = null;
/** Кнопка, которая открыла текущую панель: повторный клик её закрывает. */
let openAnchor = null;

/** Разобрать HEX (#abc, #aabbcc, без «#») в {hex, r, g, b}. null — если не цвет. */
function parseHex(raw) {
  let value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!value.startsWith('#')) value = '#' + value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    value = '#' + [...value.slice(1)].map((char) => char + char).join('');
  }
  if (!/^#[0-9a-f]{6}$/.test(value)) return null;
  return {
    hex: value,
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
  };
}

/** RGB -> HSV: h в градусах 0–360, s и v в долях 0–1. */
function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}

/** HSV -> #rrggbb. */
function hsvToHex(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return '#' + rgb
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0'))
    .join('');
}

/** Цвет для градиента оттенка (верхний правый угол поля насыщенности). */
function hueColor(hue) {
  return `hsl(${Math.round(hue)} 100% 50%)`;
}

/** Создать панель один раз и переиспользовать её. */
function ensurePanel() {
  if (panel) return panel;

  const root = document.createElement('div');
  root.className = 'color-pop';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Выбор цвета');
  root.innerHTML = `
    <div class="color-pop-head">
      <span class="color-pop-preview" aria-hidden="true"></span>
      <input class="input hex-input color-pop-hex" type="text" maxlength="7" placeholder="${FALLBACK_COLOR}"
             autocomplete="off" spellcheck="false" aria-label="Цвет в HEX" />
      <button class="icon-btn color-pop-close" type="button" title="Закрыть" aria-label="Закрыть">×</button>
    </div>
    <div class="color-pop-area" role="slider" tabindex="0"
         aria-label="Насыщенность и яркость" aria-valuemin="0" aria-valuemax="100">
      <span class="color-pop-dot"></span>
    </div>
    <div class="color-pop-hue" role="slider" tabindex="0"
         aria-label="Оттенок" aria-valuemin="0" aria-valuemax="360">
      <span class="color-pop-hue-thumb"></span>
    </div>
    <div class="color-pop-presets"></div>
    <div class="color-pop-foot">
      <button class="color-pop-eye" type="button" title="Пипетка" aria-label="Взять цвет с экрана">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.5 7.5 4 15v5h5l7.5-7.5" />
          <path d="m9.5 5.5 9 9" />
          <path d="M15.5 3.5 20.5 8.5 18 11 13 6z" />
        </svg>
      </button>
      <button class="btn primary color-pop-done" type="button">Готово</button>
    </div>
  `;

  const parts = {
    root,
    preview: root.querySelector('.color-pop-preview'),
    hex: root.querySelector('.color-pop-hex'),
    close: root.querySelector('.color-pop-close'),
    area: root.querySelector('.color-pop-area'),
    dot: root.querySelector('.color-pop-dot'),
    hue: root.querySelector('.color-pop-hue'),
    hueThumb: root.querySelector('.color-pop-hue-thumb'),
    presets: root.querySelector('.color-pop-presets'),
    eye: root.querySelector('.color-pop-eye'),
    done: root.querySelector('.color-pop-done'),
  };

  bindPanelEvents(parts);
  document.body.append(root);
  panel = parts;
  return panel;
}

/** Перерисовать панель по текущему состоянию (hex — опционально). */
function renderPanel({ syncHex = true } = {}) {
  if (!panel || !pickerState) return;

  const { hue, sat, val, hex } = pickerState;
  panel.area.style.backgroundImage =
    `linear-gradient(to top, #000, rgba(0, 0, 0, 0)), ` +
    `linear-gradient(to right, #fff, ${hueColor(hue)})`;
  panel.dot.style.left = `${sat * 100}%`;
  panel.dot.style.top = `${(1 - val) * 100}%`;
  panel.hueThumb.style.left = `${(hue / 360) * 100}%`;
  panel.preview.style.background = hex;
  panel.area.setAttribute('aria-valuetext', `${hex}, насыщенность ${Math.round(sat * 100)}%, яркость ${Math.round(val * 100)}%`);

  if (syncHex && document.activeElement !== panel.hex) panel.hex.value = hex;

  panel.presets.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color === hex);
  });
}

/** Отдать текущий цвет наружу. */
function emitColor() {
  if (!pickerState) return;
  pickerState.onInput?.(pickerState.hex);
}

/** Задать цвет по HEX (с клавиатуры, из палитры, пипеткой). */
function setColorFromHex(raw, { commit = true } = {}) {
  if (!pickerState) return;
  const parsed = parseHex(raw);
  if (!parsed) return;

  const hsv = rgbToHsv(parsed);
  // У серого и чёрного оттенок не определён: сохраняем прежний, чтобы ползунок не прыгал.
  if (hsv.s > 0.002 && hsv.v > 0.002) pickerState.hue = hsv.h;
  pickerState.sat = hsv.s;
  pickerState.val = hsv.v;
  pickerState.hex = parsed.hex;

  renderPanel();
  if (commit) emitColor();
}

/** Задать цвет по текущим HSV (перетаскивание точки и ползунка). */
function setColorFromHsv({ commit = true } = {}) {
  if (!pickerState) return;
  pickerState.hex = hsvToHex(pickerState.hue, pickerState.sat, pickerState.val);
  renderPanel();
  if (commit) emitColor();
}

/** Нормализовать долю 0–1 из координаты указателя. */
function ratioAt(element, clientX, clientY, axis) {
  const rect = element.getBoundingClientRect();
  if (axis === 'x') {
    return Math.min(1, Math.max(0, (clientX - rect.left) / (rect.width || 1)));
  }
  return Math.min(1, Math.max(0, (clientY - rect.top) / (rect.height || 1)));
}

/** Перетаскивание: pointer события с захватом, работает и мышью, и пальцем. */
function bindDrag(element, onMove) {
  let dragging = false;

  element.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = true;
    element.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    onMove(event);
  });
  element.addEventListener('pointermove', (event) => {
    if (dragging) onMove(event);
  });
  const stop = (event) => {
    if (!dragging) return;
    dragging = false;
    element.releasePointerCapture?.(event.pointerId);
  };
  element.addEventListener('pointerup', stop);
  element.addEventListener('pointercancel', stop);
}

/** Все обработчики панели (вешаются один раз при создании). */
function bindPanelEvents(parts) {
  // Точка на поле насыщенности/яркости.
  bindDrag(parts.area, (event) => {
    pickerState.sat = ratioAt(parts.area, event.clientX, event.clientY, 'x');
    pickerState.val = 1 - ratioAt(parts.area, event.clientX, event.clientY, 'y');
    setColorFromHsv();
  });

  // Ползунок оттенка.
  bindDrag(parts.hue, (event) => {
    pickerState.hue = ratioAt(parts.hue, event.clientX, event.clientY, 'x') * 360;
    setColorFromHsv();
  });

  // Клавиатура на обоих слайдерах.
  parts.area.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    let handled = true;
    if (event.key === 'ArrowLeft') pickerState.sat = Math.max(0, pickerState.sat - step);
    else if (event.key === 'ArrowRight') pickerState.sat = Math.min(1, pickerState.sat + step);
    else if (event.key === 'ArrowUp') pickerState.val = Math.min(1, pickerState.val + step);
    else if (event.key === 'ArrowDown') pickerState.val = Math.max(0, pickerState.val - step);
    else handled = false;
    if (!handled) return;
    event.preventDefault();
    setColorFromHsv();
  });
  parts.hue.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 15 : 3;
    let handled = true;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') pickerState.hue = (pickerState.hue - step + 360) % 360;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') pickerState.hue = (pickerState.hue + step) % 360;
    else handled = false;
    if (!handled) return;
    event.preventDefault();
    setColorFromHsv();
  });

  // Ручной ввод HEX.
  parts.hex.addEventListener('input', () => {
    const parsed = parseHex(parts.hex.value);
    parts.hex.classList.toggle('invalid', !parsed && parts.hex.value.trim() !== '');
    if (parsed) setColorFromHex(parsed.hex, { commit: true });
  });
  parts.hex.addEventListener('blur', () => {
    parts.hex.classList.remove('invalid');
    if (pickerState) parts.hex.value = pickerState.hex;
  });
  parts.hex.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      closeColorPicker();
    }
  });

  // Пипетка: доступна не во всех браузерах.
  if ('EyeDropper' in window) {
    parts.eye.addEventListener('click', async () => {
      try {
        const result = await new window.EyeDropper().open();
        if (result?.sRGBHex) setColorFromHex(result.sRGBHex);
      } catch {
        // Пользователь отменил выбор — ничего не делаем.
      }
    });
  } else {
    parts.eye.classList.add('hidden');
  }

  parts.done.addEventListener('click', () => closeColorPicker());
  parts.close.addEventListener('click', () => closeColorPicker());
}

/** Поставить панель рядом с кнопкой, не вылезая за экран. */
function placePanel() {
  if (!panel || !pickerState?.anchor) return;

  const rect = pickerState.anchor.getBoundingClientRect();
  const width = panel.root.offsetWidth;
  const height = panel.root.offsetHeight;

  let left = Math.max(PANEL_MARGIN, Math.min(rect.left, window.innerWidth - width - PANEL_MARGIN));
  let top = rect.bottom + PANEL_MARGIN;
  if (top + height > window.innerHeight - PANEL_MARGIN) {
    const above = rect.top - height - PANEL_MARGIN;
    top = above >= PANEL_MARGIN ? above : Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN);
  }

  panel.root.style.left = `${Math.round(left)}px`;
  panel.root.style.top = `${Math.round(top)}px`;
}

/** Клик мимо панели и кнопки-якоря закрывает пикер. */
function onDocumentPointerDown(event) {
  if (!panel || !pickerState) return;
  if (panel.root.contains(event.target)) return;
  if (pickerState.anchor?.contains(event.target)) return;
  closeColorPicker();
}

function onDocumentKeyDown(event) {
  if (event.key === 'Escape') {
    event.stopPropagation();
    closeColorPicker();
  }
}

function onViewportChange() {
  placePanel();
}

/**
 * Открыть пикер цвета рядом с кнопкой.
 * @param {object} options
 * @param {HTMLElement} options.anchor кнопка-чип, к которой привяжется панель
 * @param {string} options.value стартовый цвет (#rrggbb, допустимы короткие формы)
 * @param {string[]} [options.presets] палитра быстрых цветов
 * @param {(hex: string) => void} [options.onInput] вызывается при каждом изменении
 */
export function openColorPicker({ anchor, value, presets, onInput } = {}) {
  const start = parseHex(value) || parseHex(FALLBACK_COLOR);
  const hsv = rgbToHsv(start);

  if (panel) closeColorPicker();
  const parts = ensurePanel();

  pickerState = {
    anchor: anchor || null,
    hue: hsv.h,
    sat: hsv.s,
    val: hsv.v,
    hex: start.hex,
    onInput,
  };
  openAnchor = anchor || null;

  const colors = (Array.isArray(presets) && presets.length ? presets : DEFAULT_PRESETS)
    .map((color) => parseHex(color)?.hex)
    .filter(Boolean);
  parts.presets.innerHTML = '';
  colors.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.dataset.color = color;
    swatch.style.background = color;
    swatch.title = color;
    swatch.setAttribute('aria-label', `Цвет ${color}`);
    swatch.addEventListener('click', () => setColorFromHex(color));
    parts.presets.append(swatch);
  });

  parts.root.classList.remove('hidden');
  parts.hex.classList.remove('invalid');
  renderPanel();
  placePanel();

  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  document.addEventListener('keydown', onDocumentKeyDown, true);
  window.addEventListener('resize', onViewportChange);
  document.addEventListener('scroll', onViewportChange, true);
}

/** Закрыть пикер: последний выбранный цвет уже применён через onInput. */
export function closeColorPicker() {
  if (!panel) return;

  panel.root.classList.add('hidden');
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  document.removeEventListener('keydown', onDocumentKeyDown, true);
  window.removeEventListener('resize', onViewportChange);
  document.removeEventListener('scroll', onViewportChange, true);

  pickerState = null;
  openAnchor = null;
}

/** Открыт ли пикер и для какой кнопки. */
export function isColorPickerOpen(anchor = null) {
  if (!panel) return false;
  return anchor ? openAnchor === anchor : true;
}

/** Перекрасить чип по значению поля HEX. */
export function syncColorChip(chip, input) {
  if (!chip || !input) return;
  const parsed = parseHex(input.value);
  chip.style.background = parsed ? parsed.hex : 'transparent';
  chip.classList.toggle('color-chip--empty', !parsed);
}

/**
 * Связать кнопку-чип с полем HEX: чип открывает пикер, поле остаётся
 * источником значения (его читает остальной код) и поддерживает ручной ввод.
 */
export function bindColorField({ chip, input, presets } = {}) {
  if (!chip || !input) return;

  let lastValid = parseHex(input.value)?.hex || '';

  const paint = () => syncColorChip(chip, input);

  input.addEventListener('input', () => {
    const parsed = parseHex(input.value);
    input.classList.toggle('invalid', !parsed && input.value.trim() !== '');
    if (parsed) lastValid = parsed.hex;
    paint();
  });
  input.addEventListener('blur', () => {
    input.classList.remove('invalid');
    if (!parseHex(input.value) && lastValid) {
      input.value = lastValid;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  chip.addEventListener('click', () => {
    if (isColorPickerOpen(chip)) {
      closeColorPicker();
      return;
    }
    openColorPicker({
      anchor: chip,
      value: input.value,
      presets,
      onInput: (hex) => {
        lastValid = hex;
        input.value = hex;
        input.classList.remove('invalid');
        paint();
        // Остальной код (редактор аватарки, предпросмотр статуса) слушает поле.
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
    });
  });

  paint();
}
