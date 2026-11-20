import * as Chat from '../services/chat.js?v=77';
import * as ColorPicker from '../color-picker.js?v=77';
import { draftAvatar, normalizeHex } from './avatar-editor.js?v=77';
import { closeActiveChat } from './chat-view.js?v=77';
import { dom } from './dom.js?v=77';
import { adminRightsOn, applyAliasHint, applyChatAvatar, applyProfileAvatar, buildUserNameWithStatus, getChatTitle, getProfileName, hydrateUsers } from './profile-view.js?v=77';
import { state } from './state.js?v=77';
import { AVATAR_COLORS, createEl, toast } from './utils.js?v=77';

/**
 * Настройки группы/канала, администраторы, участники и аватар чата
 *
 * Beacon — часть UI-слоя, вынесенная из app.js.
 */

let settingsTypeChoice = 'private'; // тип группы в окне настроек
export let settingsChatId = null;          // чат, открытый в окне настроек

/** Открыть настройки чата (действие «Настройки» в меню чата). */
export function openSettingsModal() {
  const chat = state.chats.get(state.activeChatId);
  if (!chat || (chat.type !== 'group' && chat.type !== 'channel')) return;

  settingsChatId = state.activeChatId;
  const myUid = state.user?.uid;
  const isOwner = Boolean(chat.owner && chat.owner === myUid);
  const isGroup = chat.type === 'group';
  const isChannel = chat.type === 'channel';
  const isGroupAdmin = isGroup && Boolean(chat.admins?.[myUid]);
  const rootAdmin = adminRightsOn();
  // Тип, юзернейм и удаление — только владелец (или супер-админ).
  const canManageGroupMeta = isOwner || rootAdmin;
  // Добавлять участников могут владелец, админы группы и супер-админ.
  const canManageMembers = isGroup && (isOwner || isGroupAdmin || rootAdmin);

  dom.settingsHeading.textContent = isGroup ? 'Настройки группы' : 'Настройки канала';
  dom.settingsTitle.value = chat.title || '';
  dom.settingsDescription.value = chat.description || '';
  dom.settingsGroupBlock.classList.toggle('hidden', !isGroup || !canManageGroupMeta);
  setSettingsTypeChoice(chat.groupType === 'public' ? 'public' : 'private');
  // Админ группы не меняет тип и юзернейм — скрываем поле от него.
  dom.settingsUsernameField.classList.toggle(
    'hidden',
    !isGroup || !canManageGroupMeta || settingsTypeChoice !== 'public',
  );
  dom.settingsUsername.value = chat.username || '';

  // Участники группы: список и добавление живут в отдельном окне.
  dom.settingsMembersBlock.classList.toggle('hidden', !isGroup);
  dom.settingsMemberAddRow.classList.toggle('hidden', !canManageMembers);
  dom.settingsMemberInput.value = '';
  if (isGroup) renderSettingsMembers(chat);

  // Доступ к чтению: только для каналов. Старые каналы без поля считаем
  // закрытыми — поведение по умолчанию не меняется.
  dom.settingsChannelBlock.classList.toggle('hidden', !isChannel);
  dom.settingsRequiresSubscription.checked = chat.requiresSubscription !== false;

  // Администраторы канала: список и добавление живут в отдельном окне.
  dom.settingsAdminInput.value = '';
  if (isChannel) renderSettingsAdmins(chat);

  // Строки «Участники» и «Администраторы» в основных настройках.
  dom.settingsParticipantsBlock.classList.toggle('hidden', !isGroup && !isChannel);
  dom.settingsMembersBtn.classList.toggle('hidden', !isGroup);
  dom.settingsAdminsBtn.classList.toggle('hidden', !isChannel);
  dom.settingsMembersHint.textContent = `Участники · ${Object.keys(chat.users || {}).length}`;
  dom.settingsAdminsHint.textContent = `Администраторы · ${Object.keys(chat.admins || {}).length}`;
  dom.settingsMembersOverlay.classList.add('hidden');
  dom.settingsAdminsOverlay.classList.add('hidden');

  // Аватар группы / логотип канала — у обоих типов.
  const hasAvatarEditor = isGroup || isChannel;
  dom.settingsAvatarBlock.classList.toggle('hidden', !hasAvatarEditor);
  const avatarLabel = dom.settingsAvatarBlock.querySelector('label');
  if (avatarLabel) avatarLabel.textContent = isChannel ? 'Логотип канала' : 'Аватар группы';
  dom.settingsAvatarReset.textContent = isChannel ? 'Убрать логотип' : 'Убрать аватар';
  if (hasAvatarEditor) initChatAvatarEditor(chat);

  // Удалять чат может только владелец (или супер-админ).
  dom.settingsDelete.classList.toggle('hidden', !canManageGroupMeta);

  dom.settingsError.classList.add('hidden');
  renderSettingsAliases();
  dom.settingsOverlay.classList.remove('hidden');
}

