import * as Auth from '../services/auth.js?v=77';
import * as Chat from '../services/chat.js?v=77';
import * as ColorPicker from '../color-picker.js?v=77';
import * as Sessions from '../services/sessions.js?v=77';
import { closeTargetAdmin, refreshReservedNameCache, refreshUsernameAdminBlocks } from './admin-target.js?v=77';
import { closeAliasesModal, closeInvitesModal, closeReservedModal } from './admin-usernames.js?v=77';
import { logoutCurrentUser, passwordResetError } from './auth-screen.js?v=77';
import { archivedChats } from './chat-list-menu.js?v=77';
import { renderChatList } from './chat-list.js?v=77';
import { renderMainPanel } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { myNotificationSettings, notificationsSupported, renderNotificationSettings, requestNotificationPermission, saveNotificationSetting, sendTestNotification } from './notifications.js?v=77';
import { openProfileModal } from './profile-modal.js?v=77';
import { adminRightsOn, createIcon, getProfileName } from './profile-view.js?v=77';
import { renderSearchResults } from './search.js?v=77';
import { state } from './state.js?v=77';
import { resetStatusForm } from './status-admin.js?v=77';
import { createEl, formatDayLabel, formatLastSeen, formatTime, toast } from './utils.js?v=77';

/**
 * Настройки пользователя, безопасность, сессии и удаление аккаунта
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Настройки пользователя (клик по логотипу): тема, приватность, архив
 * ============================================================ */

function openPrefsModal() {
  resetStatusForm();
  renderPrefsModal();
  dom.prefsOverlay.classList.remove('hidden');
}

/** Все подокна настроек: закрываются вместе с главным окном. */
function prefsSubOverlays() {
  return [
    dom.appearanceOverlay,
    dom.notificationsOverlay,
    dom.privacyOverlay,
    dom.securityOverlay,
    dom.accountOverlay,
    dom.dataOverlay,
    dom.adminOverlay,
  ];
}

/** Открыть подокно настроек (оформление, приватность и т.п.). */
function openPrefsPage(overlay) {
  if (!overlay) return;
  renderPrefsModal();
  overlay.classList.remove('hidden');
}

function closePrefsPages() {
  prefsSubOverlays().forEach((overlay) => overlay?.classList.add('hidden'));
}

/** Закрыть верхнее подокно настроек; true — если что-то закрыли. */
export function closeTopPrefsPage() {
  const opened = prefsSubOverlays().filter((overlay) => overlay && !overlay.classList.contains('hidden'));
  if (!opened.length) return false;
  opened[opened.length - 1].classList.add('hidden');
  return true;
}

export function closePrefsModal() {
  closeSessionsModal();
  closePasswordModal();
  closeInvitesModal();
  closeReservedModal();
  closeAliasesModal();
  closeTargetAdmin();
  closePrefsPages();
  dom.prefsOverlay.classList.add('hidden');
}

