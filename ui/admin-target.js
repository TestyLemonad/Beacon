import * as Chat from '../services/chat.js?v=77';
import * as ColorPicker from '../color-picker.js?v=77';
import * as Emoji from '../emoji.js?v=77';
import { ALIAS_SKIP_REASONS } from './admin-usernames.js?v=77';
import { normalizeHex } from './avatar-editor.js?v=77';
import { renderChatList } from './chat-list.js?v=77';
import { renderChatMenu } from './chat-menu.js?v=77';
import { renderMainPanel } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { renderProfileAdminRow, renderProfileAliases } from './profile-modal.js?v=77';
import { adminRightsOn, aliasesForTarget, applyAvatar, applyChatAvatar, applyProfileAvatar, buildStatusBadge, chatStatusFor, getChatTitle, getProfileName, readableStatusTextColor, userStatusFor } from './profile-view.js?v=77';
import { renderSearchResults } from './search.js?v=77';
import { state } from './state.js?v=77';
import { clearStatusOfTarget, statusWriteError, writeStatusToTarget } from './status-admin.js?v=77';
import { createEl, toast } from './utils.js?v=77';

/**
 * Карточка цели для супер-админа: юзернеймы, резерв, статус, удаление
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Юзернеймы в профилях: быстрые операции супер-админа
 *  (дублируют разделы настроек для конкретного пользователя/чата)
 * ============================================================ */

/** Имена из /reserved_usernames для подписи «зарезервирован» в профиле. */
const reservedNameCache = { names: new Set(), loadedAt: 0, loading: null };

/** Обновить кэш зарезервированных имён и перерисовать открытые профили. */
export async function refreshReservedNameCache(force = false) {
  if (!adminRightsOn()) {
    reservedNameCache.names = new Set();
    reservedNameCache.loadedAt = Date.now();
    refreshUsernameAdminBlocks();
    return;
  }
  if (!force && Date.now() - reservedNameCache.loadedAt < 30000) return;
  if (reservedNameCache.loading) return reservedNameCache.loading;

  reservedNameCache.loading = Chat.listReservedUsernames()
    .then((items) => {
      reservedNameCache.names = new Set(items.map((item) => item.name));
      reservedNameCache.loadedAt = Date.now();
    })
    .catch((error) => {
      console.error('Не удалось загрузить зарезервированные юзернеймы:', error);
      reservedNameCache.loadedAt = Date.now();
    })
    .finally(() => {
      reservedNameCache.loading = null;
      refreshUsernameAdminBlocks();
    });

  return reservedNameCache.loading;
}

/** Перерисовать админ-блоки в открытых профиле, меню чата и карточке цели. */
export function refreshUsernameAdminBlocks() {
  if (!dom.chatMenuOverlay.classList.contains('hidden')) renderChatMenu();
  if (!dom.profileOverlay.classList.contains('hidden')) renderProfileAliases();
  if (!dom.targetAdminOverlay.classList.contains('hidden')) {
    if (!adminRightsOn()) closeTargetAdmin();
    else renderTargetAdmin();
  }
}

/**
 * Карточка цели для супер-админа: дополнительные имена, резерв основного,
 * статус и удаление аккаунта. Открывается из профиля, меню чата и раздела
 * «Администрирование» — сам профиль остаётся компактным.
 */
const targetAdminUi = {
  type: 'user',        // 'user' | 'chat' — как в API статусов
  aliasType: 'user',   // 'user' | 'channel' | 'group' — как в /username_aliases
  id: '',
  username: '',
  statusKind: 'emoji',
};

/** Статус цели карточки (null, если статуса нет). */
function targetAdminStatus() {
  if (!targetAdminUi.id) return null;
  return targetAdminUi.type === 'chat'
    ? chatStatusFor(targetAdminUi.id)
    : userStatusFor(targetAdminUi.id);
}

