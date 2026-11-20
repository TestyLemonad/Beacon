import * as Auth from '../services/auth.js?v=77';
import * as Chat from '../services/chat.js?v=77';
import * as Invites from '../services/invites.js?v=77';
import * as Sessions from '../services/sessions.js?v=77';
import { hideBannedScreen } from './access.js?v=77';
import { flushDrafts } from './composer.js?v=77';
import { dom } from './dom.js?v=77';
import { closePrefsModal } from './prefs.js?v=77';
import { saveProfileForm } from './profile-modal.js?v=77';
import { enqueueRoute, enterMessenger } from './router.js?v=77';
import { deepLink, state } from './state.js?v=77';
import { toast } from './utils.js?v=77';

/**
 * Экраны входа, регистрации, инвайта и онбординга
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let authMode = 'login';     // 'login' | 'register'
let pendingGoogleLink = null; // { email, pendingCredential } — ждём пароль для привязки Google

/* ============================================================
 *  Экраны: авторизация / онбординг / мессенджер
 * ============================================================ */

export function showAuthScreen() {
  closePrefsModal();
  dom.messengerScreen.classList.add('hidden');
  dom.onboardingScreen.classList.add('hidden');
  hideInviteGateScreen();
  dom.authScreen.classList.remove('hidden');
  hideBannedScreen();
  document.body.classList.remove('chat-open');
  dom.authPassword.value = '';
  // Панель сброса пароля не должна оставаться открытой после выхода.
  closeAuthResetPanel();
  dom.authForgotBtn.classList.toggle('hidden', authMode === 'register');
  hideAuthError();
}

/**
 * Убрать экран загрузки: нужный экран (вход, онбординг или мессенджер)
 * уже показан. Повторные вызовы безопасны.
 */
export function hideBootScreen() {
  if (!dom.bootScreen || dom.bootScreen.classList.contains('hidden')) return;
  dom.bootScreen.classList.add('hidden');
}

/**
 * Выход прямо с экрана загрузки: не ждём восстановления сессии, если вход
 * завис или нужно войти под другим аккаунтом. Пока модуль не загрузился,
 * кнопка работает по запасному пути из index.html (чистит сохранённый вход).
 */
window.beaconBootLogout = async () => {
  if (!dom.bootLogoutBtn) return;
  const prevStatus = dom.bootStatus ? dom.bootStatus.textContent : '';
  dom.bootLogoutBtn.disabled = true;
  if (dom.bootStatus) dom.bootStatus.textContent = 'Выходим…';

  try {
    await logoutCurrentUser();
  } catch (error) {
    console.error('Не удалось выйти из аккаунта:', error);
  }

  // При успешном выходе экран загрузки закроет маршрут авторизации.
  if (dom.bootScreen && !dom.bootScreen.classList.contains('hidden')) {
    // Входа могло уже не быть (устаревший ключ в хранилище) — тогда просто
    // открываем форму входа, иначе она так и останется за экраном загрузки.
    if (!state.user) {
      showAuthScreen();
      hideBootScreen();
      return;
    }
    dom.bootLogoutBtn.disabled = false;
    if (dom.bootStatus) dom.bootStatus.textContent = prevStatus;
    toast('Не удалось выйти из аккаунта', 'error');
  }
};

/** Экран требования инвайт-кода: аккаунт создан, но профиль ещё не разрешён. */
export function showInviteGateScreen(user) {
  closePrefsModal();
  dom.authScreen.classList.add('hidden');
  dom.onboardingScreen.classList.add('hidden');
  dom.messengerScreen.classList.add('hidden');
  hideBannedScreen();
  document.body.classList.remove('chat-open');

  dom.inviteGateEmail.textContent = user?.email || '';
  if (!dom.inviteGateCode.value) {
    dom.inviteGateCode.value = Invites.formatInviteCode(dom.authInvite.value || deepLink.invite || '');
  }

  if (state.lastInviteError) {
    dom.inviteGateError.textContent = state.lastInviteError;
    dom.inviteGateError.classList.remove('hidden');
  } else {
    dom.inviteGateError.classList.add('hidden');
  }

  dom.inviteGateScreen.classList.remove('hidden');
  setTimeout(() => dom.inviteGateCode.focus(), 0);
}

export function hideInviteGateScreen() {
  dom.inviteGateScreen.classList.add('hidden');
  dom.inviteGateError.classList.add('hidden');
  dom.inviteGateError.textContent = '';
}