/** Синхронизировать контролы настроек с текущими значениями. */
export function renderPrefsModal() {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  dom.prefsThemeToggle.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeChoice === theme);
  });

  const privacy = state.settings?.lastSeenPrivacy === 'nobody' ? 'nobody' : 'all';
  dom.prefsPrivacyToggle.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.privacyChoice === privacy);
  });

  const archived = archivedChats().length;
  dom.prefsArchiveCount.textContent = String(archived);
  dom.prefsBlockedCount.textContent = String(state.blocked.size);
  renderPrefsProviders();

  // Подсказки в компактном списке категорий.
  const providers = Auth.getLinkedProviders();
  const ownName = getProfileName(state.profile);
  const ownHandle = state.profile?.username ? '@' + state.profile.username : '';
  dom.prefsProfileHint.textContent = [ownName, ownHandle].filter(Boolean).join(' · ')
    || 'Имя, юзернейм и аватарка';
  dom.prefsAppearanceHint.textContent = theme === 'light' ? 'Светлая тема' : 'Тёмная тема';
  const notifications = myNotificationSettings();
  dom.prefsNotificationsHint.textContent = notifications.enabled === false
    ? 'Выключены'
    : notifications.sound === false ? 'Включены, без звука' : 'Включены, со звуком';
  renderNotificationSettings();
  dom.prefsPrivacyHint.textContent = privacy === 'nobody'
    ? 'Последний визит скрыт'
    : 'Последний визит виден всем';
  dom.prefsSecurityHint.textContent = providers.includes('password')
    ? 'Пароль и активные сессии'
    : 'Активные сессии';
  dom.prefsAccountHint.textContent = providers.includes('google.com')
    ? 'Пароль и Google'
    : 'Пароль (email)';
  dom.prefsDataHint.textContent = `Архив (${archived}) и статистика`;

  // Админ-права: поле видно только супер-администраторам, а раздел
  // «Администрирование» и всё админское — только при включённых правах.
  const isRoot = Boolean(state.user && state.rootAdmins.has(state.user.uid));
  const adminOn = isRoot && state.settings?.adminMode !== false;
  dom.prefsAdminField.classList.toggle('hidden', !isRoot);
  dom.prefsAdminSection.classList.toggle('hidden', !adminOn);
  dom.prefsAdminToggle.checked = adminOn;
  dom.prefsDeleteUserError.classList.add('hidden');
  if (!adminOn) {
    ColorPicker.closeColorPicker();
    dom.adminOverlay.classList.add('hidden');
  }

  dom.prefsDeleteAccountBtn.disabled = false;
  dom.prefsDeleteAccountHint.textContent = isRoot
    ? 'Профиль, настройки, чаты и подписки будут удалены, права супер-администратора сняты. Сообщения останутся, а имя изменится на «Удалённый аккаунт». Восстановить аккаунт нельзя.'
    : 'Профиль, настройки, чаты и подписки будут удалены. Сообщения останутся, а имя изменится на «Удалённый аккаунт». Восстановить аккаунт нельзя.';
}

/** Способы входа (пароль / Google): строки со статусом и кнопками. */
function renderPrefsProviders() {
  dom.prefsProviders.innerHTML = '';
  const providers = Auth.getLinkedProviders();
  const canUnlink = providers.length > 1;

  const rows = [
    { id: 'password', label: 'Пароль (email)', icon: 'key' },
    { id: 'google.com', label: 'Google', icon: 'google' },
  ];

  rows.forEach(({ id, label, icon }) => {
    const linked = providers.includes(id);
    const row = createEl('div', 'provider-row');

    const info = createEl('div', 'provider-info');
    const name = createEl('span', 'provider-name', label);
    name.prepend(createIcon(icon, 'provider-icon'));
    info.append(name);
    info.append(createEl('span', 'provider-status', linked ? 'Привязан' : 'Не привязан'));
    row.append(info);

    if (linked) {
      if (canUnlink) {
        const btn = createEl('button', 'btn ghost provider-btn', 'Отвязать');
        btn.type = 'button';
        btn.addEventListener('click', () => unlinkProviderClick(id, label));
        row.append(btn);
      } else {
        row.append(createEl('span', 'provider-hint', 'единственный способ'));
      }
    } else if (id === 'google.com') {
      const btn = createEl('button', 'btn ghost provider-btn', 'Привязать');
      btn.type = 'button';
      btn.addEventListener('click', () => linkGoogleClick(btn));
      row.append(btn);
    } else if (id === 'password') {
      // Аккаунт без пароля (например, только Google): можно задать пароль —
      // после этого вход доступен любым из привязанных способов.
      const input = createEl('input', 'provider-pass-input');
      input.type = 'password';
      input.placeholder = 'Новый пароль';
      input.autocomplete = 'new-password';
      const btn = createEl('button', 'btn ghost provider-btn', 'Задать пароль');
      btn.type = 'button';
      btn.addEventListener('click', () => linkPasswordClick(input, btn));
      row.append(input, btn);
    } else {
      row.append(createEl('span', 'provider-hint', 'не привязан'));
    }

    dom.prefsProviders.append(row);
  });

  // Кнопка смены пароля — только аккаунтам с привязанным паролем.
  dom.prefsPasswordField.classList.toggle('hidden', !providers.includes('password'));
}