/** Переключить тип группы в настройках (приватная/публичная). */
function setSettingsTypeChoice(type) {
  settingsTypeChoice = type === 'public' ? 'public' : 'private';
  dom.settingsTypeBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.settingsType === settingsTypeChoice);
  });
  dom.settingsUsernameField.classList.toggle('hidden', settingsTypeChoice !== 'public');
}

export function closeSettingsModal() {
  ColorPicker.closeColorPicker();
  dom.settingsMembersOverlay.classList.add('hidden');
  dom.settingsAdminsOverlay.classList.add('hidden');
  dom.settingsOverlay.classList.add('hidden');
}

/** Дополнительные имена публичной группы в её настройках. */
export function renderSettingsAliases() {
  const chat = settingsChatId ? state.chats.get(settingsChatId) : null;
  if (!chat || chat.type !== 'group') {
    applyAliasHint(dom.settingsUsernameAliases, '', '');
    return;
  }
  applyAliasHint(dom.settingsUsernameAliases, 'group', settingsChatId);
}

/**
 * Список администраторов канала в окне настроек: владелец помечен,
 * у остальных — кнопка снятия.
 */
export function renderSettingsAdmins(chat) {
  dom.settingsAdminsList.innerHTML = '';
  const adminUids = Object.keys(chat.admins || {});
  if (!adminUids.length) {
    dom.settingsAdminsList.append(createEl('div', 'admin-empty', 'Администраторов пока нет.'));
    return;
  }

  // Владелец канала — всегда первым в списке.
  adminUids.sort((a, b) => (a === chat.owner ? -1 : b === chat.owner ? 1 : 0));

  const missing = [];
  for (const uid of adminUids) {
    const profile = Chat.getCachedUserProfile(uid);
    if (profile === undefined) missing.push(uid);

    const item = createEl('div', 'chat-item');

    const avatar = createEl('div', 'avatar avatar-sm');
    applyProfileAvatar(avatar, profile, uid);

    const body = createEl('div', 'chat-item-body');
    const top = createEl('div', 'chat-item-top');
    top.append(buildUserNameWithStatus(getProfileName(profile) || 'Пользователь', uid));
    const bottom = createEl('div', 'chat-item-bottom');
    bottom.append(createEl('span', 'chat-item-preview',
      uid === chat.owner ? 'владелец канала' : (profile?.username ? '@' + profile.username : 'администратор')));
    body.append(top, bottom);
    item.append(avatar, body);

    if (uid !== chat.owner) {
      const remove = createEl('button', 'unsubscribe-btn', 'Снять');
      remove.type = 'button';
      remove.addEventListener('click', () => removeSettingsAdmin(uid, remove));
      item.append(remove);
    }

    dom.settingsAdminsList.append(item);
  }

  // Профили могли ещё не загрузиться — догружаем и перерисовываем.
  if (missing.length) {
    hydrateUsers(missing).then(() => {
      if (!settingsChatId || dom.settingsOverlay.classList.contains('hidden')) return;
      const live = state.chats.get(settingsChatId);
      if (live) renderSettingsAdmins(live);
    });
  }
}

/** Снять администратора канала (кнопка «×» в списке настроек). */
async function removeSettingsAdmin(uid, buttonEl) {
  if (!settingsChatId || !state.user) return;
  buttonEl.disabled = true;
  try {
    await Chat.removeChannelAdmin(settingsChatId, state.user.uid, uid);
    toast('Администратор снят');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось снять администратора', 'error');
  } finally {
    buttonEl.disabled = false;
  }
}