/** Убрать ?invite_code= из адресной строки после успешного применения кода. */
export function clearInviteParamFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('invite_code')) return;
    url.searchParams.delete('invite_code');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', next);
  } catch {
    // История недоступна — не критично.
  }
}

/** Экран первого заполнения профиля после входа. */
export function showOnboardingScreen() {
  dom.authScreen.classList.add('hidden');
  dom.messengerScreen.classList.add('hidden');
  hideInviteGateScreen();
  dom.onboardingScreen.classList.remove('hidden');
  document.body.classList.remove('chat-open');

  dom.onboardingEmail.textContent = state.user?.email || '';
  dom.obUsername.value = state.profile?.username || '';
  dom.obFirstname.value = state.profile?.firstName || '';
  dom.obLastname.value = state.profile?.lastName || '';
  dom.obBio.value = state.profile?.bio || '';
  dom.onboardingError.classList.add('hidden');
  setTimeout(() => dom.obUsername.focus(), 0);
}


function showAuthError(message) {
  dom.authError.textContent = message;
  dom.authError.classList.remove('hidden');
}

function hideAuthError() {
  dom.authError.classList.add('hidden');
}

/** Понятный текст: ошибки инвайтов уже на русском, остальные — из Auth. */
function authFormError(error) {
  if (String(error?.code || '').startsWith('beacon/')) {
    return error.message || 'Не удалось применить инвайт-код';
  }
  return Auth.getAuthErrorMessage(error);
}

/** Текст ошибки сброса пароля: про письмо, а не про вход. */
export function passwordResetError(error) {
  const code = String(error?.code || '');
  if (code === 'auth/user-not-found') return 'Аккаунт с такой почтой не найден';
  if (code === 'auth/too-many-requests') return 'Слишком много запросов — попробуйте позже';
  return authFormError(error);
}

/* ---------- Сброс пароля письмом от Firebase ---------- */

/** Открыть на экране входа панель «пришлём ссылку на почту». */
function openAuthResetPanel() {
  hideAuthError();
  // Привязка Google и сброс пароля одновременно ни к чему.
  if (pendingGoogleLink) {
    pendingGoogleLink = null;
    dom.authLinkPanel.classList.add('hidden');
  }
  dom.authResetPanel.classList.remove('hidden');
  dom.authForgotBtn.classList.add('hidden');
  // Если в поле входа уже email — подставляем его, чтобы не набирать заново.
  const typed = dom.authEmail.value.trim();
  dom.authResetEmail.value = Auth.isEmailAddress(typed) ? typed : '';
  hideAuthResetStatus();
  dom.authResetEmail.focus();
}

/** Свернуть панель сброса и вернуть ссылку «Забыли пароль?». */
function closeAuthResetPanel() {
  dom.authResetPanel.classList.add('hidden');
  dom.authForgotBtn.classList.remove('hidden');
  hideAuthResetStatus();
  dom.authResetSubmit.disabled = false;
  dom.authResetSubmit.textContent = 'Отправить письмо';
}

function hideAuthResetStatus() {
  dom.authResetStatus.textContent = '';
  dom.authResetStatus.className = 'auth-reset-status hidden';
}

/** @param {'error'|'success'} kind */
function showAuthResetStatus(message, kind) {
  dom.authResetStatus.textContent = message;
  dom.authResetStatus.className = `auth-reset-status ${kind}`;
}

/** Отправить письмо со ссылкой для сброса пароля с экрана входа. */
async function submitAuthReset(event) {
  event.preventDefault();
  const value = dom.authResetEmail.value.trim();

  if (!value) {
    showAuthResetStatus('Введите email аккаунта', 'error');
    dom.authResetEmail.focus();
    return;
  }
  if (!Auth.isEmailAddress(value)) {
    showAuthResetStatus('Сброс работает только по почте — юзернейм не подойдёт', 'error');
    dom.authResetEmail.focus();
    return;
  }

  dom.authResetSubmit.disabled = true;
  dom.authResetSubmit.textContent = 'Отправляем…';
  try {
    const email = await Auth.sendPasswordReset(value);
    showAuthResetStatus(
      `Письмо со ссылкой для нового пароля отправлено на ${email}. Если его нет во «Входящих», загляните в «Спам».`,
      'success',
    );
  } catch (error) {
    console.error(error);
    showAuthResetStatus(passwordResetError(error), 'error');
  } finally {
    dom.authResetSubmit.disabled = false;
    dom.authResetSubmit.textContent = 'Отправить письмо';
  }
}