/** Привязать Google к текущему аккаунту (кнопка в настройках). */
async function linkGoogleClick(btn) {
  btn.disabled = true;
  try {
    await Auth.linkGoogle();
    toast('Google привязан — можно входить любым способом', 'success');
    renderPrefsProviders();
  } catch (error) {
    console.error(error);
    toast(Auth.getAuthErrorMessage(error), 'error');
  } finally {
    btn.disabled = false;
  }
}

/** Задать пароль аккаунту без пароля (например, созданному через Google). */
async function linkPasswordClick(input, btn) {
  const password = String(input.value || '');
  if (password.length < 6) {
    toast('Пароль — минимум 6 символов', 'error');
    input.focus();
    return;
  }

  btn.disabled = true;
  input.disabled = true;
  try {
    await Auth.linkPassword(password);
    toast('Пароль привязан — можно входить любым способом', 'success');
    renderPrefsProviders();
  } catch (error) {
    console.error(error);
    toast(Auth.getAuthErrorMessage(error), 'error');
  } finally {
    btn.disabled = false;
    input.disabled = false;
  }
}

/** Открыть отдельное окно смены пароля. */
function openPasswordModal() {
  if (!Auth.getLinkedProviders().includes('password')) {
    toast('Сначала задайте пароль в разделе «Способы входа»', 'error');
    return;
  }
  resetPasswordForm();
  dom.passwordOverlay.classList.remove('hidden');
  dom.passwordCurrent.focus();
}

/** Закрыть окно смены пароля и очистить поля. */
function closePasswordModal() {
  dom.passwordOverlay.classList.add('hidden');
  resetPasswordForm();
}

/** Привести окно смены пароля в исходное состояние. */
function resetPasswordForm() {
  dom.passwordCurrent.value = '';
  dom.passwordNew.value = '';
  dom.passwordRepeat.value = '';
  dom.passwordError.textContent = '';
  dom.passwordError.classList.add('hidden');
  dom.passwordSubmit.disabled = false;
  dom.passwordSubmit.textContent = 'Сменить пароль';
}

/** Показать ошибку в окне смены пароля. */
function showPasswordError(message, focusEl = null) {
  dom.passwordError.textContent = message;
  dom.passwordError.classList.remove('hidden');
  if (focusEl) focusEl.focus();
}

/** Отправить форму смены пароля. */
async function submitPasswordChange(event) {
  event.preventDefault();
  const current = String(dom.passwordCurrent.value || '');
  const next = String(dom.passwordNew.value || '');
  const repeat = String(dom.passwordRepeat.value || '');

  dom.passwordError.classList.add('hidden');
  if (!current) {
    showPasswordError('Введите текущий пароль', dom.passwordCurrent);
    return;
  }
  if (next.length < 6) {
    showPasswordError('Новый пароль — минимум 6 символов', dom.passwordNew);
    return;
  }
  if (next !== repeat) {
    showPasswordError('Пароли не совпадают', dom.passwordRepeat);
    return;
  }

  dom.passwordSubmit.disabled = true;
  dom.passwordSubmit.textContent = 'Меняем…';
  try {
    await Auth.changePassword(current, next);
    closePasswordModal();
    toast('Пароль изменён — входите с новым', 'success');
  } catch (error) {
    console.error(error);
    const wrong = error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential';
    showPasswordError(Auth.getAuthErrorMessage(error), wrong ? dom.passwordCurrent : null);
  } finally {
    dom.passwordSubmit.disabled = false;
    dom.passwordSubmit.textContent = 'Сменить пароль';
  }
}

/* ============================================================
 *  Активные сессии (отдельное окно из настроек)
 * ============================================================ */