/** Добавить администратора канала по @username или ID (кнопка в настройках). */
async function addSettingsAdmin() {
  const chat = state.chats.get(settingsChatId);
  if (!chat || chat.type !== 'channel' || !state.user) return;
  const query = dom.settingsAdminInput.value.trim();
  if (!query) {
    dom.settingsAdminInput.focus();
    return;
  }

  dom.settingsAdminAdd.disabled = true;
  try {
    // Сначала ищем по @username, затем пробуем как ID пользователя.
    let targetUid = null;
    const byUsername = await Chat.getUserByUsername(query).catch(() => null);
    if (byUsername) targetUid = byUsername.uid;
    else targetUid = query;

    await Chat.addChannelAdmin(settingsChatId, state.user.uid, targetUid);
    dom.settingsAdminInput.value = '';
    toast('Администратор добавлен', 'success');
    renderSettingsAdmins(state.chats.get(settingsChatId) || chat);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось добавить администратора', 'error');
  } finally {
    dom.settingsAdminAdd.disabled = false;
  }
}

/**
 * Список участников группы в окне настроек. Владелец и супер-админ могут
 * назначать и снимать администраторов прямо из списка.
 */
export function renderSettingsMembers(chat) {
  dom.settingsMembersList.innerHTML = '';
  const uids = Object.keys(chat.users || {});
  if (!uids.length) {
    dom.settingsMembersList.append(createEl('div', 'admin-empty', 'В группе пока нет участников.'));
    return;
  }

  const myUid = state.user?.uid;
  const canManageAdmins = Boolean(chat.owner && chat.owner === myUid) || adminRightsOn();
  const rank = (uid) => (uid === chat.owner ? 0 : chat.admins?.[uid] ? 1 : 2);
  const cachedName = (uid) => getProfileName(Chat.getCachedUserProfile(uid)) || '';
  uids.sort((a, b) => rank(a) - rank(b) || cachedName(a).localeCompare(cachedName(b), 'ru') || a.localeCompare(b));

  const missing = [];
  for (const uid of uids) {
    const profile = Chat.getCachedUserProfile(uid);
    if (profile === undefined) missing.push(uid);

    const item = createEl('div', 'chat-item');

    const avatar = createEl('div', 'avatar avatar-sm');
    applyProfileAvatar(avatar, profile, uid);

    const isAdmin = Boolean(chat.admins?.[uid]);
    const body = createEl('div', 'chat-item-body');
    const top = createEl('div', 'chat-item-top');
    top.append(buildUserNameWithStatus(getProfileName(profile) || 'Пользователь', uid));
    const bottom = createEl('div', 'chat-item-bottom');
    bottom.append(createEl('span', 'chat-item-preview',
      uid === chat.owner
        ? 'владелец группы'
        : isAdmin
          ? 'администратор'
          : (profile?.username ? '@' + profile.username : 'участник')));
    body.append(top, bottom);
    item.append(avatar, body);

    if (canManageAdmins && uid !== chat.owner) {
      const toggle = createEl(
        'button',
        isAdmin ? 'unsubscribe-btn' : 'make-admin-btn',
        isAdmin ? 'Снять' : 'Админ',
      );
      toggle.type = 'button';
      toggle.title = isAdmin ? 'Снять администратора' : 'Сделать администратором';
      toggle.addEventListener('click', () => toggleSettingsGroupAdmin(uid, !isAdmin, toggle));
      item.append(toggle);
    }

    // Удалять участников может владелец группы (и супер-админ).
    if ((chat.owner === myUid || adminRightsOn()) && uid !== chat.owner) {
      const remove = createEl('button', 'unsubscribe-btn', 'Убрать');
      remove.type = 'button';
      remove.title = 'Удалить из группы';
      remove.addEventListener('click', () => removeSettingsMember(uid, remove));
      item.append(remove);
    }

    dom.settingsMembersList.append(item);
  }

  // Профили могли ещё не загрузиться — догружаем и перерисовываем.
  if (missing.length) {
    hydrateUsers(missing).then(() => {
      if (!settingsChatId || dom.settingsOverlay.classList.contains('hidden')) return;
      const live = state.chats.get(settingsChatId);
      if (live) renderSettingsMembers(live);
    });
  }
}

