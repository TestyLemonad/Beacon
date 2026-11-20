import * as Chat from '../services/chat.js?v=77';
import * as Invites from '../services/invites.js?v=77';
import { dom } from './dom.js?v=77';
import { copyToClipboard } from './message-menu.js?v=77';
import { adminRightsOn } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { createEl, formatDayLabel, formatTime, toast } from './utils.js?v=77';

/**
 * Инвайт-коды, резерв и дополнительные юзернеймы (root-админы)
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

/* ============================================================
 *  Инвайт-коды (только root-админы)
 * ============================================================ */

const INVITE_STATUS_LABELS = {
  active: 'Активен',
  used: 'Использован',
  revoked: 'Отозван',
  expired: 'Истёк',
};

function openInvitesModal() {
  if (!state.user || !adminRightsOn()) return;
  dom.invitesError.classList.add('hidden');
  dom.invitesLoadError.classList.add('hidden');
  dom.invitesCreated.classList.add('hidden');
  dom.invitesCreated.innerHTML = '';
  dom.invitesNote.value = '';
  dom.invitesCount.value = '1';
  dom.invitesList.innerHTML = '';
  dom.invitesEmpty.classList.add('hidden');
  dom.invitesOverlay.classList.remove('hidden');
  loadInviteCodes();
}

export function closeInvitesModal() {
  dom.invitesOverlay.classList.add('hidden');
}

async function loadInviteCodes() {
  dom.invitesLoadError.classList.add('hidden');
  try {
    const codes = await Invites.listInviteCodes();
    renderInviteCodes(codes);
  } catch (error) {
    console.error(error);
    dom.invitesList.innerHTML = '';
    dom.invitesEmpty.classList.add('hidden');
    dom.invitesLoadError.textContent = error?.message || 'Не удалось загрузить инвайт-коды';
    dom.invitesLoadError.classList.remove('hidden');
  }
}

function renderInviteCodes(codes) {
  dom.invitesList.innerHTML = '';
  dom.invitesEmpty.classList.toggle('hidden', codes.length > 0);

  codes.forEach((record) => {
    const row = createEl('div', 'invite-row');
    const body = createEl('div', 'invite-row-body');

    const title = createEl('div', 'invite-row-title');
    title.append(createEl('span', 'invite-code-key', `#${record.codeKey.slice(0, 8)}`));
    title.append(createEl('span', `invite-status ${record.status}`,
      INVITE_STATUS_LABELS[record.status] || 'Неизвестно'));
    body.append(title);

    const meta = [];
    if (record.note) meta.push(record.note);
    const createdAt = Number(record.createdAt) || 0;
    if (createdAt) meta.push(`Создан: ${formatDayLabel(createdAt)}, ${formatTime(createdAt)}`);
    const usedAt = Number(record.redemption?.at) || 0;
    if (usedAt) meta.push(`Использован: ${formatDayLabel(usedAt)}, ${formatTime(usedAt)}`);
    const usedBy = String(record.redemption?.uid || '');
    if (usedBy) meta.push(`кем: ${usedBy.slice(0, 8)}…`);
    if (meta.length) body.append(createEl('div', 'invite-row-meta', meta.join(' · ')));

    row.append(body);

    if (record.status === 'active') {
      const revoke = createEl('button', 'btn ghost invite-revoke', 'Отозвать');
      revoke.type = 'button';
      revoke.addEventListener('click', () => revokeInviteClick(record, revoke));
      row.append(revoke);
    }

    dom.invitesList.append(row);
  });
}

async function revokeInviteClick(record, button) {
  if (!state.user) return;
  if (!window.confirm(`Отозвать код #${record.codeKey.slice(0, 8)}? Ссылка перестанет работать.`)) return;

  button.disabled = true;
  try {
    await Invites.revokeInviteCode(record.codeKey, state.user.uid);
    toast('Инвайт-код отозван', 'success');
    loadInviteCodes();
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось отозвать код', 'error');
  } finally {
    button.disabled = false;
  }
}