function openSessionsModal() {
  if (!state.user) return;
  dom.sessionsError.classList.add('hidden');
  dom.sessionsEmpty.classList.add('hidden');
  dom.sessionsList.innerHTML = '';
  dom.sessionsOverlay.classList.remove('hidden');
  loadSessions();
}

export function closeSessionsModal() {
  dom.sessionsOverlay.classList.add('hidden');
}

function setSessionsLoading(loading) {
  dom.sessionsRefresh.disabled = loading;
  dom.sessionsRefresh.textContent = loading ? 'Загрузка…' : 'Обновить';
  if (loading) dom.sessionsRevokeOthers.disabled = true;
}

/** Загрузить список сессий и отрисовать его. */
async function loadSessions() {
  if (!state.user) return;
  dom.sessionsError.classList.add('hidden');
  setSessionsLoading(true);
  try {
    const sessions = await Sessions.listSessions(state.user.uid);
    renderSessions(sessions);
  } catch (error) {
    console.error(error);
    dom.sessionsList.innerHTML = '';
    dom.sessionsEmpty.classList.add('hidden');
    dom.sessionsRevokeOthers.disabled = true;
    dom.sessionsError.textContent = 'Не удалось загрузить список сессий. Попробуйте позже.';
    dom.sessionsError.classList.remove('hidden');
  } finally {
    setSessionsLoading(false);
  }
}

/** Отрисовать строки сессий: текущая — первой. */
function renderSessions(sessions) {
  const currentId = Sessions.getCurrentSessionId();
  const sorted = [...sessions].sort((a, b) => {
    if (a.id === currentId) return -1;
    if (b.id === currentId) return 1;
    return (Number(b.lastActive) || 0) - (Number(a.lastActive) || 0);
  });

  dom.sessionsList.innerHTML = '';
  dom.sessionsEmpty.classList.toggle('hidden', sorted.length > 0);

  const others = sorted.filter((session) => session.id !== currentId);
  dom.sessionsRevokeOthers.disabled = others.length === 0;

  sorted.forEach((session) => {
    const isCurrent = session.id === currentId;
    const row = createEl('div', 'session-row');

    const icon = createEl('div', 'session-icon');
    icon.append(createIcon(session.mobile ? 'phone' : 'device'));
    row.append(icon);

    const body = createEl('div', 'session-body');
    const title = createEl('div', 'session-title');
    title.append(createEl('span', '', session.label || 'Браузер'));
    if (isCurrent) title.append(createEl('span', 'session-current', 'это устройство'));

    const created = Number(session.createdAt) || 0;
    const meta = [`Активность: ${formatLastSeen(session.lastActive)}`];
    if (created) meta.push(`Вход: ${formatDayLabel(created)}, ${formatTime(created)}`);
    body.append(title, createEl('div', 'session-meta', meta.join(' · ')));
    row.append(body);

    if (!isCurrent) {
      const btn = createEl('button', 'btn ghost session-revoke', 'Завершить');
      btn.type = 'button';
      btn.addEventListener('click', () => revokeSessionClick(session));
      row.append(btn);
    }

    dom.sessionsList.append(row);
  });
}

/** Завершить одну сессию с подтверждением. */
async function revokeSessionClick(session) {
  if (!state.user) return;
  const currentId = Sessions.getCurrentSessionId();
  if (!session.id || session.id === currentId) return;
  if (!window.confirm(`Завершить сессию «${session.label || 'это устройство'}»?`)) return;

  try {
    await Sessions.revokeSession(state.user.uid, session.id, currentId);
    toast('Сессия завершена', 'success');
    await loadSessions();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось завершить сессию', 'error');
  }
}

/** Завершить все сессии, кроме текущей. */
async function revokeOtherSessionsClick() {
  if (!state.user) return;
  if (!window.confirm('Выйти на всех других устройствах? Там придётся войти заново.')) return;

  dom.sessionsRevokeOthers.disabled = true;
  try {
    const count = await Sessions.revokeOtherSessions(state.user.uid, Sessions.getCurrentSessionId());
    toast(count ? `Завершено сессий: ${count}` : 'Других активных сессий нет', count ? 'success' : undefined);
    await loadSessions();
  } catch (error) {
    console.error(error);
    toast('Не удалось завершить другие сессии', 'error');
    await loadSessions();
  }
}