/** Назначить или снять администратора группы из списка участников. */
async function toggleSettingsGroupAdmin(uid, makeAdmin, buttonEl) {
  if (!settingsChatId || !state.user) return;
  buttonEl.disabled = true;
  try {
    if (makeAdmin) await Chat.addGroupAdmin(settingsChatId, state.user.uid, uid);
    else await Chat.removeGroupAdmin(settingsChatId, state.user.uid, uid);
    toast(makeAdmin ? 'Администратор назначен' : 'Администратор снят');

    // Подписка на чат обновит state.chats; перечитываем для мгновенного отклика.
    const live = await Chat.getChat(settingsChatId);
    if (live) {
      state.chats.set(settingsChatId, live);
      if (!dom.settingsOverlay.classList.contains('hidden')) renderSettingsMembers(live);
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось изменить администратора', 'error');
  } finally {
    buttonEl.disabled = false;
  }
}

/** Удалить участника из группы (кнопка «Убрать» в списке настроек). */
async function removeSettingsMember(uid, buttonEl) {
  if (!settingsChatId || !state.user) return;
  const chat = state.chats.get(settingsChatId);
  if (!chat) return;
  const name = getProfileName(Chat.getCachedUserProfile(uid)) || 'участника';
  if (!window.confirm(`Удалить участника «${name}» из группы?`)) return;

  buttonEl.disabled = true;
  try {
    const result = await Chat.removeGroupMember(settingsChatId, state.user.uid, uid);
    toast(result?.removed === false ? 'Пользователя нет в группе' : 'Участник удалён');

    const live = await Chat.getChat(settingsChatId);
    if (live) {
      state.chats.set(settingsChatId, live);
      if (!dom.settingsOverlay.classList.contains('hidden')) renderSettingsMembers(live);
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось удалить участника', 'error');
  } finally {
    buttonEl.disabled = false;
  }
}

/** Добавить участника в группу по @username или ID (кнопка в настройках). */
async function addSettingsMember() {
  const chat = state.chats.get(settingsChatId);
  if (!chat || chat.type !== 'group' || !state.user) return;
  const query = dom.settingsMemberInput.value.trim();
  if (!query) {
    dom.settingsMemberInput.focus();
    return;
  }

  dom.settingsMemberAdd.disabled = true;
  try {
    // Сначала ищем по @username, затем пробуем как ID пользователя.
    let targetUid = null;
    const byUsername = await Chat.getUserByUsername(query).catch(() => null);
    if (byUsername) targetUid = byUsername.uid;
    else targetUid = query;

    const result = await Chat.addGroupMember(settingsChatId, state.user.uid, targetUid);
    dom.settingsMemberInput.value = '';
    if (result?.added === false) {
      toast('Пользователь уже в группе');
    } else {
      toast('Участник добавлен', 'success');
    }

    const live = await Chat.getChat(settingsChatId);
    if (live) {
      state.chats.set(settingsChatId, live);
      if (!dom.settingsOverlay.classList.contains('hidden')) renderSettingsMembers(live);
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Не удалось добавить участника', 'error');
  } finally {
    dom.settingsMemberAdd.disabled = false;
  }
}

/* ============================================================
 *  Логотип канала (редактор в окне настроек канала)
 * ============================================================ */

/** Черновик логотипа канала в окне настроек. */
const chatAvatarDraft = {
  touched: false,     // трогал ли пользователь редактор за этот заход
  removed: false,     // «Убрать логотип» — вернуть стандартную букву названия
  kind: 'letter',     // 'letter' | 'emoji'
  value: '',
  bgType: 'solid',    // 'solid' | 'gradient'
  bg1: AVATAR_COLORS[0],
  bg2: AVATAR_COLORS[2],
  size: 100,
};

/** Залить черновик логотипа данными канала и перерисовать редактор. */
export function initChatAvatarEditor(chat) {
  const avatar = chat.avatar || null;
  chatAvatarDraft.touched = false;
  chatAvatarDraft.removed = false;
  chatAvatarDraft.kind = avatar?.kind === 'emoji' ? 'emoji' : 'letter';
  chatAvatarDraft.value = avatar?.value || (chat.title || '?').trim().charAt(0).toUpperCase();
  chatAvatarDraft.bgType = avatar?.bgType === 'gradient' ? 'gradient' : 'solid';
  chatAvatarDraft.bg1 = avatar?.bg1 || AVATAR_COLORS[0];
  chatAvatarDraft.bg2 = avatar?.bg2 || AVATAR_COLORS[2];
  chatAvatarDraft.size = Math.min(200, Math.max(50, Number(avatar?.size) || 100));
  renderChatAvatarEditor();
}

/** Пользователь изменил логотип — черновик считается тронутым. */
function touchChatAvatar() {
  chatAvatarDraft.touched = true;
  chatAvatarDraft.removed = false;
}

/** Перерисовать контролы логотипа и превью (syncInput=false — не трогать поля ввода). */
function renderChatAvatarEditor(syncInput = true) {
  dom.settingsAvatarKindBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.saKind === chatAvatarDraft.kind);
  });
  dom.settingsAvatarBgBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.saBg === chatAvatarDraft.bgType);
  });

  if (syncInput) {
    if (dom.settingsAvatarValue.value !== chatAvatarDraft.value) dom.settingsAvatarValue.value = chatAvatarDraft.value;
    dom.settingsAvatarValue.maxLength = chatAvatarDraft.kind === 'letter' ? 1 : 4;
    dom.settingsAvatarValue.placeholder = chatAvatarDraft.kind === 'letter' ? 'А' : '💡';
    if (normalizeHex(dom.settingsAvatarHex1.value) !== chatAvatarDraft.bg1) dom.settingsAvatarHex1.value = chatAvatarDraft.bg1;
    if (normalizeHex(dom.settingsAvatarHex2.value) !== chatAvatarDraft.bg2) dom.settingsAvatarHex2.value = chatAvatarDraft.bg2;
    dom.settingsAvatarHex1.classList.remove('invalid');
    dom.settingsAvatarHex2.classList.remove('invalid');
  }

  dom.settingsAvatarColorRow2.classList.toggle('hidden', chatAvatarDraft.bgType !== 'gradient');
  ColorPicker.syncColorChip(dom.settingsAvatarPick1, dom.settingsAvatarHex1);
  ColorPicker.syncColorChip(dom.settingsAvatarPick2, dom.settingsAvatarHex2);

  // Превью: кастомный логотип либо стандартная буква названия.
  const chat = state.chats.get(settingsChatId) || { title: dom.settingsTitle.value };
  const draft = chatAvatarDraft.removed ? null : draftAvatar(chatAvatarDraft);
  if (draft) {
    applyProfileAvatar(
      dom.settingsAvatarPreview,
      { avatar: draft },
      settingsChatId || 'chat',
      (chat.title || '?').trim().charAt(0).toUpperCase(),
    );
  } else {
    applyChatAvatar(dom.settingsAvatarPreview, settingsChatId || 'chat', { type: chat.type || 'channel', title: chat.title });
  }
}