/** Показать только что созданные коды и ссылки — потом их не восстановить. */
function renderCreatedInviteCodes(created) {
  dom.invitesCreated.innerHTML = '';
  if (!created.length) {
    dom.invitesCreated.classList.add('hidden');
    return;
  }

  dom.invitesCreated.classList.remove('hidden');
  dom.invitesCreated.append(createEl('p', 'invites-created-hint',
    'Скопируйте код или ссылку сейчас: в базе хранятся только соль и хэш, восстановить код не получится.'));

  created.forEach((item) => {
    const row = createEl('div', 'invite-created-row');
    row.append(createEl('code', 'invite-created-code', item.code));

    const actions = createEl('div', 'invite-created-actions');

    const copyCode = createEl('button', 'btn ghost invite-mini-btn', 'Код');
    copyCode.type = 'button';
    copyCode.addEventListener('click', async () => {
      const copied = await copyToClipboard(item.code);
      toast(copied ? 'Код скопирован' : 'Не удалось скопировать', copied ? 'success' : 'error');
    });

    const copyLink = createEl('button', 'btn ghost invite-mini-btn', 'Ссылка');
    copyLink.type = 'button';
    copyLink.addEventListener('click', async () => {
      const copied = await copyToClipboard(item.link);
      toast(copied ? 'Ссылка скопирована' : 'Не удалось скопировать', copied ? 'success' : 'error');
    });

    actions.append(copyCode, copyLink);
    row.append(actions);
    dom.invitesCreated.append(row);
  });
}

function showInvitesError(message) {
  dom.invitesError.textContent = message;
  dom.invitesError.classList.remove('hidden');
}

/* ============================================================
 *  Резерв юзернеймов (только root-админы)
 * ============================================================ */

const RESERVED_STATUS_LABELS = {
  free: 'Свободен',
  user: 'Занят пользователем',
  channel: 'Занят каналом',
  group: 'Занят группой',
  alias: 'Выдан как доп.',
};

const RESERVED_SKIP_REASONS = {
  invalid: 'неверный формат',
  reserved: 'уже зарезервирован',
  user: 'занят пользователем',
  channel: 'занят каналом',
  group: 'занят группой',
  alias: 'выдан как дополнительный',
  missing: 'не был зарезервирован',
};

const reservedUi = {
  items: [],
  status: 'all',
  type: 'all',
  query: '',
};

function openReservedModal() {
  if (!state.user || !adminRightsOn()) return;

  reservedUi.items = [];
  reservedUi.status = 'all';
  reservedUi.type = 'all';
  reservedUi.query = '';

  dom.reservedInput.value = '';
  dom.reservedRemoveInput.value = '';
  dom.reservedSearch.value = '';
  dom.reservedTypeFilter.value = 'all';
  dom.reservedStatusFilter.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.statusFilter === 'all');
  });

  dom.reservedError.classList.add('hidden');
  dom.reservedRemoveError.classList.add('hidden');
  dom.reservedLoadError.classList.add('hidden');
  dom.reservedResult.classList.add('hidden');
  dom.reservedResult.textContent = '';
  dom.reservedList.innerHTML = '';
  dom.reservedEmpty.classList.add('hidden');
  dom.reservedCount.textContent = '';
  dom.reservedOverlay.classList.remove('hidden');
  loadReservedUsernames();
}

export function closeReservedModal() {
  dom.reservedOverlay.classList.add('hidden');
}

async function loadReservedUsernames() {
  dom.reservedLoadError.classList.add('hidden');
  dom.reservedCount.textContent = 'Загружаем…';
  try {
    reservedUi.items = await Chat.listReservedUsernames();
    renderReservedUsernames();
  } catch (error) {
    console.error(error);
    reservedUi.items = [];
    dom.reservedList.innerHTML = '';
    dom.reservedEmpty.classList.add('hidden');
    dom.reservedCount.textContent = '';
    dom.reservedLoadError.textContent = error?.message || 'Не удалось загрузить список';
    dom.reservedLoadError.classList.remove('hidden');
  }
}

