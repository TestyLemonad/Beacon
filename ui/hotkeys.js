import { closeTargetAdmin } from './admin-target.js?v=77';
import { closeAliasesModal, closeInvitesModal, closeReservedModal } from './admin-usernames.js?v=77';
import { closeChatCtxMenu } from './chat-list-menu.js?v=77';
import { closeArchiveModal, closeDevPromoModal } from './chat-list.js?v=77';
import { closeChatMenu } from './chat-menu.js?v=77';
import { closeSettingsModal } from './chat-settings.js?v=77';
import { dom } from './dom.js?v=77';
import { closeCommentsModal, closePollModal, closeStatsModal } from './extras.js?v=77';
import { closeDeleteChoice, closeForwardModal, closeMsgMenu, stopTextSelection } from './message-menu.js?v=77';
import { closeModal } from './new-chat.js?v=77';
import { closePrefsModal, closeSessionsModal, closeTopPrefsPage } from './prefs.js?v=77';
import { closeProfileModal } from './profile-modal.js?v=77';

/**
 * Глобальные горячие клавиши, Escape и запрет масштабирования
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/** Навесить обработчики интерфейса этого модуля. */
export function initHotkeys() {
  // --- Escape закрывает верхнюю открытую модалку ---
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!dom.chatCtxOverlay.classList.contains('hidden')) {
      closeChatCtxMenu();
      return;
    }
    if (!dom.devPromoOverlay.classList.contains('hidden')) {
      closeDevPromoModal();
      return;
    }
    if (!dom.statsOverlay.classList.contains('hidden')) {
      closeStatsModal();
      return;
    }
    if (!dom.commentsOverlay.classList.contains('hidden')) {
      closeCommentsModal();
      return;
    }
    if (!dom.pollOverlay.classList.contains('hidden')) {
      closePollModal();
      return;
    }
    if (!dom.archiveOverlay.classList.contains('hidden')) {
      closeArchiveModal();
      return;
    }
    if (!dom.sessionsOverlay.classList.contains('hidden')) {
      closeSessionsModal();
      return;
    }
    if (!dom.invitesOverlay.classList.contains('hidden')) {
      closeInvitesModal();
      return;
    }
    if (!dom.reservedOverlay.classList.contains('hidden')) {
      closeReservedModal();
      return;
    }
    if (!dom.aliasesOverlay.classList.contains('hidden')) {
      closeAliasesModal();
      return;
    }
    if (!dom.targetAdminOverlay.classList.contains('hidden')) {
      closeTargetAdmin();
      return;
    }
    if (closeTopPrefsPage()) return;
    if (!dom.prefsOverlay.classList.contains('hidden')) {
      closePrefsModal();
      return;
    }
    if (!dom.msgMenuOverlay.classList.contains('hidden')) {
      closeMsgMenu();
      return;
    }
    if (!dom.deleteChoiceOverlay.classList.contains('hidden')) {
      closeDeleteChoice();
      return;
    }
    if (!dom.forwardOverlay.classList.contains('hidden')) {
      closeForwardModal();
      return;
    }
    if (!dom.chatMenuOverlay.classList.contains('hidden')) {
      closeChatMenu();
      return;
    }
    if (!dom.settingsAdminsOverlay.classList.contains('hidden')) {
      dom.settingsAdminsOverlay.classList.add('hidden');
      return;
    }
    if (!dom.settingsMembersOverlay.classList.contains('hidden')) {
      dom.settingsMembersOverlay.classList.add('hidden');
      return;
    }
    if (!dom.settingsOverlay.classList.contains('hidden')) {
      closeSettingsModal();
      return;
    }
    if (!dom.blockedOverlay.classList.contains('hidden')) {
      dom.blockedOverlay.classList.add('hidden');
      return;
    }
    if (!dom.profileOverlay.classList.contains('hidden')) {
      closeProfileModal();
      return;
    }
    if (!dom.modalOverlay.classList.contains('hidden')) closeModal();
    if (document.querySelector('.message.text-selectable')) stopTextSelection();
  });

  // ТВ-пульт и клавиатура: Enter/Space на строке чата открывают её.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (target instanceof HTMLElement && target.classList.contains('chat-item')) {
      event.preventDefault();
      target.click();
    }
  });

  /* ============================================================
   *  Запрет масштабирования страницы
   * ============================================================ */

  // Мета-тег user-scalable=no iOS игнорирует, поэтому «щипок» глушим событиями.
  // Одиночный скролл и drag при этом остаются рабочими.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  });

  // Два пальца на экране — это масштаб, а не прокрутка.
  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });
}