dom.settingsAvatarKindBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    touchChatAvatar();
    chatAvatarDraft.kind = btn.dataset.saKind === 'emoji' ? 'emoji' : 'letter';
    if (chatAvatarDraft.kind === 'letter' && chatAvatarDraft.value) {
      chatAvatarDraft.value = chatAvatarDraft.value.charAt(0).toUpperCase();
    }
    renderChatAvatarEditor();
  });
});
dom.settingsAvatarBgBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    touchChatAvatar();
    chatAvatarDraft.bgType = btn.dataset.saBg === 'gradient' ? 'gradient' : 'solid';
    renderChatAvatarEditor();
  });
});
dom.settingsAvatarValue.addEventListener('input', () => {
  touchChatAvatar();
  chatAvatarDraft.value = dom.settingsAvatarValue.value;
  renderChatAvatarEditor(false); // не трогаем само поле, чтобы не прыгал курсор
});
dom.settingsAvatarReset.addEventListener('click', () => {
  chatAvatarDraft.touched = true;
  chatAvatarDraft.removed = true;
  chatAvatarDraft.kind = 'letter';
  chatAvatarDraft.value = '';
  chatAvatarDraft.bgType = 'solid';
  chatAvatarDraft.bg1 = AVATAR_COLORS[0];
  chatAvatarDraft.bg2 = AVATAR_COLORS[2];
  renderChatAvatarEditor();
});

/** Свои hex-цвета для фона логотипа (окно настроек канала). */
function bindChatAvatarHexInput(inputEl, key) {
  inputEl.addEventListener('input', () => {
    const hex = normalizeHex(inputEl.value);
    inputEl.classList.toggle('invalid', !hex && inputEl.value.trim() !== '');
    if (!hex) return;
    touchChatAvatar();
    chatAvatarDraft[key] = hex;
    renderChatAvatarEditor(false); // не трогаем поля, чтобы не прыгал курсор
  });
  inputEl.addEventListener('blur', () => {
    inputEl.classList.remove('invalid');
    inputEl.value = chatAvatarDraft[key];
  });
}
bindChatAvatarHexInput(dom.settingsAvatarHex1, 'bg1');
bindChatAvatarHexInput(dom.settingsAvatarHex2, 'bg2');