function renderReservedUsernames() {
  dom.reservedList.innerHTML = '';

  const visible = reservedUi.items.filter((item) => {
    const statusMatch = reservedUi.status === 'all'
      || (reservedUi.status === 'free' ? item.status === 'free' : item.status !== 'free');
    const typeMatch = reservedUi.type === 'all' || item.status === reservedUi.type;
    const queryMatch = !reservedUi.query || item.name.includes(reservedUi.query);
    return statusMatch && typeMatch && queryMatch;
  });

  dom.reservedCount.textContent = reservedUi.items.length
    ? `Показано ${visible.length} из ${reservedUi.items.length}`
    : '';
  dom.reservedEmpty.classList.toggle('hidden', visible.length > 0);
  dom.reservedEmpty.textContent = reservedUi.items.length
    ? 'Ничего не найдено по фильтрам.'
    : 'Пока ничего не зарезервировано.';

  visible.forEach((item) => {
    const row = createEl('div', 'reserved-row');
    const body = createEl('div', 'reserved-row-body');

    const title = createEl('div', 'reserved-row-title');
    title.append(createEl('span', 'reserved-name', `@${item.name}`));
    title.append(createEl('span', `reserved-status ${item.status}`,
      RESERVED_STATUS_LABELS[item.status] || 'Неизвестно'));
    body.append(title);

    const meta = [];
    if (item.at) meta.push(`Зарезервирован: ${formatDayLabel(item.at)}`);
    if (item.by) meta.push(`кем: ${item.by.slice(0, 8)}…`);
    if (item.status !== 'free' && item.occupant) {
      meta.push(`владелец: ${item.occupant.slice(0, 12)}…`);
    }
    if (meta.length) body.append(createEl('div', 'reserved-row-meta', meta.join(' · ')));

    row.append(body);

    const remove = createEl('button', 'btn ghost reserved-remove', 'Снять');
    remove.type = 'button';
    remove.addEventListener('click', () => removeReservedClick(item, remove));
    row.append(remove);

    dom.reservedList.append(row);
  });
}

/** Показать, что добавлено/снято и какие имена пропущены. */
function showReservedResult(result, action) {
  const added = result.added || [];
  const removed = result.removed || [];
  const skipped = result.skipped || [];
  const parts = [];

  if (action === 'add' && added.length) {
    parts.push(`Зарезервировано: ${added.map((name) => `@${name}`).join(', ')}`);
  }
  if (action === 'remove' && removed.length) {
    parts.push(`Снято с резерва: ${removed.map((name) => `@${name}`).join(', ')}`);
  }
  if (skipped.length) {
    const details = skipped.map((item) =>
      `@${item.name} (${RESERVED_SKIP_REASONS[item.reason] || 'недоступно'})`);
    parts.push(`Пропущено: ${details.join(', ')}`);
  }

  if (!parts.length) {
    dom.reservedResult.classList.add('hidden');
    dom.reservedResult.textContent = '';
    return;
  }

  dom.reservedResult.textContent = parts.join('. ');
  dom.reservedResult.classList.toggle('warn', skipped.length > 0);
  dom.reservedResult.classList.remove('hidden');
}

async function submitReservedAdd(event) {
  event.preventDefault();
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  dom.reservedError.classList.add('hidden');
  dom.reservedResult.classList.add('hidden');

  const raw = dom.reservedInput.value.trim();
  if (!raw) {
    dom.reservedError.textContent = 'Введите один или несколько юзернеймов';
    dom.reservedError.classList.remove('hidden');
    return;
  }

  dom.reservedSubmit.disabled = true;
  dom.reservedSubmit.textContent = 'Резервируем…';
  try {
    const result = await Chat.reserveUsernames({ names: raw, uid: state.user.uid });
    dom.reservedInput.value = '';
    showReservedResult(result, 'add');
    if (result.added.length) {
      toast(`Зарезервировано имён: ${result.added.length}`, 'success');
    } else {
      toast('Новые имена не добавлены: все пропущены');
    }
    await loadReservedUsernames();
  } catch (error) {
    console.error(error);
    dom.reservedError.textContent = error?.message || 'Не удалось зарезервировать юзернеймы';
    dom.reservedError.classList.remove('hidden');
  } finally {
    dom.reservedSubmit.disabled = false;
    dom.reservedSubmit.textContent = 'Зарезервировать';
  }
}