/** Открыть карточку юзернеймов и статуса для пользователя или чата. */
export function openTargetAdmin(target) {
  if (!target?.id || !adminRightsOn()) return;

  targetAdminUi.type = target.type === 'user' ? 'user' : 'chat';
  targetAdminUi.aliasType = target.type === 'channel'
    ? 'channel'
    : target.type === 'group' ? 'group' : 'user';
  targetAdminUi.id = target.id;
  targetAdminUi.username = target.username || '';
  targetAdminUi.statusKind = 'emoji';

  dom.targetAdminAliasInput.value = '';
  dom.targetAdminStatusValue.value = '';
  dom.targetAdminStatusColor.value = Chat.STATUS_DEFAULT_COLOR;
  ColorPicker.syncColorChip(dom.targetAdminStatusColorPick, dom.targetAdminStatusColor);
  dom.targetAdminStatusError.classList.add('hidden');
  dom.targetAdminDeleteError.classList.add('hidden');
  renderTargetAdmin();
  dom.targetAdminOverlay.classList.remove('hidden');
  refreshReservedNameCache();
}

export function closeTargetAdmin() {
  ColorPicker.closeColorPicker();
  dom.targetAdminOverlay.classList.add('hidden');
}

/** Перерисовать карточку цели целиком. */
function renderTargetAdmin() {
  if (!targetAdminUi.id) return;
  renderTargetAdminHead();
  renderTargetAliases();
  renderTargetReserve();
  syncTargetStatusKind();
  renderTargetStatusPreview();
  renderTargetStatusCurrent();

  // Удалять можно только чужой обычный аккаунт.
  const profile = targetAdminUi.type === 'user'
    ? Chat.getCachedUserProfile(targetAdminUi.id)
    : null;
  const canDelete = targetAdminUi.type === 'user'
    && targetAdminUi.id !== state.user?.uid
    && !state.rootAdmins.has(targetAdminUi.id)
    && !profile?.deleted;
  dom.targetAdminDeleteField.classList.toggle('hidden', !canDelete);
}

/** Перерисовать карточку цели, если она открыта. */
export function refreshTargetAdminCard() {
  if (!dom.targetAdminOverlay.classList.contains('hidden')) renderTargetAdmin();
  if (!dom.profileOverlay.classList.contains('hidden')) renderProfileAdminRow();
}

/** Шапка карточки: аватар, название и тип цели. */
function renderTargetAdminHead() {
  let title = '';
  let kind = 'Пользователь';

  if (targetAdminUi.type === 'chat') {
    const chat = state.chats.get(targetAdminUi.id);
    if (chat) {
      applyChatAvatar(dom.targetAdminAvatar, targetAdminUi.id, chat);
      title = getChatTitle(chat);
    } else {
      applyAvatar(dom.targetAdminAvatar, targetAdminUi.id, '?');
    }
    kind = chat?.type === 'channel' ? 'Канал' : 'Группа';
  } else {
    const profile = Chat.getCachedUserProfile(targetAdminUi.id);
    applyProfileAvatar(dom.targetAdminAvatar, profile, targetAdminUi.id);
    title = getProfileName(profile) || 'Пользователь';
  }

  dom.targetAdminTitle.textContent = title || 'Без названия';
  dom.targetAdminMeta.textContent = [targetAdminUi.username ? '@' + targetAdminUi.username : '', kind]
    .filter(Boolean)
    .join(' · ');
}

