/**
 * Beacon — сервис авторизации.
 *
 * Firebase Auth используется только как «паспорт»:
 *  - Email/Password или Google (Google даёт только email и подтверждение входа);
 *  - профиль (юзернейм, имя, фамилия, био) пользователь заполняет сам —
 *    см. onboarding и редактирование профиля в app.js.
 *
 * В /users/$uid здесь создаётся только базовый узел { email, createdAt },
 * остальные поля пишет services/chat.js (updateUserProfile).
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { ref, get, set, update } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';
import { auth, db } from '../firebase-config.js?v=5';

/** Провайдер входа через Google (только email + вход, без профиля). */
const googleProvider = new GoogleAuthProvider();

/** Текущее время в unix-секундах (формат timestamp из structure-template.json). */
const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Подписка на изменение состояния авторизации.
 * Управляет роутингом экранов в app.js.
 * @param {(user: object|null) => void} callback
 * @returns {() => void} функция отписки
 */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Регистрация по email/паролю.
 * Имя/юзернейм пользователь укажет отдельным шагом (onboarding).
 * @returns {Promise<object>} Firebase user
 */
export async function registerWithEmail(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, String(email).trim(), password);
  return credential.user;
}

/**
 * Вход по email/паролю.
 * @returns {Promise<object>} Firebase user
 */
export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, String(email).trim(), password);
  return credential.user;
}

/**
 * Вход через Google (всплывающее окно).
 * Используется только для почты и вместо пароля — данные профиля не заполняет.
 * @returns {Promise<object>} Firebase user
 */
export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/** Выход из аккаунта. */
export function logout() {
  return signOut(auth);
}

/**
 * Создать базовый узел /users/$uid = { email, createdAt }, если его ещё нет,
 * и поддерживать email в актуальном состоянии. Остальные поля профиля
 * намеренно не трогает — их заполняет пользователь.
 *
 * @param {object} user — Firebase Auth user
 * @returns {Promise<object|null>} текущий узел пользователя
 */
export async function ensureUserRecord(user) {
  if (!user) return null;

  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);
  const email = (user.email || '').toLowerCase();

  if (!snapshot.exists()) {
    const record = { email, createdAt: nowSeconds() };
    await set(userRef, record);
    return record;
  }

  const existing = snapshot.val() || {};
  if (email && existing.email !== email) await update(userRef, { email });
  return { ...existing, email };
}

/** Человекочитаемые сообщения об ошибках Firebase Auth. */
const AUTH_ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Этот email уже зарегистрирован',
  'auth/invalid-email': 'Некорректный email',
  'auth/weak-password': 'Слишком слабый пароль (минимум 6 символов)',
  'auth/missing-password': 'Введите пароль',
  'auth/user-not-found': 'Пользователь не найден',
  'auth/wrong-password': 'Неверный пароль',
  'auth/invalid-credential': 'Неверный email или пароль',
  'auth/too-many-requests': 'Слишком много попыток входа. Попробуйте позже',
  'auth/network-request-failed': 'Проблема с сетью. Проверьте подключение',
  'auth/popup-closed-by-user': 'Окно входа было закрыто',
  'auth/cancelled-popup-request': 'Окно входа было закрыто',
  'auth/popup-blocked': 'Браузер заблокировал всплывающее окно',
  'auth/operation-not-allowed': 'Этот способ входа не включён в Firebase Console',
  'auth/unauthorized-domain': 'Домен не авторизован в Firebase Console',
};

/**
 * Преобразовать ошибку Firebase Auth в понятный текст.
 * @param {Error & {code?: string}} error
 */
export function getAuthErrorMessage(error) {
  if (!error) return 'Неизвестная ошибка';
  return AUTH_ERROR_MESSAGES[error.code] || error.message || 'Что-то пошло не так';
}