async function submitReservedRemove(event) {
  event.preventDefault();
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  dom.reservedRemoveError.classList.add('hidden');
  dom.reservedResult.classList.add('hidden');

  const raw = dom.reservedRemoveInput.value.trim();
  if (!raw) {
    dom.reservedRemoveError.textContent = 'Введите один или несколько юзернеймов';
    dom.reservedRemoveError.classList.remove('hidden');
    return;
  }

  dom.reservedRemoveSubmit.disabled = true;
  dom.reservedRemoveSubmit.textContent = 'Снимаем…';
  try {
    const result = await Chat.releaseReservedUsernames(raw);
    dom.reservedRemoveInput.value = '';
    showReservedResult(result, 'remove');
    if (result.removed.length) {
      toast(`Снято с резерва имён: ${result.removed.length}`, 'success');
    } else {
      toast('Таких имён в резерве нет');
    }
    await loadReservedUsernames();
  } catch (error) {
    console.error(error);
    dom.reservedRemoveError.textContent = error?.message || 'Не удалось снять резерв';
    dom.reservedRemoveError.classList.remove('hidden');
  } finally {
    dom.reservedRemoveSubmit.disabled = false;
    dom.reservedRemoveSubmit.textContent = 'Снять';
  }
}

async function removeReservedClick(item, button) {
  button.disabled = true;
  try {
    const result = await Chat.releaseReservedUsernames([item.name]);
    showReservedResult(result, 'remove');
    toast(`@${item.name} больше не зарезервирован`, 'success');
    await loadReservedUsernames();
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось снять резерв', 'error');
  } finally {
    button.disabled = false;
  }
}

/* ============================================================
 *  Дополнительные юзернеймы (только root-админы)
 * ============================================================ */

export const ALIAS_SKIP_REASONS = {
  invalid: 'неверный формат',
  taken: 'уже занят',
  alias: 'уже выдан как дополнительный',
  own: 'совпадает с основным',
  missing: 'не найден',
  reserved: 'зарезервирован',
};

const aliasesUi = {
  items: [],
  type: 'all',
  query: '',
};

function openAliasesModal() {
  if (!state.user || !adminRightsOn()) return;

  aliasesUi.items = [];
  aliasesUi.type = 'all';
  aliasesUi.query = '';

  dom.aliasesType.value = 'user';
  dom.aliasesTarget.value = '';
  dom.aliasesInput.value = '';
  dom.aliasesSearch.value = '';
  dom.aliasesFilter.value = 'all';
  dom.aliasesError.classList.add('hidden');
  dom.aliasesResult.classList.add('hidden');
  dom.aliasesResult.textContent = '';
  dom.aliasesLoadError.classList.add('hidden');
  dom.aliasesList.innerHTML = '';
  dom.aliasesEmpty.classList.add('hidden');
  dom.aliasesCount.textContent = '';
  dom.aliasesOverlay.classList.remove('hidden');
  updateAliasTargetPlaceholder();
  loadUsernameAliases();
}

export function closeAliasesModal() {
  dom.aliasesOverlay.classList.add('hidden');
}

/** Подсказка в поле цели в зависимости от выбранного типа. */
function updateAliasTargetPlaceholder() {
  const type = dom.aliasesType.value;
  dom.aliasesTarget.placeholder = type === 'user'
    ? '@username или ID пользователя'
    : type === 'channel' ? '@username или ID канала' : '@username или ID публичной группы';
}

export async function loadUsernameAliases() {
  dom.aliasesLoadError.classList.add('hidden');
  dom.aliasesCount.textContent = 'Загружаем…';
  try {
    aliasesUi.items = await Chat.listUsernameAliases();
    renderUsernameAliases();
  } catch (error) {
    console.error(error);
    aliasesUi.items = [];
    dom.aliasesList.innerHTML = '';
    dom.aliasesEmpty.classList.add('hidden');
    dom.aliasesCount.textContent = '';
    dom.aliasesLoadError.textContent = error?.message || 'Не удалось загрузить список';
    dom.aliasesLoadError.classList.remove('hidden');
  }
}