/** Список дополнительных имён с кнопкой «Забрать». */
function renderTargetAliases() {
  const list = dom.targetAdminAliasList;
  list.innerHTML = '';

  const aliases = aliasesForTarget(targetAdminUi.aliasType, targetAdminUi.id);
  if (!aliases.length) {
    list.append(createEl('div', 'admin-empty', 'Дополнительных имён пока нет.'));
    return;
  }

  aliases.forEach((alias) => {
    const row = createEl('div', 'username-admin-row');
    row.append(createEl('span', 'reserved-name', '@' + alias.name));
    const remove = createEl('button', 'btn ghost reserved-remove', 'Забрать');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Забрать @${alias.name}? Оно перестанет вести на этот профиль.`)) return;
      remove.disabled = true;
      try {
        await Chat.removeUsernameAliases([alias.name]);
        toast(`@${alias.name} больше не дополнительный`, 'success');
        renderTargetAliases();
      } catch (error) {
        console.error(error);
        toast(error?.message || 'Не удалось забрать юзернейм', 'error');
      } finally {
        remove.disabled = false;
      }
    });
    row.append(remove);
    list.append(row);
  });
}

/** Кнопка резерва основного имени. */
function renderTargetReserve() {
  const username = targetAdminUi.username;
  dom.targetAdminReserveField.classList.toggle('hidden', !username);
  if (!username) return;
  const reserved = reservedNameCache.names.has(username);
  dom.targetAdminReserve.textContent = reserved
    ? `Снять резерв с @${username}`
    : `Зарезервировать @${username}`;
}

/** Показать/скрыть поля, которые зависят от типа статуса. */
function syncTargetStatusKind() {
  const isText = targetAdminUi.statusKind === 'text';
  dom.targetAdminStatusKind.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusKind === (isText ? 'text' : 'emoji'));
  });
  dom.targetAdminStatusColorField.classList.toggle('hidden', !isText);
  dom.targetAdminStatusEmoji.classList.toggle('hidden', isText);
  dom.targetAdminStatusValue.maxLength = isText ? Chat.STATUS_TEXT_MAX : 24;
  dom.targetAdminStatusValue.placeholder = isText
    ? `Текст до ${Chat.STATUS_TEXT_MAX} символов`
    : 'Любой эмодзи';
  dom.targetAdminStatusSave.textContent = isText ? 'Выдать текст' : 'Выдать эмодзи';
  dom.targetAdminStatusClear.textContent = targetAdminUi.type === 'chat' ? 'Снять у чата' : 'Снять';
}

/** Строка «Сейчас: …» с текущим статусом цели. */
function renderTargetStatusCurrent() {
  const node = dom.targetAdminStatusCurrent;
  node.textContent = '';
  const status = targetAdminStatus();
  if (!status) {
    node.classList.add('hidden');
    return;
  }
  node.classList.remove('hidden');
  node.append(createEl('span', 'status-editor-label', 'Сейчас:'));
  node.append(buildStatusBadge(status));
  Emoji.parse(node);
}

/** Живой предпросмотр статуса из полей карточки. */
function renderTargetStatusPreview() {
  const node = dom.targetAdminStatusPreview;
  node.innerHTML = '';

  const value = String(dom.targetAdminStatusValue.value || '').trim();
  if (!value) {
    node.append(createEl('span', 'status-preview-hint', 'Предпросмотр статуса'));
    return;
  }

  const kind = targetAdminUi.statusKind;
  const badge = createEl('span', `user-status user-status-${kind}`);
  badge.textContent = kind === 'text'
    ? [...value].slice(0, Chat.STATUS_TEXT_MAX).join('')
    : value;
  if (kind === 'text') {
    const color = normalizeHex(dom.targetAdminStatusColor.value) || Chat.STATUS_DEFAULT_COLOR;
    badge.style.background = color;
    badge.style.color = readableStatusTextColor(color);
  }
  node.append(badge);
  Emoji.parse(badge);
}

function showTargetStatusError(message) {
  dom.targetAdminStatusError.textContent = message;
  dom.targetAdminStatusError.classList.remove('hidden');
}

/** Выдать или заменить статус цели. */
async function saveTargetStatus() {
  if (!adminRightsOn() || !targetAdminUi.id) return;

  const kind = targetAdminUi.statusKind;
  const value = String(dom.targetAdminStatusValue.value || '').trim();
  if (!value) {
    showTargetStatusError(kind === 'text' ? 'Введите текст статуса' : 'Выберите эмодзи');
    dom.targetAdminStatusValue.focus();
    return;
  }
  if (kind === 'emoji' && !/\p{Extended_Pictographic}/u.test(value)) {
    showTargetStatusError('В режиме «Эмодзи» нужен эмодзи — или переключитесь на «Текст»');
    dom.targetAdminStatusValue.focus();
    return;
  }

  dom.targetAdminStatusError.classList.add('hidden');
  dom.targetAdminStatusSave.disabled = true;
  try {
    const hadStatus = Boolean(targetAdminStatus());
    await writeStatusToTarget(
      { type: targetAdminUi.type, id: targetAdminUi.id },
      { kind, value, color: normalizeHex(dom.targetAdminStatusColor.value) || Chat.STATUS_DEFAULT_COLOR },
    );
    toast(hadStatus ? 'Статус обновлён' : 'Статус выдан', 'success');
    dom.targetAdminStatusValue.value = '';
    renderTargetStatusPreview();
    renderTargetStatusCurrent();
  } catch (error) {
    console.error(error);
    showTargetStatusError(statusWriteError(error));
  } finally {
    dom.targetAdminStatusSave.disabled = false;
    syncTargetStatusKind();
  }
}

/** Снять статус цели. */
async function clearTargetStatus() {
  if (!adminRightsOn() || !targetAdminUi.id) return;

  dom.targetAdminStatusError.classList.add('hidden');
  if (!targetAdminStatus()) {
    showTargetStatusError(targetAdminUi.type === 'chat'
      ? 'У этого чата нет статуса'
      : 'У этого пользователя нет статуса');
    return;
  }

  const what = targetAdminUi.type === 'chat' ? 'чата' : 'пользователя';
  const label = targetAdminUi.username ? ' @' + targetAdminUi.username : '';
  if (!window.confirm(`Снять статус ${what}${label}?`)) return;

  dom.targetAdminStatusClear.disabled = true;
  try {
    await clearStatusOfTarget({ type: targetAdminUi.type, id: targetAdminUi.id });
    toast('Статус снят', 'success');
    dom.targetAdminStatusValue.value = '';
    renderTargetStatusPreview();
    renderTargetStatusCurrent();
  } catch (error) {
    console.error(error);
    showTargetStatusError(statusWriteError(error));
  } finally {
    dom.targetAdminStatusClear.disabled = false;
  }
}

/** Выдать дополнительное имя цели. */
async function submitTargetAlias() {
  if (!adminRightsOn() || !targetAdminUi.id) return;

  const names = dom.targetAdminAliasInput.value.trim();
  if (!names) {
    dom.targetAdminAliasInput.focus();
    return;
  }

  dom.targetAdminAliasAdd.disabled = true;
  try {
    const result = await Chat.assignUsernameAliases({
      names,
      type: targetAdminUi.aliasType,
      target: targetAdminUi.id,
      uid: state.user.uid,
    });
    dom.targetAdminAliasInput.value = '';
    if (result.added.length) {
      toast(`Выдано имён: ${result.added.length}`, 'success');
      renderTargetAliases();
    } else {
      const skipped = result.skipped || [];
      const reason = skipped[0] ? ALIAS_SKIP_REASONS[skipped[0].reason] : '';
      toast(reason ? `Не выдано: ${reason}` : 'Новые имена не выданы: все пропущены');
    }
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось выдать юзернеймы', 'error');
  } finally {
    dom.targetAdminAliasAdd.disabled = false;
  }
}

/** Поставить или снять резерв основного имени цели. */
async function toggleTargetReserve() {
  const username = targetAdminUi.username;
  if (!adminRightsOn() || !username) return;

  dom.targetAdminReserve.disabled = true;
  try {
    if (reservedNameCache.names.has(username)) {
      await Chat.releaseReservedUsernames([username]);
      toast(`@${username} снят с резерва`, 'success');
    } else {
      const result = await Chat.reserveUsernameForTarget({
        type: targetAdminUi.aliasType,
        target: targetAdminUi.id,
        uid: state.user.uid,
      });
      toast(result.added
        ? `@${result.name} зарезервирован`
        : `@${result.name} уже был зарезервирован`, 'success');
    }
    await refreshReservedNameCache(true);
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось изменить резерв', 'error');
  } finally {
    dom.targetAdminReserve.disabled = false;
  }
}

/** Удалить аккаунт цели (только чужой обычный пользователь). */
async function deleteTargetAccount() {
  if (!adminRightsOn() || targetAdminUi.type !== 'user' || state.accountDeletionInProgress) return;

  const uid = targetAdminUi.id;
  if (!uid || uid === state.user?.uid || state.rootAdmins.has(uid)) return;

  const profile = Chat.getCachedUserProfile(uid);
  const name = getProfileName(profile) || '@' + targetAdminUi.username;
  const confirmed = window.confirm(
    `Удалить аккаунт «${name}» (@${targetAdminUi.username})?\n\n` +
    'Профиль, настройки, чаты и подписки будут удалены. Сообщения останутся, ' +
    'а имя изменится на «Удалённый аккаунт». Пользователь потеряет доступ к мессенджеру.',
  );
  if (!confirmed) return;

  dom.targetAdminDelete.disabled = true;
  dom.targetAdminDeleteError.classList.add('hidden');
  try {
    await Chat.deleteUserAccount(uid, { deletedBy: state.user.uid, ban: true });
    toast(`Аккаунт ${name} удалён`, 'success');
    closeTargetAdmin();
    renderChatList();
    renderMainPanel();
    if (state.search.query) renderSearchResults();
  } catch (error) {
    console.error(error);
    dom.targetAdminDeleteError.textContent = 'Не удалось удалить аккаунт';
    dom.targetAdminDeleteError.classList.remove('hidden');
  } finally {
    dom.targetAdminDelete.disabled = false;
  }
}


/** Навесить обработчики интерфейса этого модуля. */
export function initAdminTarget() {
  // --- Карточка цели: юзернеймы, статус и удаление аккаунта ---
  dom.targetAdminClose.addEventListener('click', closeTargetAdmin);
  dom.targetAdminOverlay.addEventListener('click', (event) => {
    if (event.target === dom.targetAdminOverlay) closeTargetAdmin();
  });
  dom.targetAdminAliasAdd.addEventListener('click', submitTargetAlias);
  dom.targetAdminAliasInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitTargetAlias();
    }
  });
  dom.targetAdminReserve.addEventListener('click', toggleTargetReserve);
  dom.targetAdminStatusKind.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-status-kind]');
    if (!btn) return;
    targetAdminUi.statusKind = btn.dataset.statusKind === 'text' ? 'text' : 'emoji';
    syncTargetStatusKind();
    renderTargetStatusPreview();
  });
  dom.targetAdminStatusValue.addEventListener('input', renderTargetStatusPreview);
  dom.targetAdminStatusColor.addEventListener('input', renderTargetStatusPreview);
  ColorPicker.bindColorField({ chip: dom.targetAdminStatusColorPick, input: dom.targetAdminStatusColor });
  dom.targetAdminStatusSave.addEventListener('click', saveTargetStatus);
  dom.targetAdminStatusClear.addEventListener('click', clearTargetStatus);
  dom.targetAdminStatusEmoji.addEventListener('click', () => {
    Emoji.openPicker({
      mode: 'insert',
      anchor: dom.targetAdminStatusEmoji,
      trigger: dom.targetAdminStatusEmoji,
      onSelect: (emoji) => {
        dom.targetAdminStatusValue.value = emoji;
        renderTargetStatusPreview();
        Emoji.closePicker();
      },
    });
  });
  dom.targetAdminDelete.addEventListener('click', deleteTargetAccount);
  dom.profileAdminOpen.addEventListener('click', () => {
    if (!state.user || !adminRightsOn()) return;
    openTargetAdmin({
      type: 'user',
      id: state.user.uid,
      username: state.profile?.username || '',
    });
  });
}