/** Переключение «Вход <-> Регистрация». */
function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === 'register';

  dom.authSubmit.textContent = isRegister ? 'Зарегистрироваться' : 'Войти';
  dom.authToggleMode.textContent = isRegister
    ? 'Уже есть аккаунт? Войти'
    : 'Нет аккаунта? Зарегистрироваться';
  dom.authPassword.autocomplete = isRegister ? 'new-password' : 'current-password';
  dom.authEmail.autocomplete = isRegister ? 'email' : 'username';
  dom.authIdentifierLabel.textContent = isRegister ? 'Email' : 'Email или юзернейм';
  dom.authIdentifierHint.textContent = isRegister
    ? 'Для регистрации нужна почта.'
    : 'Можно войти по почте или по @username.';
  dom.authEmail.placeholder = isRegister
    ? 'smotritel@mayak.ru'
    : 'smotritel@mayak.ru или @smotritel_mayaka';

  // Инвайт-код нужен только при регистрации.
  dom.authInviteField.classList.toggle('hidden', !isRegister);
  dom.authInvite.required = isRegister;
  dom.googleBtnLabel.textContent = isRegister ? 'Зарегистрироваться через Google' : 'Войти через Google';

  // Сброс пароля по письму — только для входа.
  closeAuthResetPanel();
  dom.authForgotBtn.classList.toggle('hidden', isRegister);

  hideAuthError();
}

function setAuthLoading(loading) {
  dom.authSubmit.disabled = loading;
  dom.googleBtn.disabled = loading;
  dom.authSubmit.textContent = loading
    ? 'Подождите…'
    : authMode === 'register' ? 'Зарегистрироваться' : 'Войти';
}


/** Выйти из аккаунта: сначала убрать запись сессии, потом signOut. */
export async function logoutCurrentUser() {
  flushDrafts();
  if (state.user && !state.myDeleted) Chat.setOfflinePresence(state.user.uid).catch(() => {});
  // Не блокируем выход, если сеть пропала: запись сессии — вспомогательная.
  await Promise.race([
    Sessions.stopSession().catch((error) => {
      console.warn('Не удалось остановить сессию:', error);
    }),
    new Promise((resolve) => window.setTimeout(resolve, 1200)),
  ]);
  try {
    await Auth.logout();
  } catch (error) {
    console.error(error);
    toast('Не удалось выйти из аккаунта', 'error');
  }
}


// --- Боковая панель ---
// Кнопка выхода перенесена в настройки (см. ниже).