function renderUsernameAliases() {
  dom.aliasesList.innerHTML = '';

  const visible = aliasesUi.items.filter((item) => {
    const typeMatch = aliasesUi.type === 'all' || item.type === aliasesUi.type;
    const queryMatch = !aliasesUi.query || item.name.includes(aliasesUi.query);
    return typeMatch && queryMatch;
  });

  dom.aliasesCount.textContent = aliasesUi.items.length
    ? `Показано ${visible.length} из ${aliasesUi.items.length}`
    : '';
  dom.aliasesEmpty.classList.toggle('hidden', visible.length > 0);
  dom.aliasesEmpty.textContent = aliasesUi.items.length
    ? 'Ничего не найдено по фильтрам.'
    : 'Дополнительных юзернеймов пока нет.';

  visible.forEach((item) => {
    const row = createEl('div', 'reserved-row');
    const body = createEl('div', 'reserved-row-body');

    const title = createEl('div', 'reserved-row-title');
    title.append(createEl('span', 'reserved-name', `@${item.name}`));
    title.append(createEl('span', `reserved-status ${item.type}`,
      Chat.ALIAS_TYPE_LABELS[item.type] || 'Цель'));
    body.append(title);

    const target = item.targetUsername ? `@${item.targetUsername}` : item.target;
    const meta = [`ведёт на ${target}${item.targetTitle ? ' · ' + item.targetTitle : ''}`];
    if (item.at) meta.push(`Выдан: ${formatDayLabel(item.at)}, ${formatTime(item.at)}`);
    if (item.targetMissing) meta.push('цель не найдена');
    body.append(createEl('div', 'reserved-row-meta', meta.join(' · ')));

    row.append(body);

    const remove = createEl('button', 'btn ghost reserved-remove', 'Забрать');
    remove.type = 'button';
    remove.addEventListener('click', () => revokeAliasClick(item, remove));
    row.append(remove);

    dom.aliasesList.append(row);
  });
}

/** Показать, что выдано/забрано и какие имена пропущены. */
function showAliasesResult(result, action) {
  const added = result.added || [];
  const removed = result.removed || [];
  const skipped = result.skipped || [];
  const parts = [];

  if (action === 'add' && added.length) {
    parts.push(`Выдано: ${added.map((name) => `@${name}`).join(', ')}`);
  }
  if (action === 'remove' && removed.length) {
    parts.push(`Забрано: ${removed.map((name) => `@${name}`).join(', ')}`);
  }
  if (skipped.length) {
    const details = skipped.map((item) =>
      `@${item.name} (${ALIAS_SKIP_REASONS[item.reason] || 'недоступно'})`);
    parts.push(`Пропущено: ${details.join(', ')}`);
  }

  if (!parts.length) {
    dom.aliasesResult.classList.add('hidden');
    dom.aliasesResult.textContent = '';
    return;
  }

  dom.aliasesResult.textContent = parts.join('. ');
  dom.aliasesResult.classList.toggle('warn', skipped.length > 0);
  dom.aliasesResult.classList.remove('hidden');
}

async function submitAliases(event) {
  event.preventDefault();
  if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

  dom.aliasesError.classList.add('hidden');
  dom.aliasesResult.classList.add('hidden');

  const target = dom.aliasesTarget.value.trim();
  const names = dom.aliasesInput.value.trim();
  if (!target) {
    dom.aliasesError.textContent = 'Укажите @username или ID цели';
    dom.aliasesError.classList.remove('hidden');
    dom.aliasesTarget.focus();
    return;
  }
  if (!names) {
    dom.aliasesError.textContent = 'Введите один или несколько дополнительных юзернеймов';
    dom.aliasesError.classList.remove('hidden');
    dom.aliasesInput.focus();
    return;
  }

  dom.aliasesSubmit.disabled = true;
  dom.aliasesSubmit.textContent = 'Выдаём…';
  try {
    const result = await Chat.assignUsernameAliases({
      names,
      type: dom.aliasesType.value,
      target,
      uid: state.user.uid,
    });
    dom.aliasesInput.value = '';
    showAliasesResult(result, 'add');
    toast(result.added.length
      ? `Выдано имён: ${result.added.length}`
      : 'Новые имена не выданы: все пропущены', result.added.length ? 'success' : undefined);
    await loadUsernameAliases();
  } catch (error) {
    console.error(error);
    dom.aliasesError.textContent = error?.message || 'Не удалось выдать юзернеймы';
    dom.aliasesError.classList.remove('hidden');
  } finally {
    dom.aliasesSubmit.disabled = false;
    dom.aliasesSubmit.textContent = 'Выдать';
  }
}

