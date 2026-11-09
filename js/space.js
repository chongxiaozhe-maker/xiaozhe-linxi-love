(function () {
  const sb = window.loveSupabase;
  if (sb === undefined) return;

  const grid = document.getElementById('spaceGrid');
  const modal = document.getElementById('editBackdrop');
  const editForm = document.getElementById('editForm');
  const editNote = document.getElementById('editNote');
  const photoInput = document.getElementById('photoInput');
  const logoutButton = document.getElementById('logoutButton');
  const toast = document.getElementById('spaceToast');
  const saveButton = document.getElementById('saveEditButton');
  const noteBackdrop = document.getElementById('noteBackdrop');
  const noteForm = document.getElementById('noteForm');
  const noteModalTitle = document.getElementById('noteModalTitle');
  const noteNote = document.getElementById('noteNote');
  const saveNoteButton = document.getElementById('saveNoteButton');
  const messageBackdrop = document.getElementById('messageBackdrop');
  const messageForm = document.getElementById('messageForm');
  const messageNote = document.getElementById('messageNote');
  const sendMessageButton = document.getElementById('sendMessageButton');
  const photoBackdrop = document.getElementById('photoBackdrop');
  const photoViewerImg = document.getElementById('photoViewerImg');
  const photoCaptionRead = document.getElementById('photoCaptionRead');
  const photoCaptionEditor = document.getElementById('photoCaptionEditor');
  const photoCaptionInput = document.getElementById('photoCaptionInput');
  const saveCaptionButton = document.getElementById('saveCaptionButton');

  let currentUser = null;
  let currentProfile = null;
  let profiles = [];
  let photos = [];
  let notes = [];
  let messages = [];
  let currentPhoto = null;
  let toastTimer = 0;

  function text(key) {
    const node = document.querySelector('#spaceMessages [data-msg="' + key + '"]');
    return node ? node.textContent : key;
  }

  function showToast(message) {
    if (toast === null) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2800);
  }

  function openModal() {
    if (currentProfile === null) return;
    document.getElementById('editName').value = currentProfile.display_name || '';
    document.getElementById('editCity').value = currentProfile.city || '';
    document.getElementById('editStatus').value = currentProfile.status || '';
    document.getElementById('editMood').value = currentProfile.mood || '';
    document.getElementById('editBio').value = currentProfile.bio || '';
    editNote.textContent = '';
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('is-visible');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function signPhotoPath(path) {
    const result = await sb.storage.from('space-photos').createSignedUrl(path, 3600);
    if (result.error || result.data === null) return null;
    return result.data.signedUrl;
  }

  function renderAvatar(element, profile) {
    element.textContent = '';
    if (profile.avatar_url) {
      const img = document.createElement('img');
      img.src = profile.avatar_url;
      img.alt = profile.display_name || '';
      element.appendChild(img);
      return;
    }
    const name = profile.display_name || '?';
    element.textContent = name.slice(0, 1);
  }

  function openNoteModal(note) {
    if (noteBackdrop === null) return;
    document.getElementById('noteId').value = note ? note.id : '';
    document.getElementById('noteTitle').value = note ? (note.title || '') : '';
    document.getElementById('noteBody').value = note ? (note.body || '') : '';
    document.getElementById('noteMood').value = note ? (note.mood || '') : '';
    noteModalTitle.textContent = note ? text('edit_note') : text('add_note');
    noteNote.textContent = '';
    noteBackdrop.classList.add('is-visible');
    noteBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeNoteModal() {
    if (noteBackdrop === null) return;
    noteBackdrop.classList.remove('is-visible');
    noteBackdrop.setAttribute('aria-hidden', 'true');
  }

  function openMessageModal(ownerId) {
    if (messageBackdrop === null) return;
    document.getElementById('messageOwnerId').value = ownerId || '';
    document.getElementById('messageBody').value = '';
    messageNote.textContent = '';
    messageBackdrop.classList.add('is-visible');
    messageBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeMessageModal() {
    if (messageBackdrop === null) return;
    messageBackdrop.classList.remove('is-visible');
    messageBackdrop.setAttribute('aria-hidden', 'true');
  }

  function openPhotoViewer(photo, canEdit) {
    if (photoBackdrop === null) return;
    currentPhoto = photo;
    photoViewerImg.src = photo.signedUrl || '';
    photoViewerImg.alt = photo.caption || '';
    photoCaptionRead.textContent = photo.caption || '';
    photoCaptionInput.value = photo.caption || '';
    photoCaptionEditor.style.display = canEdit ? 'flex' : 'none';
    photoBackdrop.classList.add('is-visible');
    photoBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closePhotoViewer() {
    if (photoBackdrop === null) return;
    photoBackdrop.classList.remove('is-visible');
    photoBackdrop.setAttribute('aria-hidden', 'true');
    currentPhoto = null;
  }

  function renderPhotoGrid(card, profile, list) {
    const photoGrid = card.querySelector('[data-photos]');
    if (photoGrid === null) return;
    photoGrid.textContent = '';
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'photo-empty';
      empty.textContent = profile ? card.dataset.empty : card.dataset.waitingHint;
      photoGrid.appendChild(empty);
      return;
    }
    const isOwn = currentUser && profile && profile.id === currentUser.id;
    list.forEach(function (photo) {
      const tile = document.createElement('div');
      tile.className = 'photo-tile';
      if (photo.signedUrl) {
        const img = document.createElement('img');
        img.src = photo.signedUrl;
        img.alt = photo.caption || profile.display_name || 'photo';
        img.loading = 'lazy';
        tile.appendChild(img);
        tile.addEventListener('click', function () {
          openPhotoViewer(photo, isOwn);
        });
      }
      if (isOwn) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'photo-delete';
        remove.textContent = String.fromCharCode(215);
        remove.title = photoGrid.dataset.deleteLabel || 'delete';
        remove.addEventListener('click', function (event) {
          event.stopPropagation();
          deletePhoto(photo);
        });
        tile.appendChild(remove);
      }
      photoGrid.appendChild(tile);
    });
  }

  function renderNotes(card, profile, list) {
    const container = card.querySelector('[data-notes]');
    if (container === null) return;
    container.textContent = '';
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'mini-empty';
      empty.textContent = container.dataset.empty;
      container.appendChild(empty);
      return;
    }
    const isOwn = currentUser && profile && profile.id === currentUser.id;
    list.slice(0, 4).forEach(function (note) {
      const item = document.createElement('article');
      item.className = 'note-card';
      const head = document.createElement('div');
      head.className = 'note-card-head';
      const title = document.createElement('h4');
      title.textContent = note.title || text('notes_title');
      head.appendChild(title);
      if (isOwn) {
        const actions = document.createElement('div');
        actions.className = 'note-actions';
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = text('edit');
        edit.addEventListener('click', function () { openNoteModal(note); });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = text('delete');
        remove.addEventListener('click', function () { deleteNote(note); });
        actions.appendChild(edit);
        actions.appendChild(remove);
        head.appendChild(actions);
      }
      item.appendChild(head);
      const body = document.createElement('p');
      body.textContent = note.body;
      item.appendChild(body);
      const foot = document.createElement('div');
      foot.className = 'note-card-foot';
      const mood = document.createElement('span');
      mood.textContent = note.mood || '';
      const date = document.createElement('span');
      date.textContent = new Date(note.created_at).toLocaleDateString('zh-CN');
      foot.appendChild(mood);
      foot.appendChild(date);
      item.appendChild(foot);
      container.appendChild(item);
    });
  }

  function renderMessages(card, profile, list) {
    const container = card.querySelector('[data-messages]');
    if (container === null) return;
    container.textContent = '';
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'mini-empty';
      empty.textContent = container.dataset.empty;
      container.appendChild(empty);
      return;
    }
    list.slice(0, 4).forEach(function (message) {
      const item = document.createElement('div');
      item.className = 'message-item';
      const author = profiles.find(function (entry) { return entry.id === message.author_id; });
      const name = document.createElement('strong');
      name.textContent = author ? author.display_name : '?';
      const body = document.createElement('p');
      body.textContent = message.body;
      item.appendChild(name);
      item.appendChild(body);
      container.appendChild(item);
    });
  }

  function renderRoom(card, profile, photoList, noteList, messageList) {
    const nameEl = card.querySelector('[data-name]');
    const cityEl = card.querySelector('[data-city]');
    const statusEl = card.querySelector('[data-status]');
    const bioEl = card.querySelector('[data-bio]');
    const moodEl = card.querySelector('[data-mood]');
    const avatarEl = card.querySelector('[data-avatar]');
    const actionsEl = card.querySelector('[data-actions]');
    const addNoteButton = card.querySelector('[data-action="add-note"]');
    const addMessageButton = card.querySelector('[data-action="add-message"]');

    if (profile === undefined || profile === null) {
      nameEl.textContent = card.dataset.waiting;
      cityEl.textContent = '';
      statusEl.textContent = card.dataset.waitingHint;
      bioEl.textContent = '';
      moodEl.textContent = '';
      moodEl.style.display = 'none';
      avatarEl.textContent = '?';
      card.dataset.ownerId = '';
      renderPhotoGrid(card, null, []);
      if (actionsEl) actionsEl.style.display = 'none';
      if (addNoteButton) addNoteButton.style.display = 'none';
      if (addMessageButton) addMessageButton.style.display = 'none';
      if (card.querySelector('[data-notes]')) card.querySelector('[data-notes]').textContent = '';
      if (card.querySelector('[data-messages]')) card.querySelector('[data-messages]').textContent = '';
      return;
    }

    const isOwn = currentUser && profile.id === currentUser.id;
    card.dataset.ownerId = profile.id;
    nameEl.textContent = profile.display_name || card.dataset.waiting;
    cityEl.textContent = profile.city || '';
    statusEl.textContent = profile.status || text('default_status');
    bioEl.textContent = profile.bio || text('default_bio');
    moodEl.textContent = profile.mood || '';
    moodEl.style.display = profile.mood ? '' : 'none';
    renderAvatar(avatarEl, profile);
    renderPhotoGrid(card, profile, photoList);
    renderNotes(card, profile, noteList);
    renderMessages(card, profile, messageList);

    if (actionsEl) actionsEl.style.display = isOwn ? 'flex' : 'none';
    if (addNoteButton) addNoteButton.style.display = isOwn ? '' : 'none';
    if (addMessageButton) addMessageButton.style.display = isOwn === false ? '' : 'none';
  }

  async function loadSpace() {
    const sessionResult = await sb.auth.getSession();
    const session = sessionResult.data.session;
    if (session === null) {
      window.location.replace('login.html');
      return;
    }
    currentUser = session.user;

    const profileResult = await sb.from('profiles').select('*').order('updated_at', { ascending: true });
    if (profileResult.error) {
      showToast(text('generic_error'));
      return;
    }
    profiles = profileResult.data || [];
    currentProfile = profiles.find(function (item) { return item.id === currentUser.id; }) || null;

    if (currentProfile === null) {
      const meta = currentUser.user_metadata || {};
      if (meta.slug === 'xiaozhe' || meta.slug === 'linxi') {
        const createResult = await sb.from('profiles').insert({
          id: currentUser.id,
          slug: meta.slug,
          display_name: meta.display_name || currentUser.email || meta.slug
        }).select().single();
        if (createResult.error === null) {
          currentProfile = createResult.data;
          profiles.push(currentProfile);
        }
      }
    }

    if (currentProfile === null) {
      showToast(text('profile_missing'));
      return;
    }

    const photoResult = await sb.from('space_photos').select('*').order('created_at', { ascending: true });
    if (photoResult.error) {
      showToast(text('generic_error'));
      return;
    }
    photos = photoResult.data || [];
    for (let i = 0; i < photos.length; i += 1) {
      photos[i].signedUrl = await signPhotoPath(photos[i].storage_path);
    }

    const noteResult = await sb.from('space_notes').select('*').order('created_at', { ascending: false });
    const messageResult = await sb.from('space_messages').select('*').order('created_at', { ascending: false });
    notes = noteResult.data || [];
    messages = messageResult.data || [];

    const zheCard = grid.querySelector('[data-room="xiaozhe"]');
    const linxiCard = grid.querySelector('[data-room="linxi"]');
    const zhe = profiles.find(function (item) { return item.slug === 'xiaozhe'; }) || null;
    const linxi = profiles.find(function (item) { return item.slug === 'linxi'; }) || null;
    renderRoom(zheCard, zhe, photos.filter(function (item) { return zhe && item.owner_id === zhe.id; }), notes.filter(function (item) { return zhe && item.owner_id === zhe.id; }), messages.filter(function (item) { return zhe && item.space_owner_id === zhe.id; }));
    renderRoom(linxiCard, linxi, photos.filter(function (item) { return linxi && item.owner_id === linxi.id; }), notes.filter(function (item) { return linxi && item.owner_id === linxi.id; }), messages.filter(function (item) { return linxi && item.space_owner_id === linxi.id; }));
  }

  function randomFileName() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return String(Date.now()) + '-' + String(Math.round(Math.random() * 1000000));
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onerror = function () { reject(new Error('read failed')); };
      reader.onload = function () {
        const image = new Image();
        image.onerror = function () { reject(new Error('load failed')); };
        image.onload = function () {
          let width = image.width;
          let height = image.height;
          const max = 1400;
          if (width > max || height > max) {
            const ratio = Math.min(max / width, max / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (context === null) {
            reject(new Error('canvas failed'));
            return;
          }
          context.drawImage(image, 0, 0, width, height);
          canvas.toBlob(function (blob) {
            if (blob === null) {
              reject(new Error('compress failed'));
            } else {
              resolve(blob);
            }
          }, 'image/jpeg', 0.84);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadPhoto(file) {
    if (file === undefined || file === null || currentUser === null) return;
    showToast(text('uploading'));
    try {
      const blob = await compressImage(file);
      const path = currentUser.id + '/' + randomFileName() + '.jpg';
      const uploadResult = await sb.storage.from('space-photos').upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });
      if (uploadResult.error) throw uploadResult.error;
      const insertResult = await sb.from('space_photos').insert({
        owner_id: currentUser.id,
        storage_path: path,
        caption: ''
      });
      if (insertResult.error) {
        await sb.storage.from('space-photos').remove([path]);
        throw insertResult.error;
      }
      showToast(text('upload_ok'));
      await loadSpace();
    } catch (error) {
      showToast(text('upload_fail'));
    }
  }

  async function deletePhoto(photo) {
    if (window.confirm(text('photo_delete_confirm')) === false) return;
    try {
      await sb.storage.from('space-photos').remove([photo.storage_path]);
      const result = await sb.from('space_photos').delete().eq('id', photo.id);
      if (result.error) throw result.error;
      showToast(text('photo_delete_ok'));
      await loadSpace();
    } catch (error) {
      showToast(text('generic_error'));
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    if (currentUser === null) return;
    const id = document.getElementById('noteId').value;
    const title = document.getElementById('noteTitle').value.trim();
    const body = document.getElementById('noteBody').value.trim();
    const mood = document.getElementById('noteMood').value.trim();
    if (body === '') {
      noteNote.textContent = text('note_required');
      return;
    }
    saveNoteButton.disabled = true;
    const payload = { owner_id: currentUser.id, title: title, body: body, mood: mood };
    const result = id
      ? await sb.from('space_notes').update(payload).eq('id', id)
      : await sb.from('space_notes').insert(payload);
    saveNoteButton.disabled = false;
    if (result.error) {
      noteNote.textContent = text('save_fail');
      return;
    }
    closeNoteModal();
    showToast(text('note_saved'));
    await loadSpace();
  }

  async function deleteNote(note) {
    if (window.confirm(text('note_delete_confirm')) === false) return;
    const result = await sb.from('space_notes').delete().eq('id', note.id);
    if (result.error) {
      showToast(text('generic_error'));
      return;
    }
    showToast(text('note_deleted'));
    await loadSpace();
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (currentUser === null) return;
    const ownerId = document.getElementById('messageOwnerId').value;
    const body = document.getElementById('messageBody').value.trim();
    if (body === '') {
      messageNote.textContent = text('message_required');
      return;
    }
    sendMessageButton.disabled = true;
    const result = await sb.from('space_messages').insert({
      space_owner_id: ownerId,
      author_id: currentUser.id,
      body: body
    });
    sendMessageButton.disabled = false;
    if (result.error) {
      messageNote.textContent = text('message_fail');
      return;
    }
    closeMessageModal();
    showToast(text('message_saved'));
    await loadSpace();
  }

  async function savePhotoCaption() {
    if (currentPhoto === null) return;
    saveCaptionButton.disabled = true;
    const caption = photoCaptionInput.value.trim();
    const result = await sb.from('space_photos').update({ caption: caption }).eq('id', currentPhoto.id);
    saveCaptionButton.disabled = false;
    if (result.error) {
      showToast(text('generic_error'));
      return;
    }
    currentPhoto.caption = caption;
    photoCaptionRead.textContent = caption;
    showToast(text('caption_saved'));
  }

  grid.addEventListener('click', function (event) {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton === null) return;
    const card = actionButton.closest('.room-card');
    const action = actionButton.dataset.action;
    if (action === 'edit') openModal();
    if (action === 'upload') photoInput.click();
    if (action === 'add-note') openNoteModal(null);
    if (action === 'add-message' && card) openMessageModal(card.dataset.ownerId);
  });

  if (photoInput) {
    photoInput.addEventListener('change', async function () {
      const file = photoInput.files[0];
      photoInput.value = '';
      if (file === undefined) return;
      await uploadPhoto(file);
    });
  }

  if (noteForm) noteForm.addEventListener('submit', saveNote);
  if (messageForm) messageForm.addEventListener('submit', sendMessage);
  document.getElementById('closeNoteButton').addEventListener('click', closeNoteModal);
  document.getElementById('cancelNoteButton').addEventListener('click', closeNoteModal);
  document.getElementById('closeMessageButton').addEventListener('click', closeMessageModal);
  document.getElementById('cancelMessageButton').addEventListener('click', closeMessageModal);
  document.getElementById('closePhotoButton').addEventListener('click', closePhotoViewer);
  saveCaptionButton.addEventListener('click', savePhotoCaption);
  noteBackdrop.addEventListener('click', function (event) {
    if (event.target === noteBackdrop) closeNoteModal();
  });
  messageBackdrop.addEventListener('click', function (event) {
    if (event.target === messageBackdrop) closeMessageModal();
  });
  photoBackdrop.addEventListener('click', function (event) {
    if (event.target === photoBackdrop) closePhotoViewer();
  });

  if (editForm) {
    editForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (currentProfile === null) return;
      const displayName = document.getElementById('editName').value.trim();
      if (displayName === '') {
        editNote.textContent = text('err_nickname');
        return;
      }
      saveButton.disabled = true;
      editNote.textContent = '';
      const result = await sb.from('profiles').update({
        display_name: displayName,
        city: document.getElementById('editCity').value.trim(),
        status: document.getElementById('editStatus').value.trim(),
        mood: document.getElementById('editMood').value.trim(),
        bio: document.getElementById('editBio').value.trim()
      }).eq('id', currentUser.id);
      saveButton.disabled = false;
      if (result.error) {
        editNote.textContent = text('save_fail');
        return;
      }
      showToast(text('save_ok'));
      closeModal();
      await loadSpace();
    });
  }

  document.getElementById('closeEditButton').addEventListener('click', closeModal);
  document.getElementById('cancelEditButton').addEventListener('click', closeModal);
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });

  if (logoutButton) {
    logoutButton.addEventListener('click', async function () {
      logoutButton.disabled = true;
      showToast(text('logout_loading'));
      await sb.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  showToast(text('auth_loading'));
  loadSpace();
})();
