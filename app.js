/**
 * Beacon — точка входа UI.
 *
 * Раньше весь интерфейс жил в этом файле одним модулем. Теперь он разложен
 * по папке ui/: состояние, DOM-ссылки, утилиты и экраны. Здесь только
 * подключение модулей и запуск обработчиков в том же порядке, что и раньше.
 */

import { initAccess } from './ui/access.js?v=77';
import { initAdminTarget } from './ui/admin-target.js?v=77';
import { initAdminUsernames } from './ui/admin-usernames.js?v=77';
import { initAuthScreen } from './ui/auth-screen.js?v=77';
import { initChatList } from './ui/chat-list.js?v=77';
import { initChatListMenu } from './ui/chat-list-menu.js?v=77';
import { initChatMenu } from './ui/chat-menu.js?v=77';
import { initChatSettings } from './ui/chat-settings.js?v=77';
import { initChatView } from './ui/chat-view.js?v=77';
import { initComposer } from './ui/composer.js?v=77';
import { initExtras } from './ui/extras.js?v=77';
import { initHotkeys } from './ui/hotkeys.js?v=77';
import { initMessageMenu } from './ui/message-menu.js?v=77';
import { initNewChat } from './ui/new-chat.js?v=77';
import { initPrefs } from './ui/prefs.js?v=77';
import { initProfileModal } from './ui/profile-modal.js?v=77';
import { initSearch } from './ui/search.js?v=77';
import { initStatusAdmin } from './ui/status-admin.js?v=77';
import { startRouter } from './ui/router.js?v=77';

// --- Обработчики интерфейса ---
// Порядок повторяет прежний файл: экраны входа, чаты, настройки, меню и лента.

initAuthScreen();
initStatusAdmin();
initChatList();
initAccess();
initPrefs();
initAdminTarget();
initAdminUsernames();
initChatListMenu();
initExtras();
initNewChat();
initProfileModal();
initSearch();
initChatSettings();
initHotkeys();
initComposer();
initChatView();
initChatMenu();
initMessageMenu();

// --- Маршрутизация по состоянию авторизации ---
startRouter();