/** Отвязать способ входа (кнопка в настройках). */
async function unlinkProviderClick(providerId, label) {
  if (!window.confirm(`Отвязать способ входа «${label}»?`)) return;
  try {
    await Auth.unlinkProvider(providerId);
    toast('Способ входа отвязан');
    renderPrefsProviders();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось отвязать способ входа', 'error');
  }
}

/** Переключить тему оформления (тёмная по умолчанию). */
function setTheme(theme) {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  try {
    localStorage.setItem('beacon-theme', theme);
  } catch (error) { /* приватный режим — тема просто не сохранится */ }
  renderPrefsModal();
}


/** Показать ошибку в блоке удаления чужого аккаунта. */
function showDeleteUserError(message) {
  dom.prefsDeleteUserError.textContent = message;
  dom.prefsDeleteUserError.classList.remove('hidden');
}

/** Удалить собственный аккаунт: стереть данные, затем удалить вход Firebase. */
async function deleteMyAccountClick() {
  if (!state.user || state.accountDeletionInProgress) return;

  const isRoot = state.rootAdmins.has(state.user.uid);
  const name = getProfileName(state.profile) || state.user.email || 'аккаунт';
  const confirmed = window.confirm(
    `Удалить аккаунт «${name}»?\n\n` +
    'Профиль, настройки, чаты и подписки будут удалены. Сообщения останутся, ' +
    'а имя изменится на «Удалённый аккаунт». Восстановить аккаунт нельзя.' +
    (isRoot ? '\n\nВы супер-администратор: права супер-администратора будут сняты.' : ''),
  );
  if (!confirmed) return;

  dom.prefsDeleteAccountBtn.disabled = true;
  state.accountDeletionInProgress = true;
  try {
    await Chat.deleteUserAccount(state.user.uid, { deletedBy: state.user.uid });
    closePrefsModal();
    toast('Аккаунт удалён', 'success');

    // Данные уже стёрты: запись сессии не трогаем, чтобы не воссоздавать её.
    await Sessions.stopSession({ removeRecord: false }).catch(() => {});
    try {
      await Auth.deleteCurrentAccount();
    } catch (error) {
      // Firebase может потребовать недавний вход. Метка deleted_users
      // всё равно не пустит аккаунт в мессенджер.
      console.warn('Не удалось удалить вход Firebase:', error);
      await Auth.logout().catch(() => {});
    }
  } catch (error) {
    console.error(error);
    toast('Не удалось удалить аккаунт', 'error');
  } finally {
    state.accountDeletionInProgress = false;
    dom.prefsDeleteAccountBtn.disabled = false;
  }
}