/** Навесить обработчики интерфейса этого модуля. */
export function initAuthScreen() {
  // --- Экран авторизации ---
  dom.authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAuthError();
    setAuthLoading(true);

    const identifier = dom.authEmail.value.trim();
    const password = dom.authPassword.value;

    try {
      if (authMode === 'register') {
        if (!Auth.isEmailAddress(identifier)) {
          showAuthError('Для регистрации укажите email');
          return;
        }
        const code = Invites.normalizeInviteCode(dom.authInvite.value);
        if (!code) {
          showAuthError('Введите инвайт-код — без него регистрация закрыта');
          return;
        }
        try {
          await Invites.validateInviteCode(code);
        } catch (error) {
          showAuthError(authFormError(error));
          return;
        }
        // Код применим после входа: подтверждение пишется уже от имени аккаунта.
        state.pendingInviteCode = code;
        try {
          await Auth.registerWithEmail(identifier, password);
        } catch (error) {
          state.pendingInviteCode = '';
          throw error;
        }
      } else {
        state.pendingInviteCode = '';
        await Auth.loginWithIdentifier(identifier, password);
      }
    } catch (error) {
      showAuthError(authFormError(error));
    } finally {
      setAuthLoading(false);
    }
  });

  dom.authToggleMode.addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });

  // Инвайт-ссылка: /?invite_code=… — сразу открываем регистрацию и
  // подставляем код в поле.
  if (deepLink.invite) {
    dom.authInvite.value = Invites.formatInviteCode(deepLink.invite);
    setAuthMode('register');
  }

  // Приводим код к красивому виду после ввода.
  dom.authInvite.addEventListener('blur', () => {
    const code = Invites.normalizeInviteCode(dom.authInvite.value);
    dom.authInvite.value = code ? Invites.formatInviteCode(code) : '';
  });

  dom.googleBtn.addEventListener('click', async () => {
    hideAuthError();
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const code = Invites.normalizeInviteCode(dom.authInvite.value);
        if (!code) {
          showAuthError('Введите инвайт-код — без него регистрация закрыта');
          return;
        }
        try {
          await Invites.validateInviteCode(code);
        } catch (error) {
          showAuthError(authFormError(error));
          return;
        }
        state.pendingInviteCode = code;
      } else {
        // Вход: код не нужен. Если Google-аккаунт окажется новым,
        // приложение попросит инвайт отдельным экраном.
        state.pendingInviteCode = '';
      }

      const result = await Auth.loginWithGoogle();
      // Email уже занят аккаунтом с паролем: просим пароль и привязываем Google.
      if (result?.needsLink) {
        state.pendingInviteCode = '';
        pendingGoogleLink = { email: result.email, pendingCredential: result.pendingCredential };
        closeAuthResetPanel();
        dom.authLinkPanel.classList.remove('hidden');
        dom.authLinkPassword.value = '';
        dom.authLinkPassword.focus();
      }
    } catch (error) {
      state.pendingInviteCode = '';
      showAuthError(authFormError(error));
    } finally {
      setAuthLoading(false);
    }
  });

  // Завершение привязки Google к существующему аккаунту (пароль + link).
  dom.authLinkSubmit.addEventListener('click', async () => {
    if (!pendingGoogleLink) return;
    hideAuthError();
    dom.authLinkSubmit.disabled = true;
    try {
      await Auth.completeGoogleLink(pendingGoogleLink.email, dom.authLinkPassword.value, pendingGoogleLink.pendingCredential);
      pendingGoogleLink = null;
      dom.authLinkPanel.classList.add('hidden');
      // Дальше сработает watchAuthState и откроет мессенджер.
    } catch (error) {
      showAuthError(Auth.getAuthErrorMessage(error));
    } finally {
      dom.authLinkSubmit.disabled = false;
    }
  });
  dom.authLinkCancel.addEventListener('click', () => {
    pendingGoogleLink = null;
    dom.authLinkPanel.classList.add('hidden');
    hideAuthError();
  });

  // --- Сброс пароля письмом с экрана входа ---
  dom.authForgotBtn.addEventListener('click', openAuthResetPanel);
  dom.authResetCancel.addEventListener('click', closeAuthResetPanel);
  dom.authResetPanel.addEventListener('submit', submitAuthReset);

  // --- Экран требования инвайта (новый Google-аккаунт без кода) ---
  dom.inviteGateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const user = state.user;
    if (!user) return;

    const code = Invites.normalizeInviteCode(dom.inviteGateCode.value);
    if (!code) {
      dom.inviteGateError.textContent = 'Введите инвайт-код';
      dom.inviteGateError.classList.remove('hidden');
      dom.inviteGateCode.focus();
      return;
    }

    dom.inviteGateSubmit.disabled = true;
    dom.inviteGateSubmit.textContent = 'Проверяем…';
    try {
      await Invites.redeemInviteCode({ uid: user.uid, code });
      clearInviteParamFromUrl();
      hideInviteGateScreen();
      // Дальше — обычный маршрут: профиль, бан, онбординг или мессенджер.
      await enqueueRoute(user);
    } catch (error) {
      console.error(error);
      dom.inviteGateError.textContent = error?.message || 'Не удалось применить инвайт-код';
      dom.inviteGateError.classList.remove('hidden');
    } finally {
      dom.inviteGateSubmit.disabled = false;
      dom.inviteGateSubmit.textContent = 'Продолжить';
    }
  });

  dom.inviteGateLogout.addEventListener('click', () => {
    logoutCurrentUser();
  });

  // --- Юзернеймы: «@Test» и «test» — одно и то же ---
  /** Приводить юзернейм к канону прямо при вводе: без «@», в нижнем регистре. */
  function bindUsernameInput(input) {
    input.addEventListener('input', () => {
      const clean = Chat.normalizeUsername(input.value);
      if (clean !== input.value) input.value = clean;
    });
  }
  [dom.obUsername, dom.pfUsername, dom.privateUsername, dom.channelUsername, dom.groupUsername, dom.settingsUsername].forEach(bindUsernameInput);

  // --- Онбординг ---
  dom.onboardingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveProfileForm({
      usernameEl: dom.obUsername,
      firstNameEl: dom.obFirstname,
      lastNameEl: dom.obLastname,
      bioEl: dom.obBio,
      errorEl: dom.onboardingError,
      submitEl: dom.onboardingSubmit,
      onSuccess: () => {
        enterMessenger();
        toast(`Добро пожаловать в Beacon, ${state.profile?.firstName || ''}!`.trim(), 'success');
      },
    });
  });

  dom.onboardingLogout.addEventListener('click', () => {
    logoutCurrentUser();
  });
}

