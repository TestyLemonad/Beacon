/**
 * Beacon — конфигурация и инициализация Firebase.
 *
 * SDK подключается по CDN в модульном режиме (ESM), поэтому сборщики
 * (Webpack/Vite) не нужны — достаточно статической раздачи файлов.
 *
 * Экспортирует готовые экземпляры Auth и Realtime Database,
 * которые используют сервисы из папки services/.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js';

/** Веб-конфигурация проекта (testy-beacon). */
export const firebaseConfig = {
  apiKey: 'AIzaSyBTp7gI9VnUOFDJihISaJzRP6HO6VO81_Y',
  authDomain: 'testy-beacon.firebaseapp.com',
  databaseURL: 'https://testy-beacon-default-rtdb.firebaseio.com',
  projectId: 'testy-beacon',
  storageBucket: 'testy-beacon.firebasestorage.app',
  messagingSenderId: '652393614900',
  appId: '1:652393614900:web:3c3fbf10c5e71624364461',
  measurementId: 'G-SEQL61H345',
};

// Инициализируем сервисы, которые нужны приложению: Auth + RTDB.
// Analytics сознательно не подключаем — для мессенджера он не нужен.
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