/** Удалить чужой аккаунт по @username (только супер-админ с правами). */
async function deleteAccountByUsernameClick() {
  if (state.accountDeletionInProgress) return;
  if (!state.user || !adminRightsOn()) {
    showDeleteUserError('Сначала включите админ-права');
    return;
  }

  const raw = dom.prefsDeleteUserInput.value.trim();
  if (!raw) {
    showDeleteUserError('Введите @username');
    return;
  }

  dom.prefsDeleteUserError.classList.add('hidden');
  dom.prefsDeleteUserBtn.disabled = true;
  try {
    const target = await Chat.getUserByUsername(raw);
    if (!target?.uid) {
      showDeleteUserError('Пользователь с таким юзернеймом не найден');
      return;
    }
    if (target.uid === state.user.uid) {
      showDeleteUserError('Это ваш аккаунт — используйте «Удалить аккаунт» выше');
      return;
    }
    if (state.rootAdmins.has(target.uid)) {
      showDeleteUserError('Нельзя удалить другого супер-администратора');
      return;
    }
    if (target.deleted) {
      showDeleteUserError('Аккаунт уже удалён');
      return;
    }

    const name = getProfileName(target) || `@${target.username}`;
    const confirmed = window.confirm(
      `Удалить аккаунт «${name}» (@${target.username})?\n\n` +
      'Профиль, настройки, чаты и подписки будут удалены. Сообщения останутся, ' +
      'а имя изменится на «Удалённый аккаунт». Пользователь потеряет доступ к мессенджеру.',
    );
    if (!confirmed) return;

    await Chat.deleteUserAccount(target.uid, { deletedBy: state.user.uid, ban: true });
    dom.prefsDeleteUserInput.value = '';
    toast(`Аккаунт ${name} удалён`, 'success');

    // Обновить открытые списки: у собеседников теперь «Удалённый аккаунт».
    renderChatList();
    renderMainPanel();
    if (state.search.query) renderSearchResults();
  } catch (error) {
    console.error(error);
    showDeleteUserError('Не удалось удалить аккаунт');
  } finally {
    dom.prefsDeleteUserBtn.disabled = false;
  }
}