ColorPicker.bindColorField({ chip: dom.settingsAvatarPick1, input: dom.settingsAvatarHex1, presets: AVATAR_COLORS });
ColorPicker.bindColorField({ chip: dom.settingsAvatarPick2, input: dom.settingsAvatarHex2, presets: AVATAR_COLORS });


/** Навесить обработчики интерфейса этого модуля. */
export function initChatSettings() {
  // --- Модальное окно «Настройки чата» (открывается из меню чата) ---
  dom.settingsClose.addEventListener('click', closeSettingsModal);
  dom.settingsCancel.addEventListener('click', closeSettingsModal);
  dom.settingsOverlay.addEventListener('click', (event) => {
    if (event.target === dom.settingsOverlay) closeSettingsModal();
  });
  dom.settingsMembersBtn.addEventListener('click', () => {
    if (!state.chats.get(settingsChatId)) return;
    dom.settingsMembersOverlay.classList.remove('hidden');
    dom.settingsMemberInput.focus();
  });
  dom.settingsAdminsBtn.addEventListener('click', () => {
    if (!state.chats.get(settingsChatId)) return;
    dom.settingsAdminsOverlay.classList.remove('hidden');
    dom.settingsAdminInput.focus();
  });
  [
    [dom.settingsMembersOverlay, dom.settingsMembersClose],
    [dom.settingsAdminsOverlay, dom.settingsAdminsClose],
  ].forEach(([overlay, closeBtn]) => {
    closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.classList.add('hidden');
    });
  });
  dom.settingsTypeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setSettingsTypeChoice(btn.dataset.settingsType));
  });
  dom.settingsAdminAdd.addEventListener('click', addSettingsAdmin);
  dom.settingsAdminInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // не отправляем форму настроек
      addSettingsAdmin();
    }
  });
  dom.settingsMemberAdd.addEventListener('click', addSettingsMember);
  dom.settingsMemberInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // не отправляем форму настроек
      addSettingsMember();
    }
  });
  dom.settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const chat = state.chats.get(settingsChatId);
    if (!chat) return;

    dom.settingsError.classList.add('hidden');
    dom.settingsSubmit.disabled = true;
    dom.settingsSubmit.textContent = 'Сохраняем…';
    try {
      // Тип и юзернейм группы отправляем только владельцу/супер-админу:
      // админ группы может менять лишь название, описание и аватар.
      const canManageGroupMeta = chat.owner === state.user.uid || adminRightsOn();
      await Chat.updateChatSettings(settingsChatId, state.user.uid, {
        title: dom.settingsTitle.value,
        description: dom.settingsDescription.value,
        groupType: chat.type === 'group' && canManageGroupMeta ? settingsTypeChoice : undefined,
        username: canManageGroupMeta ? dom.settingsUsername.value : undefined,
        requiresSubscription: chat.type === 'channel'
          ? dom.settingsRequiresSubscription.checked
          : undefined,
      });
      // Аватар группы/канала: сохраняем, только если его трогали.
      if ((chat.type === 'channel' || chat.type === 'group') && chatAvatarDraft.touched) {
        const avatar = chatAvatarDraft.removed ? null : draftAvatar(chatAvatarDraft);
        await Chat.updateChatAvatar(settingsChatId, state.user.uid, avatar);
      }
      closeSettingsModal();
      toast('Настройки сохранены', 'success');
    } catch (error) {
      console.error(error);
      dom.settingsError.textContent = error.message || 'Не удалось сохранить настройки';
      dom.settingsError.classList.remove('hidden');
    } finally {
      dom.settingsSubmit.disabled = false;
      dom.settingsSubmit.textContent = 'Сохранить';
    }
  });
  dom.settingsDelete.addEventListener('click', async () => {
    const chat = state.chats.get(settingsChatId);
    if (!chat) return;

    const kind = chat.type === 'channel' ? 'канал' : 'группу';
    if (!window.confirm(`Удалить ${kind} «${getChatTitle(chat)}»? Это действие необратимо.`)) return;

    dom.settingsDelete.disabled = true;
    try {
      await Chat.deleteChat(settingsChatId, state.user.uid);
      closeSettingsModal();
      closeActiveChat();
      toast(chat.type === 'channel' ? 'Канал удалён' : 'Группа удалена');
    } catch (error) {
      console.error(error);
      dom.settingsError.textContent = error.message || 'Не удалось удалить чат';
      dom.settingsError.classList.remove('hidden');
    } finally {
      dom.settingsDelete.disabled = false;
    }
  });
}

