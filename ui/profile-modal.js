import * as Chat from '../services/chat.js?v=77';
import * as ColorPicker from '../color-picker.js?v=77';
import { refreshReservedNameCache } from './admin-target.js?v=77';
import { avatarDraft, draftAvatar, initAvatarEditor } from './avatar-editor.js?v=77';
import { renderChatList } from './chat-list.js?v=77';
import { dom } from './dom.js?v=77';
import { adminRightsOn, aliasesForTarget, applyAliasHint, updateSidebarUser, userStatusFor } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { toast } from './utils.js?v=77';

/**
 * Модальное окно профиля и сохранение профиля
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Профиль: сохранение (онбординг и модальное окно)
 * ============================================================ */

/**
 * Общий обработчик форм профиля (онбординг / модалка).
 * Показывает ошибки, блокирует кнопку, обновляет state.profile.
 */
export async function saveProfileForm({ usernameEl, firstNameEl, lastNameEl, bioEl, errorEl, submitEl, avatar = undefined, onSuccess }) {
  errorEl.classList.add('hidden');
  const originalText = submitEl.textContent;
  submitEl.disabled = true;
  submitEl.textContent = 'Сохраняем…';

  try {
    const updated = await Chat.updateUserProfile(
      state.user.uid,
      {
        username: usernameEl.value,
        firstName: firstNameEl.value,
        lastName: lastNameEl.value,
        bio: bioEl.value,
        avatar: avatar === undefined ? (state.profile?.avatar || null) : avatar,
      },
      state.profile?.username || null,
    );
    state.profile = updated;
    errorEl.classList.add('hidden');
    onSuccess(updated);
  } catch (error) {
    console.error(error);
    errorEl.textContent = error.message || 'Не удалось сохранить профиль';
    errorEl.classList.remove('hidden');
  } finally {
    submitEl.disabled = false;
    submitEl.textContent = originalText;
  }
}

export function openProfileModal() {
  dom.profileOverlay.classList.remove('hidden');
  dom.pfUsername.value = state.profile?.username || '';
  dom.pfFirstname.value = state.profile?.firstName || '';
  dom.pfLastname.value = state.profile?.lastName || '';
  dom.pfBio.value = state.profile?.bio || '';
  renderProfileAliases();
  refreshReservedNameCache();
  initAvatarEditor();
  dom.profileError.classList.add('hidden');
  dom.pfUsername.focus();
}

export function closeProfileModal() {
  ColorPicker.closeColorPicker();
  dom.profileOverlay.classList.add('hidden');
}

/** Строка «А также …» в профиле: дополнительные имена ведут на основной. */
export function renderProfileAliases() {
  applyAliasHint(dom.profileAliases, 'user', state.user?.uid);
  renderProfileAdminRow();
}

/** Компактная строка «Юзернеймы и статус» в своём профиле. */
export function renderProfileAdminRow() {
  if (!dom.profileAdminField) return;
  const username = state.profile?.username || '';
  const visible = Boolean(adminRightsOn() && state.user && username);
  dom.profileAdminField.classList.toggle('hidden', !visible);
  if (!visible) return;

  const aliases = aliasesForTarget('user', state.user.uid).length;
  const hint = [
    aliases ? `доп. имён: ${aliases}` : '',
    userStatusFor(state.user.uid) ? 'есть статус' : '',
  ].filter(Boolean).join(' · ');
  dom.profileAdminHint.textContent = hint || 'Доп. имена, резерв, статус';
}


/** Навесить обработчики интерфейса этого модуля. */
export function initProfileModal() {
  dom.profileBtn.addEventListener('click', openProfileModal);

  // --- Модальное окно «Профиль» ---
  dom.profileClose.addEventListener('click', closeProfileModal);
  dom.profileCancel.addEventListener('click', closeProfileModal);
  dom.profileOverlay.addEventListener('click', (event) => {
    if (event.target === dom.profileOverlay) closeProfileModal();
  });
  dom.profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveProfileForm({
      usernameEl: dom.pfUsername,
      firstNameEl: dom.pfFirstname,
      lastNameEl: dom.pfLastname,
      bioEl: dom.pfBio,
      errorEl: dom.profileError,
      submitEl: dom.profileSubmit,
      avatar: avatarDraft.custom ? draftAvatar() : (state.profile?.avatar || null),
      onSuccess: () => {
        closeProfileModal();
        updateSidebarUser();
        renderChatList();
        toast('Профиль сохранён', 'success');
      },
    });
  });
}