async function revokeAliasClick(item, button) {
  if (!window.confirm(`Забрать @${item.name}? Оно перестанет вести на этот профиль.`)) return;

  button.disabled = true;
  try {
    const result = await Chat.removeUsernameAliases([item.name]);
    showAliasesResult(result, 'remove');
    toast(`@${item.name} больше не дополнительный`, 'success');
    await loadUsernameAliases();
  } catch (error) {
    console.error(error);
    toast(error?.message || 'Не удалось забрать юзернейм', 'error');
  } finally {
    button.disabled = false;
  }
}


/** Навесить обработчики интерфейса этого модуля. */
export function initAdminUsernames() {
  // --- Инвайт-коды: окно root-админа ---
  dom.prefsInvitesBtn.addEventListener('click', openInvitesModal);
  dom.invitesClose.addEventListener('click', closeInvitesModal);
  dom.invitesCancel.addEventListener('click', closeInvitesModal);
  dom.invitesOverlay.addEventListener('click', (event) => {
    if (event.target === dom.invitesOverlay) closeInvitesModal();
  });
  dom.invitesForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.user || !state.rootAdmins.has(state.user.uid)) return;

    dom.invitesError.classList.add('hidden');
    dom.invitesSubmit.disabled = true;
    dom.invitesSubmit.textContent = 'Создаём…';
    try {
      const count = Math.max(1, Math.min(20, Math.floor(Number(dom.invitesCount.value) || 1)));
      const created = await Invites.createInviteCodes({
        uid: state.user.uid,
        count,
        note: dom.invitesNote.value,
      });
      dom.invitesNote.value = '';
      renderCreatedInviteCodes(created);
      toast(created.length === 1 ? 'Инвайт-код создан' : `Создано кодов: ${created.length}`, 'success');
      loadInviteCodes();
    } catch (error) {
      console.error(error);
      showInvitesError(error?.message || 'Не удалось создать инвайт-код');
    } finally {
      dom.invitesSubmit.disabled = false;
      dom.invitesSubmit.textContent = 'Создать';
    }
  });

  // --- Резерв юзернеймов: окно root-админа ---
  dom.prefsReservedBtn.addEventListener('click', openReservedModal);
  dom.reservedClose.addEventListener('click', closeReservedModal);
  dom.reservedCancel.addEventListener('click', closeReservedModal);
  dom.reservedOverlay.addEventListener('click', (event) => {
    if (event.target === dom.reservedOverlay) closeReservedModal();
  });
  dom.reservedForm.addEventListener('submit', submitReservedAdd);
  dom.reservedRemoveForm.addEventListener('submit', submitReservedRemove);
  dom.reservedSearch.addEventListener('input', () => {
    reservedUi.query = Chat.normalizeUsername(dom.reservedSearch.value);
    renderReservedUsernames();
  });
  dom.reservedStatusFilter.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-status-filter]');
    if (!btn) return;
    reservedUi.status = btn.dataset.statusFilter || 'all';
    dom.reservedStatusFilter.querySelectorAll('.seg-btn').forEach((item) => {
      item.classList.toggle('active', item === btn);
    });
    renderReservedUsernames();
  });
  dom.reservedTypeFilter.addEventListener('change', () => {
    reservedUi.type = dom.reservedTypeFilter.value || 'all';
    renderReservedUsernames();
  });

  // --- Дополнительные юзернеймы: окно root-админа ---
  dom.prefsAliasesBtn.addEventListener('click', openAliasesModal);
  dom.aliasesClose.addEventListener('click', closeAliasesModal);
  dom.aliasesCancel.addEventListener('click', closeAliasesModal);
  dom.aliasesOverlay.addEventListener('click', (event) => {
    if (event.target === dom.aliasesOverlay) closeAliasesModal();
  });
  dom.aliasesForm.addEventListener('submit', submitAliases);
  dom.aliasesType.addEventListener('change', updateAliasTargetPlaceholder);
  dom.aliasesSearch.addEventListener('input', () => {
    aliasesUi.query = Chat.normalizeUsername(dom.aliasesSearch.value);
    renderUsernameAliases();
  });
  dom.aliasesFilter.addEventListener('change', () => {
    aliasesUi.type = dom.aliasesFilter.value || 'all';
    renderUsernameAliases();
  });
}

