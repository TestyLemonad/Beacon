import * as ColorPicker from '../color-picker.js?v=77';
import { dom } from './dom.js?v=77';
import { applyAvatar, applyProfileAvatar, firstLetter, getProfileInitials } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { AVATAR_COLORS } from './utils.js?v=77';

/**
 * Аватарка в профиле: буква или эмодзи на цвете/градиенте
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Аватарка в профиле: буква или эмодзи на цвете/градиенте
 * ============================================================ */

/** Черновик аватарки в окне профиля. */
export const avatarDraft = {
  custom: false,        // трогал ли пользователь редактор в этот раз
  kind: 'letter',       // 'letter' | 'emoji'
  value: '',
  bgType: 'solid',      // 'solid' | 'gradient'
  bg1: AVATAR_COLORS[0],
  bg2: AVATAR_COLORS[2],
  size: 100,            // размер буквы/эмодзи в процентах (50–200)
};

/** Разрешённый формат цвета: #rrggbb. */
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/;

/**
 * Нормализовать hex-цвет из поля ввода: добавить «#», раскрыть #abc,
 * привести к нижнему регистру. null — невалидный цвет.
 */
export function normalizeHex(raw) {
  let value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (!value.startsWith('#')) value = '#' + value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    value = '#' + [...value.slice(1)].map((char) => char + char).join('');
  }
  return HEX_COLOR_REGEX.test(value) ? value : null;
}

/** Собрать аватарку из черновика (null — если значение пустое). */
export function draftAvatar(from = avatarDraft) {
  const value = from.kind === 'letter'
    ? from.value.replace(/[^0-9A-Za-zА-Яа-яЁё]/g, '').charAt(0).toUpperCase()
    : [...from.value].slice(0, 4).join('');
  if (!value) return null;
  return from.bgType === 'gradient'
    ? { kind: from.kind, value, bgType: 'gradient', bg1: from.bg1, bg2: from.bg2, size: from.size }
    : { kind: from.kind, value, bgType: 'solid', bg1: from.bg1, size: from.size };
}

/** Залить черновик данными текущего профиля и перерисовать редактор. */
export function initAvatarEditor() {
  const avatar = state.profile?.avatar || null;
  const fallbackName = (state.profile?.firstName || state.profile?.username || '').trim();
  avatarDraft.custom = false;
  avatarDraft.kind = avatar?.kind === 'emoji' ? 'emoji' : 'letter';
  avatarDraft.value = avatarDraft.kind === 'letter'
    ? firstLetter(avatar?.value, firstLetter(fallbackName, ''))
    : (avatar?.value || firstLetter(fallbackName, ''));
  avatarDraft.bgType = avatar?.bgType === 'gradient' ? 'gradient' : 'solid';
  avatarDraft.bg1 = avatar?.bg1 || AVATAR_COLORS[0];
  avatarDraft.bg2 = avatar?.bg2 || AVATAR_COLORS[2];
  avatarDraft.size = Math.min(200, Math.max(50, Number(avatar?.size) || 100));
  renderAvatarEditor();
}

/** Изменить размер буквы/эмодзи на delta процентов (шаг 10). */
function adjustAvatarSize(delta) {
  avatarDraft.custom = true;
  avatarDraft.size = Math.min(200, Math.max(50, avatarDraft.size + delta));
  renderAvatarEditor();
}