/** Навесить обработчики интерфейса этого модуля. */
export function initPrefs() {
  // --- Настройки (клик по логотипу): тема, приватность визита, архив ---
  dom.settingsBtn.addEventListener('click', openPrefsModal);
  dom.prefsClose.addEventListener('click', closePrefsModal);
  dom.prefsOverlay.addEventListener('click', (event) => {
    if (event.target === dom.prefsOverlay) closePrefsModal();
  });

  // --- Категории настроек: каждая открывает своё окно ---
  dom.prefsProfileBtn.addEventListener('click', () => {
    closePrefsModal();
    openProfileModal();
  });
  dom.prefsAppearanceBtn.addEventListener('click', () => openPrefsPage(dom.appearanceOverlay));
  dom.prefsNotificationsBtn.addEventListener('click', () => openPrefsPage(dom.notificationsOverlay));
  dom.prefsPrivacyBtn.addEventListener('click', () => openPrefsPage(dom.privacyOverlay));
  dom.prefsSecurityBtn.addEventListener('click', () => openPrefsPage(dom.securityOverlay));
  dom.prefsAccountBtn.addEventListener('click', () => openPrefsPage(dom.accountOverlay));
  dom.prefsDataBtn.addEventListener('click', () => openPrefsPage(dom.dataOverlay));
  dom.prefsAdminBtn.addEventListener('click', () => {
    if (!adminRightsOn()) return;
    resetStatusForm();
    openPrefsPage(dom.adminOverlay);
  });


  [
    [dom.appearanceOverlay, dom.appearanceClose],
    [dom.notificationsOverlay, dom.notificationsClose],
    [dom.privacyOverlay, dom.privacyClose],
    [dom.securityOverlay, dom.securityClose],
    [dom.accountOverlay, dom.accountClose],
    [dom.dataOverlay, dom.dataClose],
    [dom.adminOverlay, dom.adminClose],
  ].forEach(([overlay, closeBtn]) => {
    closeBtn.addEventListener('click', () => {
      ColorPicker.closeColorPicker();
      overlay.classList.add('hidden');
    });
    overlay.addEventListener('click', (event) => {
      if (event.target !== overlay) return;
      ColorPicker.closeColorPicker();
      overlay.classList.add('hidden');
    });
  });
  dom.prefsLogoutBtn.addEventListener('click', () => {
    closePrefsModal();
    logoutCurrentUser();
  });
  dom.prefsDeleteAccountBtn.addEventListener('click', deleteMyAccountClick);
  dom.prefsDeleteUserBtn.addEventListener('click', deleteAccountByUsernameClick);
  dom.prefsDeleteUserInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      deleteAccountByUsernameClick();
    }
  });
  dom.prefsSessionsBtn.addEventListener('click', openSessionsModal);
  dom.sessionsClose.addEventListener('click', closeSessionsModal);
  dom.sessionsOverlay.addEventListener('click', (event) => {
    if (event.target === dom.sessionsOverlay) closeSessionsModal();
  });
  dom.sessionsRefresh.addEventListener('click', loadSessions);
  dom.sessionsRevokeOthers.addEventListener('click', revokeOtherSessionsClick);

  dom.prefsThemeToggle.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-theme-choice]');
    if (btn) setTheme(btn.dataset.themeChoice);
  });

  // --- Уведомления: включение, звук, текст и типы чатов ---
  dom.notifEnabledToggle.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-notif-enabled]');
    if (!btn) return;
    const enabling = btn.dataset.notifEnabled === 'on';
    saveNotificationSetting('enabled', enabling);
    // Включение — это клик пользователя: удобный момент спросить разрешение.
    if (enabling && notificationsSupported() && Notification.permission === 'default') {
      requestNotificationPermission(true);
    }
  });
  dom.notifSound.addEventListener('change', () => saveNotificationSetting('sound', dom.notifSound.checked));
  dom.notifPreview.addEventListener('change', () => saveNotificationSetting('preview', dom.notifPreview.checked));
  dom.notifPrivate.addEventListener('change', () => saveNotificationSetting('private', dom.notifPrivate.checked));
  dom.notifGroup.addEventListener('change', () => saveNotificationSetting('group', dom.notifGroup.checked));
  dom.notifChannel.addEventListener('change', () => saveNotificationSetting('channel', dom.notifChannel.checked));
  dom.notifPermissionBtn.addEventListener('click', () => requestNotificationPermission());
  dom.notifTestBtn.addEventListener('click', sendTestNotification);
  dom.prefsPrivacyToggle.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-privacy-choice]');
    if (!btn || !state.user) return;
    const value = btn.dataset.privacyChoice === 'nobody' ? 'nobody' : 'all';
    try {
      await Chat.setLastSeenPrivacy(state.user.uid, value);
      state.settings.lastSeenPrivacy = value;
      renderPrefsModal();
      toast(value === 'nobody' ? 'Последний визит скрыт' : 'Последний визит виден всем');
    } catch (error) {
      console.error(error);
      toast('Не удалось сохранить настройку', 'error');
    }
  });
  dom.prefsPasswordBtn.addEventListener('click', openPasswordModal);
  // Сброс пароля письмом из «Настройки → Безопасность»: ссылка идёт на почту аккаунта.
  dom.prefsPasswordResetBtn.addEventListener('click', async () => {
    const btn = dom.prefsPasswordResetBtn;
    btn.disabled = true;
    btn.textContent = 'Отправляем…';
    try {
      const email = await Auth.sendPasswordResetToCurrentUser();
      toast(`Письмо со ссылкой для нового пароля отправлено на ${email}`, 'success');
    } catch (error) {
      console.error(error);
      toast(passwordResetError(error), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Сбросить пароль по почте';
    }
  });
  dom.passwordClose.addEventListener('click', closePasswordModal);
  dom.passwordCancel.addEventListener('click', closePasswordModal);
  dom.passwordOverlay.addEventListener('click', (event) => {
    if (event.target === dom.passwordOverlay) closePasswordModal();
  });
  dom.passwordForm.addEventListener('submit', submitPasswordChange);

  dom.prefsAdminToggle.addEventListener('change', async () => {
    if (!state.user) return;
    const enabled = dom.prefsAdminToggle.checked;
    try {
      await Chat.setAdminMode(state.user.uid, enabled);
      state.settings.adminMode = enabled;
      renderPrefsModal();
      // Админ-действия в открытых меню чата и профиле тоже скрываем сразу.
      refreshUsernameAdminBlocks();
      await refreshReservedNameCache(true);
      toast(enabled ? 'Админ-права включены' : 'Админ-права выключены');
    } catch (error) {
      console.error(error);
      toast('Не удалось изменить админ-права', 'error');
      renderPrefsModal();
    }
  });
}