/** Перерисовать контролы редактора и превью (syncInput=false — не трогать поле ввода). */
function renderAvatarEditor(syncInput = true) {
  dom.avatarKindBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.avatarKind === avatarDraft.kind);
  });
  dom.avatarBgBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.avatarBg === avatarDraft.bgType);
  });

  if (syncInput) {
    if (dom.avatarValue.value !== avatarDraft.value) dom.avatarValue.value = avatarDraft.value;
    dom.avatarValue.maxLength = avatarDraft.kind === 'letter' ? 1 : 4;
    dom.avatarValue.placeholder = avatarDraft.kind === 'letter' ? 'С' : '💡';
    if (normalizeHex(dom.avatarHex1.value) !== avatarDraft.bg1) dom.avatarHex1.value = avatarDraft.bg1;
    if (normalizeHex(dom.avatarHex2.value) !== avatarDraft.bg2) dom.avatarHex2.value = avatarDraft.bg2;
    dom.avatarHex1.classList.remove('invalid');
    dom.avatarHex2.classList.remove('invalid');
  }

  dom.avatarSizeValue.textContent = `${avatarDraft.size}%`;
  dom.avatarColorRow2.classList.toggle('hidden', avatarDraft.bgType !== 'gradient');
  ColorPicker.syncColorChip(dom.avatarPick1, dom.avatarHex1);
  ColorPicker.syncColorChip(dom.avatarPick2, dom.avatarHex2);

  // Превью: своя аватарка (если есть или её начали настраивать), иначе стандартная.
  const showDraft = avatarDraft.custom || Boolean(state.profile?.avatar);
  if (showDraft) {
    applyProfileAvatar(
      dom.avatarPreview,
      { avatar: draftAvatar() },
      state.user?.uid || 'me',
      getProfileInitials(state.profile),
    );
  } else {
    dom.avatarPreview.classList.remove('avatar-emoji');
    applyAvatar(dom.avatarPreview, state.user?.uid || 'me', getProfileInitials(state.profile));
  }
}

dom.avatarKindBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    avatarDraft.custom = true;
    avatarDraft.kind = btn.dataset.avatarKind === 'emoji' ? 'emoji' : 'letter';
    if (avatarDraft.kind === 'letter') {
      // Эмодзи и суррогатные пары обрезать нельзя: берём первую настоящую букву,
      // иначе падаем на первую букву имени.
      const fallbackName = (state.profile?.firstName || state.profile?.username || '').trim();
      avatarDraft.value = firstLetter(avatarDraft.value, firstLetter(fallbackName, ''));
    }
    renderAvatarEditor();
  });
});
dom.avatarBgBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    avatarDraft.custom = true;
    avatarDraft.bgType = btn.dataset.avatarBg === 'gradient' ? 'gradient' : 'solid';
    renderAvatarEditor();
  });
});
dom.avatarValue.addEventListener('input', () => {
  avatarDraft.custom = true;
  avatarDraft.value = dom.avatarValue.value;
  renderAvatarEditor(false); // не трогаем само поле, чтобы не прыгал курсор
});

// Размер буквы/эмодзи: шаг 10% в диапазоне 50–200%.
dom.avatarSizeMinus.addEventListener('click', () => adjustAvatarSize(-10));
dom.avatarSizePlus.addEventListener('click', () => adjustAvatarSize(10));

// Свои hex-цвета для фона и градиента.
function bindHexInput(inputEl, key) {
  inputEl.addEventListener('input', () => {
    const hex = normalizeHex(inputEl.value);
    inputEl.classList.toggle('invalid', !hex && inputEl.value.trim() !== '');
    if (!hex) return;
    avatarDraft.custom = true;
    avatarDraft[key] = hex;
    renderAvatarEditor(false); // не трогаем поля, чтобы не прыгал курсор
  });
  inputEl.addEventListener('blur', () => {
    inputEl.classList.remove('invalid');
    inputEl.value = avatarDraft[key];
  });
}
bindHexInput(dom.avatarHex1, 'bg1');
bindHexInput(dom.avatarHex2, 'bg2');

// Чип рядом с HEX открывает общий пикер цвета: любой оттенок, а не только палитра.
ColorPicker.bindColorField({ chip: dom.avatarPick1, input: dom.avatarHex1, presets: AVATAR_COLORS });
ColorPicker.bindColorField({ chip: dom.avatarPick2, input: dom.avatarHex2, presets: AVATAR_COLORS });

