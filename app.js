// app.js — アプリ全体の制御
(() => {
  'use strict';

  const PART_ICONS = {
    'ソプラノ': '🎤', 'アルト': '🎤', '男声': '🎤',
    '全体': '🎶', 'ピアノ伴奏': '🎹',
  };
  const partIcon = (part) => PART_ICONS[part] || '🎵';

  // ---------- DOM参照 ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    backBtn: $('backBtn'), pageTitle: $('pageTitle'),
    searchToggleBtn: $('searchToggleBtn'), themeToggleBtn: $('themeToggleBtn'),
    menuBtn: $('menuBtn'), menuDropdown: $('menuDropdown'),
    menuExportBtn: $('menuExportBtn'), menuImportBtn: $('menuImportBtn'), menuSettingsBtn: $('menuSettingsBtn'),
    searchBar: $('searchBar'), searchInput: $('searchInput'),

    homeScreen: $('homeScreen'), songScreen: $('songScreen'),
    addSongBtn: $('addSongBtn'), sortSelect: $('sortSelect'),
    songList: $('songList'), emptyState: $('emptyState'),

    songTitleEl: $('songTitleEl'), editSongBtn: $('editSongBtn'), deleteSongBtn: $('deleteSongBtn'),
    resumeBanner: $('resumeBanner'), resumeBannerText: $('resumeBannerText'), resumeFromStartBtn: $('resumeFromStartBtn'),

    addTrackBtn: $('addTrackBtn'), trackList: $('trackList'), trackEmptyState: $('trackEmptyState'),
    trackSortSelect: $('trackSortSelect'), quickAllBtn: $('quickAllBtn'), quickMuteBtn: $('quickMuteBtn'),

    addPresetBtn: $('addPresetBtn'), presetList: $('presetList'), presetEmptyState: $('presetEmptyState'),
    addMemoBtn: $('addMemoBtn'), memoList: $('memoList'), memoEmptyState: $('memoEmptyState'),

    playerBar: $('playerBar'), playBtn: $('playBtn'), back10Btn: $('back10Btn'), fwd10Btn: $('fwd10Btn'),
    seekBar: $('seekBar'), currentTimeEl: $('currentTimeEl'), totalTimeEl: $('totalTimeEl'),
    volumeBtn: $('volumeBtn'), rateBtn: $('rateBtn'), repeatBtn: $('repeatBtn'),
    abBtn: $('abBtn'), abClearBtn: $('abClearBtn'), abLabel: $('abLabel'),

    modalOverlay: $('modalOverlay'),
    songModal: $('songModal'), songModalTitle: $('songModalTitle'), songTitleInput: $('songTitleInput'),
    songModalCancelBtn: $('songModalCancelBtn'), songModalSaveBtn: $('songModalSaveBtn'),

    trackModal: $('trackModal'), trackModalTitle: $('trackModalTitle'),
    trackFileField: $('trackFileField'), trackFileInput: $('trackFileInput'), trackFileName: $('trackFileName'),
    trackNameInput: $('trackNameInput'), trackPartSelect: $('trackPartSelect'), trackPartCustomInput: $('trackPartCustomInput'),
    trackModalCancelBtn: $('trackModalCancelBtn'), trackModalSaveBtn: $('trackModalSaveBtn'),

    presetModal: $('presetModal'), presetModalTitle: $('presetModalTitle'), presetNameInput: $('presetNameInput'),
    presetSliders: $('presetSliders'), presetModalDeleteBtn: $('presetModalDeleteBtn'),
    presetModalCancelBtn: $('presetModalCancelBtn'), presetModalSaveBtn: $('presetModalSaveBtn'),

    memoModal: $('memoModal'), memoModalTitle: $('memoModalTitle'),
    memoTimeCheckbox: $('memoTimeCheckbox'), memoTimeValue: $('memoTimeValue'), memoTextInput: $('memoTextInput'),
    memoModalDeleteBtn: $('memoModalDeleteBtn'), memoModalCancelBtn: $('memoModalCancelBtn'), memoModalSaveBtn: $('memoModalSaveBtn'),

    confirmModal: $('confirmModal'), confirmModalTitle: $('confirmModalTitle'), confirmModalBody: $('confirmModalBody'),
    confirmModalCancelBtn: $('confirmModalCancelBtn'), confirmModalOkBtn: $('confirmModalOkBtn'),

    settingsModal: $('settingsModal'), themeSelect: $('themeSelect'), defaultRateSelect: $('defaultRateSelect'),
    settingsModalCloseBtn: $('settingsModalCloseBtn'),

    importModal: $('importModal'), importZipInput: $('importZipInput'), importStatus: $('importStatus'),
    importModalCancelBtn: $('importModalCancelBtn'), importModalRunBtn: $('importModalRunBtn'),

    toastRegion: $('toastRegion'),
  };

  // ---------- アプリ状態 ----------
  const state = {
    screen: 'home',           // 'home' | 'song'
    songs: [],                 // ホーム画面キャッシュ
    tracksBySong: new Map(),   // songId -> tracks[]（検索・カード表示用キャッシュ）
    settings: Settings.load(),
    searchQuery: '',
    currentSong: null,
    currentTracks: [],
    currentPresets: [],
    currentMemos: [],
    engine: new AudioEngine(),
    player: null,
    trackSort: 'manual',
    progressTimer: null,
    dragTrackId: null,
  };

  // プレイヤーUIのイベントハンドラはアプリ全体で1回だけ登録する。
  // 曲を開くたびに生成すると、同じボタンにイベントが多重登録される。
  state.player = new PlayerController(state.engine, els, {
    onPositionChange: () => {},
    onEnded: () => toast('再生が終了しました'),
  });

  // ---------- トースト ----------
  function toast(message, type = '') {
    const el = document.createElement('div');
    el.className = `toast${type ? ' ' + type : ''}`;
    el.textContent = message;
    els.toastRegion.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }
  function showError(err, fallback = '操作に失敗しました。') {
    console.error(err);
    toast((err && err.message) ? err.message : fallback, 'error');
  }

  // ---------- モーダル制御 ----------
  let activeModal = null;
  function openModal(modalEl) {
    els.modalOverlay.hidden = false;
    modalEl.hidden = false;
    activeModal = modalEl;
    const firstInput = modalEl.querySelector('input, select, textarea, button');
    if (firstInput) setTimeout(() => firstInput.focus(), 30);
  }
  function closeModal() {
    if (activeModal) activeModal.hidden = true;
    els.modalOverlay.hidden = true;
    activeModal = null;
  }
  els.modalOverlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal) closeModal();
  });

  function confirmDialog(title, body) {
    return new Promise((resolve) => {
      els.confirmModalTitle.textContent = title;
      els.confirmModalBody.textContent = body;
      openModal(els.confirmModal);
      const cleanup = () => {
        els.confirmModalOkBtn.removeEventListener('click', onOk);
        els.confirmModalCancelBtn.removeEventListener('click', onCancel);
      };
      const onOk = () => { cleanup(); closeModal(); resolve(true); };
      const onCancel = () => { cleanup(); closeModal(); resolve(false); };
      els.confirmModalOkBtn.addEventListener('click', onOk);
      els.confirmModalCancelBtn.addEventListener('click', onCancel);
    });
  }

  // ---------- ナビゲーション ----------
  async function showHome() {
    // 画面状態を切り替える前に、現在位置を保存する。
    await saveProgress();
    state.screen = 'home';
    stopProgressTimer();
    state.engine.reset();
    els.playerBar.hidden = true;
    els.songScreen.hidden = true;
    els.homeScreen.hidden = false;
    els.backBtn.hidden = true;
    els.pageTitle.textContent = '🎼 合唱練習';
    els.searchInput.placeholder = '曲名・音源名・パート名で検索';
    await loadHome();
  }

  async function showSong(songId) {
    try {
      const song = await DB.getSong(songId);
      if (!song) { toast('曲が見つかりませんでした', 'error'); return showHome(); }
      state.screen = 'song';
      state.currentSong = song;
      els.homeScreen.hidden = true;
      els.songScreen.hidden = false;
      els.backBtn.hidden = false;
      els.pageTitle.textContent = song.title;
      els.searchInput.placeholder = '音源名・パート名で検索';

      els.songTitleEl.textContent = song.title;
      state.engine.reset();
      state.player.reset();
      await state.player.setRate(state.settings.defaultRate || 1);

      await loadSongTracks();
      await loadPresets();
      await loadMemos();

      els.playerBar.hidden = false;
      startProgressTimer();

      if (song.lastPosition > 0) {
        els.resumeBanner.hidden = false;
        els.resumeBannerText.textContent = `前回の位置 ${formatTime(song.lastPosition)} から再開できます`;
        await state.engine.seek(song.lastPosition);
      } else {
        els.resumeBanner.hidden = true;
      }
    } catch (err) {
      showError(err, '曲を開けませんでした。');
      showHome();
    }
  }

  els.backBtn.addEventListener('click', showHome);
  els.resumeFromStartBtn.addEventListener('click', async () => {
    await state.engine.seek(0);
    els.resumeBanner.hidden = true;
  });

  // ---------- 進捗の保存 ----------
  function startProgressTimer() {
    stopProgressTimer();
    state.progressTimer = setInterval(saveProgress, 2500);
  }
  function stopProgressTimer() {
    if (state.progressTimer) { clearInterval(state.progressTimer); state.progressTimer = null; }
    if (state.currentSong) saveProgress();
  }
  async function saveProgress() {
    if (!state.currentSong || state.screen !== 'song') return;
    const pos = state.engine.getPosition();
    state.currentSong.lastPosition = pos;
    state.currentSong.updatedAt = Date.now();
    try { await DB.updateSong(state.currentSong); } catch { /* 保存失敗は静かに無視（次回再試行） */ }
    if (state.engine.playing) {
      for (const t of state.currentTracks) {
        t.lastPosition = Math.min(pos, t.duration || pos);
        t.lastPlayedAt = Date.now();
      }
      const store = state.currentTracks;
      for (const t of store) { try { await DB.updateTrack(t); } catch {} }
    }
  }
  window.addEventListener('beforeunload', () => { if (state.currentSong) saveProgress(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.currentSong) saveProgress();
  });

  // ============================================================
  // ホーム画面
  // ============================================================
  async function loadHome() {
    try {
      const songs = await DB.getAllSongs();
      state.songs = songs;
      state.tracksBySong.clear();
      await Promise.all(songs.map(async (s) => {
        const tracks = await DB.getTracksBySong(s.id);
        state.tracksBySong.set(s.id, tracks);
      }));
      renderHome();
    } catch (err) {
      showError(err, '曲の読み込みに失敗しました。');
    }
  }

  function renderHome() {
    const q = state.searchQuery.trim().toLowerCase();
    let songs = state.songs.filter((s) => {
      if (!q) return true;
      if (s.title.toLowerCase().includes(q)) return true;
      const tracks = state.tracksBySong.get(s.id) || [];
      return tracks.some((t) => t.name.toLowerCase().includes(q) || t.part.toLowerCase().includes(q));
    });

    songs = songs.slice().sort((a, b) => {
      if (state.settings.sortBy === 'title') return a.title.localeCompare(b.title, 'ja');
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    els.songList.innerHTML = '';
    els.emptyState.hidden = songs.length > 0;
    els.sortSelect.value = state.settings.sortBy;

    for (const song of songs) {
      const tracks = state.tracksBySong.get(song.id) || [];
      const parts = [...new Set(tracks.map((t) => t.part))];
      let lastText = '未再生';
      const played = tracks.filter((t) => t.lastPlayedAt).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)[0];
      if (song.lastPosition > 0) {
        lastText = `続き ${formatTime(song.lastPosition)}${played ? '（' + played.name + '）' : ''}`;
      }

      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'song-card';
      btn.innerHTML = `
        <span class="song-card-title">🎼 ${escapeHtml(song.title)}</span>
        <span class="song-card-meta">
          <span>${parts.length ? escapeHtml(parts.join('・')) : 'パート未登録'}</span>
          <span>音源数: ${tracks.length}</span>
          <span>${escapeHtml(lastText)}</span>
        </span>`;
      btn.addEventListener('click', () => showSong(song.id));
      li.appendChild(btn);
      els.songList.appendChild(li);
    }
  }

  els.sortSelect.addEventListener('change', () => {
    state.settings.sortBy = els.sortSelect.value;
    Settings.save(state.settings);
    renderHome();
  });

  els.addSongBtn.addEventListener('click', () => openSongModal(null));

  // ---------- 曲モーダル ----------
  let songModalEditing = null;
  function openSongModal(song) {
    songModalEditing = song;
    els.songModalTitle.textContent = song ? '曲名を編集' : '曲を追加';
    els.songTitleInput.value = song ? song.title : '';
    openModal(els.songModal);
  }
  els.songModalCancelBtn.addEventListener('click', closeModal);
  els.songModalSaveBtn.addEventListener('click', async () => {
    const title = els.songTitleInput.value.trim();
    if (!title) { toast('曲名を入力してください', 'error'); return; }
    try {
      if (songModalEditing) {
        songModalEditing.title = title;
        songModalEditing.updatedAt = Date.now();
        await DB.updateSong(songModalEditing);
        if (state.currentSong && state.currentSong.id === songModalEditing.id) {
          state.currentSong.title = title;
          els.songTitleEl.textContent = title;
          els.pageTitle.textContent = title;
        }
        closeModal();
        toast('曲名を更新しました', 'success');
        if (state.screen === 'home') await loadHome();
      } else {
        const song = { id: uid(), title, createdAt: Date.now(), updatedAt: Date.now(), lastPosition: 0 };
        await DB.addSong(song);
        closeModal();
        toast('曲を追加しました', 'success');
        await showSong(song.id);
      }
    } catch (err) {
      showError(err, '曲の保存に失敗しました。');
    }
  });

  els.editSongBtn.addEventListener('click', () => openSongModal(state.currentSong));
  els.deleteSongBtn.addEventListener('click', async () => {
    if (!state.currentSong) return;
    const ok = await confirmDialog('この曲を削除しますか？', 'この操作は元に戻せません。登録されている音源・メモ・プリセットもすべて削除されます。');
    if (!ok) return;
    try {
      await DB.deleteSongCascade(state.currentSong.id);
      toast('曲を削除しました', 'success');
      await showHome();
    } catch (err) {
      showError(err, '削除に失敗しました。');
    }
  });

  // ============================================================
  // 曲詳細画面：音源
  // ============================================================
  async function loadSongTracks() {
    const tracks = await DB.getTracksBySong(state.currentSong.id);
    state.currentTracks = tracks;
    state.engine.reset();

    let loadedCount = 0;
    for (const t of tracks) {
      try {
        const dur = await state.engine.loadTrack(t.id, t.blob, (t.volume ?? 100) / 100);
        t.duration = dur;
        loadedCount++;
      } catch (err) {
        toast(`「${t.name}」を読み込めませんでした: ${err.message}`, 'error');
      }
    }
    if (state.player) state.player.reset();
    renderTracks();
  }

  function sortTracks(tracks) {
    const list = tracks.slice();
    switch (state.trackSort) {
      case 'name': list.sort((a, b) => a.name.localeCompare(b.name, 'ja')); break;
      case 'part': list.sort((a, b) => a.part.localeCompare(b.part, 'ja')); break;
      case 'createdAt': list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); break;
      default: list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return list;
  }

  function renderTracks() {
    const q = state.searchQuery.trim().toLowerCase();
    let tracks = state.currentTracks.filter((t) => {
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.part.toLowerCase().includes(q);
    });
    tracks = sortTracks(tracks);

    els.trackList.innerHTML = '';
    els.trackEmptyState.hidden = tracks.length > 0;
    els.trackSortSelect.value = state.trackSort;

    for (const t of tracks) {
      const li = document.createElement('li');
      li.className = 'track-item' + ((t.volume ?? 0) > 0 ? ' active' : '');
      li.dataset.id = t.id;
      li.draggable = state.trackSort === 'manual';

      const playingBadge = (t.volume ?? 0) > 0 ? '<span class="now-playing-badge">🔊 有効</span>' : '';
      li.innerHTML = `
        <div class="track-top-row">
          ${state.trackSort === 'manual' ? '<span class="drag-handle" aria-hidden="true">⠿</span>' : ''}
          <span class="track-part-icon" aria-hidden="true">${partIcon(t.part)}</span>
          <span class="track-names">
            <div class="track-name">${escapeHtml(t.name)}${playingBadge}</div>
            <div class="track-part">${escapeHtml(t.part)}</div>
          </span>
          <span class="track-actions">
            <button class="icon-btn" data-action="edit" aria-label="音源を編集">✏️</button>
            <button class="icon-btn" data-action="delete" aria-label="音源を削除">🗑️</button>
          </span>
        </div>
        <div class="track-volume-row">
          <button class="solo-btn" data-action="solo">ソロ</button>
          <span aria-hidden="true">🔈</span>
          <input type="range" min="0" max="100" step="1" value="${t.volume ?? 100}" aria-label="${escapeHtml(t.name)}の音量" />
          <span class="track-volume-value">${t.volume ?? 100}%</span>
        </div>`;

      const range = li.querySelector('input[type="range"]');
      const valueLabel = li.querySelector('.track-volume-value');
      range.addEventListener('input', async () => {
        const v = Number(range.value);
        t.volume = v;
        valueLabel.textContent = `${v}%`;
        li.classList.toggle('active', v > 0);
        state.engine.setTrackVolume(t.id, v / 100);
      });
      range.addEventListener('change', () => { DB.updateTrack(t).catch(() => {}); renderTrackBadge(li, t); });

      li.querySelector('[data-action="edit"]').addEventListener('click', () => openTrackModal(t));
      li.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTrack(t));
      li.querySelector('[data-action="solo"]').addEventListener('click', () => soloTrack(t.id));

      if (state.trackSort === 'manual') {
        li.addEventListener('dragstart', () => { state.dragTrackId = t.id; li.classList.add('dragging'); });
        li.addEventListener('dragend', () => { li.classList.remove('dragging'); renderTracks(); });
        li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
        li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          li.classList.remove('drag-over');
          reorderTracks(state.dragTrackId, t.id);
        });
      }

      els.trackList.appendChild(li);
    }
  }

  function renderTrackBadge(li, t) {
    const nameDiv = li.querySelector('.track-name');
    const badge = (t.volume ?? 0) > 0 ? '<span class="now-playing-badge">🔊 再生中</span>' : '';
    nameDiv.innerHTML = `${escapeHtml(t.name)}${badge}`;
  }

  async function reorderTracks(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;
    const ordered = sortTracks(state.currentTracks).map((t) => t.id);
    const from = ordered.indexOf(draggedId);
    const to = ordered.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    ordered.forEach((id, idx) => {
      const t = state.currentTracks.find((tr) => tr.id === id);
      if (t) t.order = idx;
    });
    for (const t of state.currentTracks) { try { await DB.updateTrack(t); } catch {} }
    renderTracks();
  }

  function soloTrack(trackId) {
    for (const t of state.currentTracks) {
      t.volume = (t.id === trackId) ? 100 : 0;
      state.engine.setTrackVolume(t.id, t.volume / 100);
      DB.updateTrack(t).catch(() => {});
    }
    renderTracks();
  }

  els.trackSortSelect.addEventListener('change', () => {
    state.trackSort = els.trackSortSelect.value;
    renderTracks();
  });

  els.quickAllBtn.addEventListener('click', () => {
    for (const t of state.currentTracks) {
      t.volume = 100;
      state.engine.setTrackVolume(t.id, 1);
      DB.updateTrack(t).catch(() => {});
    }
    renderTracks();
  });
  els.quickMuteBtn.addEventListener('click', () => {
    for (const t of state.currentTracks) {
      t.volume = 0;
      state.engine.setTrackVolume(t.id, 0);
      DB.updateTrack(t).catch(() => {});
    }
    renderTracks();
  });

  // ---------- 音源モーダル ----------
  let trackModalEditing = null;
  let trackModalFile = null;
  function openTrackModal(track) {
    trackModalEditing = track;
    trackModalFile = null;
    els.trackModalTitle.textContent = track ? '音源を編集' : '音源を追加';
    els.trackFileField.hidden = !!track;
    els.trackFileInput.value = '';
    els.trackFileName.textContent = '';
    els.trackNameInput.value = track ? track.name : '';
    const knownParts = ['ソプラノ', 'アルト', '男声', '全体', 'ピアノ伴奏'];
    if (track && !knownParts.includes(track.part)) {
      els.trackPartSelect.value = 'その他';
      els.trackPartCustomInput.hidden = false;
      els.trackPartCustomInput.value = track.part;
    } else {
      els.trackPartSelect.value = track ? track.part : 'ソプラノ';
      els.trackPartCustomInput.hidden = true;
      els.trackPartCustomInput.value = '';
    }
    openModal(els.trackModal);
  }
  els.trackModalCancelBtn.addEventListener('click', closeModal);
  els.trackFileInput.addEventListener('change', () => {
    const f = els.trackFileInput.files[0];
    trackModalFile = f || null;
    els.trackFileName.textContent = f ? f.name : '';
  });
  els.trackPartSelect.addEventListener('change', () => {
    els.trackPartCustomInput.hidden = els.trackPartSelect.value !== 'その他';
  });

  els.trackModalSaveBtn.addEventListener('click', async () => {
    const name = els.trackNameInput.value.trim();
    if (!name) { toast('音源名を入力してください', 'error'); return; }
    let part = els.trackPartSelect.value;
    if (part === 'その他') {
      part = els.trackPartCustomInput.value.trim();
      if (!part) { toast('パート名を入力してください', 'error'); return; }
    }

    try {
      if (trackModalEditing) {
        trackModalEditing.name = name;
        trackModalEditing.part = part;
        await DB.updateTrack(trackModalEditing);
        closeModal();
        toast('音源を更新しました', 'success');
        renderTracks();
        return;
      }

      if (!trackModalFile) { toast('音声ファイルを選択してください', 'error'); return; }
      if (!isLikelySupportedAudio(trackModalFile)) {
        toast('対応していない音声形式の可能性があります（MP3 / WAV / M4A / AAC / OGG / WebMをご利用ください）', 'error');
        return;
      }
      els.trackModalSaveBtn.disabled = true;
      const id = uid();
      let duration = 0;
      try {
        duration = await state.engine.loadTrack(id, trackModalFile, 1);
      } catch (err) {
        els.trackModalSaveBtn.disabled = false;
        toast(err.message, 'error');
        return;
      }
      const track = {
        id, songId: state.currentSong.id, name, part,
        blob: trackModalFile, mime: trackModalFile.type, duration,
        createdAt: Date.now(), order: state.currentTracks.length,
        volume: 100, lastPosition: 0, lastPlayedAt: null,
      };
      await DB.addTrack(track);
      state.currentTracks.push(track);
      els.trackModalSaveBtn.disabled = false;
      closeModal();
      toast('音源を追加しました', 'success');
      renderTracks();
    } catch (err) {
      els.trackModalSaveBtn.disabled = false;
      showError(err, '音源の保存に失敗しました。');
    }
  });

  async function deleteTrack(track) {
    const ok = await confirmDialog('この音源を削除しますか？', 'この操作は元に戻せません。');
    if (!ok) return;
    try {
      await DB.deleteTrack(track.id);
      state.engine.removeTrack(track.id);
      state.currentTracks = state.currentTracks.filter((t) => t.id !== track.id);
      // プリセットからも参照を削除
      for (const p of state.currentPresets) {
        if (p.volumes && (track.id in p.volumes)) {
          delete p.volumes[track.id];
          await DB.updatePreset(p).catch(() => {});
        }
      }
      toast('音源を削除しました', 'success');
      renderTracks();
      renderPresets();
    } catch (err) {
      showError(err, '削除に失敗しました。');
    }
  }

  els.addTrackBtn.addEventListener('click', () => openTrackModal(null));

  // ============================================================
  // プリセット
  // ============================================================
  async function loadPresets() {
    state.currentPresets = await DB.getPresetsBySong(state.currentSong.id);
    renderPresets();
  }

  function renderPresets() {
    els.presetList.innerHTML = '';
    els.presetEmptyState.hidden = state.currentPresets.length > 0;
    for (const p of state.currentPresets) {
      const li = document.createElement('li');
      li.className = 'preset-chip';
      li.innerHTML = `
        <button class="preset-apply">⭐ ${escapeHtml(p.name)}</button>
        <button class="icon-btn" data-action="edit" aria-label="プリセットを編集">✏️</button>`;
      li.querySelector('.preset-apply').addEventListener('click', () => applyPreset(p));
      li.querySelector('[data-action="edit"]').addEventListener('click', () => openPresetModal(p));
      els.presetList.appendChild(li);
    }
  }

  function applyPreset(preset) {
    for (const t of state.currentTracks) {
      const v = preset.volumes && (t.id in preset.volumes) ? preset.volumes[t.id] : 0;
      t.volume = v;
      state.engine.setTrackVolume(t.id, v / 100);
      DB.updateTrack(t).catch(() => {});
    }
    renderTracks();
    toast(`「${preset.name}」を適用しました`, 'success');
  }

  let presetModalEditing = null;
  function openPresetModal(preset) {
    presetModalEditing = preset;
    els.presetModalTitle.textContent = preset ? 'プリセットを編集' : '新規プリセット';
    els.presetNameInput.value = preset ? preset.name : '';
    els.presetModalDeleteBtn.hidden = !preset;
    els.presetSliders.innerHTML = '';
    for (const t of state.currentTracks) {
      const initial = preset && preset.volumes && (t.id in preset.volumes) ? preset.volumes[t.id] : (t.volume ?? 100);
      const row = document.createElement('div');
      row.className = 'preset-slider-row';
      row.dataset.trackId = t.id;
      row.innerHTML = `
        <label>${escapeHtml(t.name)}</label>
        <input type="range" min="0" max="100" step="1" value="${initial}" aria-label="${escapeHtml(t.name)}" />
        <span class="track-volume-value">${initial}%</span>`;
      const range = row.querySelector('input');
      const val = row.querySelector('.track-volume-value');
      range.addEventListener('input', () => { val.textContent = `${range.value}%`; });
      els.presetSliders.appendChild(row);
    }
    openModal(els.presetModal);
  }
  els.addPresetBtn.addEventListener('click', () => {
    if (state.currentTracks.length === 0) { toast('先に音源を登録してください', 'error'); return; }
    openPresetModal(null);
  });
  els.presetModalCancelBtn.addEventListener('click', closeModal);
  els.presetModalSaveBtn.addEventListener('click', async () => {
    const name = els.presetNameInput.value.trim();
    if (!name) { toast('プリセット名を入力してください', 'error'); return; }
    const volumes = {};
    els.presetSliders.querySelectorAll('.preset-slider-row').forEach((row) => {
      volumes[row.dataset.trackId] = Number(row.querySelector('input').value);
    });
    try {
      if (presetModalEditing) {
        presetModalEditing.name = name;
        presetModalEditing.volumes = volumes;
        await DB.updatePreset(presetModalEditing);
      } else {
        const preset = { id: uid(), songId: state.currentSong.id, name, volumes, createdAt: Date.now() };
        await DB.addPreset(preset);
        state.currentPresets.push(preset);
      }
      closeModal();
      toast('プリセットを保存しました', 'success');
      renderPresets();
    } catch (err) {
      showError(err, 'プリセットの保存に失敗しました。');
    }
  });
  els.presetModalDeleteBtn.addEventListener('click', async () => {
    if (!presetModalEditing) return;
    const ok = await confirmDialog('このプリセットを削除しますか？', 'この操作は元に戻せません。');
    if (!ok) return;
    try {
      await DB.deletePreset(presetModalEditing.id);
      state.currentPresets = state.currentPresets.filter((p) => p.id !== presetModalEditing.id);
      closeModal();
      toast('プリセットを削除しました', 'success');
      renderPresets();
    } catch (err) {
      showError(err, '削除に失敗しました。');
    }
  });

  // ============================================================
  // メモ
  // ============================================================
  async function loadMemos() {
    state.currentMemos = await DB.getMemosBySong(state.currentSong.id);
    renderMemos();
  }

  function renderMemos() {
    const memos = state.currentMemos.slice().sort((a, b) => {
      if (a.time == null && b.time == null) return a.createdAt - b.createdAt;
      if (a.time == null) return 1;
      if (b.time == null) return -1;
      return a.time - b.time;
    });
    els.memoList.innerHTML = '';
    els.memoEmptyState.hidden = memos.length > 0;
    for (const m of memos) {
      const li = document.createElement('li');
      li.className = 'memo-item';
      li.innerHTML = `
        ${m.time != null ? `<button class="memo-time-btn" data-action="seek">${formatTime(m.time)}〜</button>` : ''}
        <span class="memo-text">${escapeHtml(m.text)}</span>
        <span class="memo-actions">
          <button class="icon-btn" data-action="edit" aria-label="メモを編集">✏️</button>
        </span>`;
      const seekBtn = li.querySelector('[data-action="seek"]');
      if (seekBtn) seekBtn.addEventListener('click', () => state.engine.seek(m.time));
      li.querySelector('[data-action="edit"]').addEventListener('click', () => openMemoModal(m));
      els.memoList.appendChild(li);
    }
  }

  let memoModalEditing = null;
  function openMemoModal(memo) {
    memoModalEditing = memo;
    els.memoModalTitle.textContent = memo ? 'メモを編集' : 'メモを追加';
    const currentPos = state.engine.getPosition();
    els.memoTimeValue.textContent = formatTime(memo ? (memo.time ?? currentPos) : currentPos);
    els.memoTimeCheckbox.checked = memo ? memo.time != null : true;
    els.memoTimeCheckbox.dataset.capturedTime = String(memo && memo.time != null ? memo.time : currentPos);
    els.memoTextInput.value = memo ? memo.text : '';
    els.memoModalDeleteBtn.hidden = !memo;
    openModal(els.memoModal);
  }
  els.addMemoBtn.addEventListener('click', () => openMemoModal(null));
  els.memoModalCancelBtn.addEventListener('click', closeModal);
  els.memoModalSaveBtn.addEventListener('click', async () => {
    const text = els.memoTextInput.value.trim();
    if (!text) { toast('メモの内容を入力してください', 'error'); return; }
    const time = els.memoTimeCheckbox.checked ? Number(els.memoTimeCheckbox.dataset.capturedTime) : null;
    try {
      if (memoModalEditing) {
        memoModalEditing.text = text;
        memoModalEditing.time = time;
        await DB.updateMemo(memoModalEditing);
      } else {
        const memo = { id: uid(), songId: state.currentSong.id, trackId: null, time, text, createdAt: Date.now() };
        await DB.addMemo(memo);
        state.currentMemos.push(memo);
      }
      closeModal();
      toast('メモを保存しました', 'success');
      renderMemos();
    } catch (err) {
      showError(err, 'メモの保存に失敗しました。');
    }
  });
  els.memoModalDeleteBtn.addEventListener('click', async () => {
    if (!memoModalEditing) return;
    const ok = await confirmDialog('このメモを削除しますか？', 'この操作は元に戻せません。');
    if (!ok) return;
    try {
      await DB.deleteMemo(memoModalEditing.id);
      state.currentMemos = state.currentMemos.filter((m) => m.id !== memoModalEditing.id);
      closeModal();
      toast('メモを削除しました', 'success');
      renderMemos();
    } catch (err) {
      showError(err, '削除に失敗しました。');
    }
  });

  // ============================================================
  // 検索
  // ============================================================
  els.searchToggleBtn.addEventListener('click', () => {
    els.searchBar.hidden = !els.searchBar.hidden;
    if (!els.searchBar.hidden) els.searchInput.focus();
    else { els.searchInput.value = ''; state.searchQuery = ''; renderCurrentScreen(); }
  });
  els.searchInput.addEventListener('input', () => {
    state.searchQuery = els.searchInput.value;
    renderCurrentScreen();
  });
  function renderCurrentScreen() {
    if (state.screen === 'home') renderHome();
    else renderTracks();
  }

  // ============================================================
  // メニュー（⋮）
  // ============================================================
  els.menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = els.menuDropdown.hidden;
    els.menuDropdown.hidden = !willOpen;
    els.menuBtn.setAttribute('aria-expanded', String(willOpen));
  });
  document.addEventListener('click', () => { els.menuDropdown.hidden = true; els.menuBtn.setAttribute('aria-expanded', 'false'); });
  els.menuDropdown.addEventListener('click', (e) => e.stopPropagation());

  els.menuSettingsBtn.addEventListener('click', () => {
    els.menuDropdown.hidden = true;
    els.themeSelect.value = state.settings.theme;
    els.defaultRateSelect.value = String(state.settings.defaultRate);
    openModal(els.settingsModal);
  });
  els.settingsModalCloseBtn.addEventListener('click', closeModal);
  els.themeSelect.addEventListener('change', () => {
    state.settings.theme = els.themeSelect.value;
    Settings.save(state.settings);
    applyTheme();
  });
  els.defaultRateSelect.addEventListener('change', () => {
    state.settings.defaultRate = Number(els.defaultRateSelect.value);
    Settings.save(state.settings);
  });

  // ---------- テーマ ----------
  function applyTheme() {
    const pref = state.settings.theme;
    let effective = pref;
    if (pref === 'auto') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
    els.themeToggleBtn.textContent = effective === 'dark' ? '☀️' : '🌙';
  }
  els.themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    state.settings.theme = current === 'dark' ? 'light' : 'dark';
    Settings.save(state.settings);
    applyTheme();
  });
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.settings.theme === 'auto') applyTheme();
    });
  }

  // ============================================================
  // エクスポート / インポート
  // ============================================================
  els.menuExportBtn.addEventListener('click', async () => {
    els.menuDropdown.hidden = true;
    await exportBackup();
  });
  els.menuImportBtn.addEventListener('click', () => {
    els.menuDropdown.hidden = true;
    els.importZipInput.value = '';
    els.importStatus.textContent = '';
    openModal(els.importModal);
  });
  els.importModalCancelBtn.addEventListener('click', closeModal);

  function extFromMime(mime, fallbackName) {
    const map = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
      'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/webm': 'webm' };
    if (mime && map[mime]) return map[mime];
    const m = (fallbackName || '').match(/\.([a-zA-Z0-9]+)$/);
    return m ? m[1] : 'bin';
  }

  async function exportBackup() {
    if (typeof JSZip === 'undefined') {
      toast('バックアップ機能の読み込みに失敗しました。オンライン状態で一度お試しください。', 'error');
      return;
    }
    try {
      toast('バックアップを作成しています…');
      const { songs, tracks, memos, presets } = await DB.exportAllMeta();
      const zip = new JSZip();
      const audioFolder = zip.folder('audio');
      const tracksMeta = [];
      for (const t of tracks) {
        const ext = extFromMime(t.mime, t.name);
        const filename = `${t.id}.${ext}`;
        audioFolder.file(filename, t.blob);
        tracksMeta.push({
          id: t.id, songId: t.songId, name: t.name, part: t.part, mime: t.mime,
          duration: t.duration, createdAt: t.createdAt, order: t.order,
          volume: t.volume, lastPosition: t.lastPosition, lastPlayedAt: t.lastPlayedAt,
          audioFile: `audio/${filename}`,
        });
      }
      const backup = {
        formatVersion: 1, exportedAt: Date.now(),
        songs, tracks: tracksMeta, memos, presets,
      };
      zip.file('backup.json', JSON.stringify(backup, null, 2));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `合唱練習バックアップ_${date}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('バックアップを保存しました', 'success');
    } catch (err) {
      showError(err, 'バックアップの作成に失敗しました。');
    }
  }

  els.importModalRunBtn.addEventListener('click', async () => {
    const file = els.importZipInput.files[0];
    if (!file) { toast('バックアップファイルを選択してください', 'error'); return; }
    if (typeof JSZip === 'undefined') {
      toast('復元機能の読み込みに失敗しました。オンライン状態で一度お試しください。', 'error');
      return;
    }
    try {
      els.importModalRunBtn.disabled = true;
      els.importStatus.textContent = '読み込み中…';
      const zip = await JSZip.loadAsync(file);
      const jsonEntry = zip.file('backup.json');
      if (!jsonEntry) throw new Error('バックアップファイルの形式が正しくありません（backup.jsonが見つかりません）。');
      const backup = JSON.parse(await jsonEntry.async('string'));
      if (!backup.songs || !backup.tracks) throw new Error('バックアップファイルの内容が正しくありません。');

      let restored = 0;
      for (const song of backup.songs) {
        await DB.updateSong(song); // put系なので追加・上書き両対応
      }
      for (const t of backup.tracks) {
        els.importStatus.textContent = `復元中… ${t.name}`;
        const entry = t.audioFile ? zip.file(t.audioFile) : null;
        if (!entry) { toast(`「${t.name}」の音声ファイルが見つかりませんでした`, 'error'); continue; }
        const blob = await entry.async('blob');
        const track = {
          id: t.id, songId: t.songId, name: t.name, part: t.part,
          blob: new Blob([blob], { type: t.mime || 'audio/mpeg' }), mime: t.mime,
          duration: t.duration, createdAt: t.createdAt, order: t.order,
          volume: t.volume ?? 100, lastPosition: t.lastPosition ?? 0, lastPlayedAt: t.lastPlayedAt ?? null,
        };
        await DB.updateTrack(track);
        restored++;
      }
      for (const m of (backup.memos || [])) await DB.updateMemo(m);
      for (const p of (backup.presets || [])) await DB.updatePreset(p);

      els.importStatus.textContent = '';
      els.importModalRunBtn.disabled = false;
      closeModal();
      toast(`復元が完了しました（音源 ${restored}件）`, 'success');
      if (state.screen === 'home') await loadHome();
    } catch (err) {
      els.importModalRunBtn.disabled = false;
      els.importStatus.textContent = '';
      showError(err, '復元に失敗しました。バックアップファイルをご確認ください。');
    }
  });

  // ============================================================
  // キーボード操作（PC向け）
  // ============================================================
  document.addEventListener('keydown', (e) => {
    if (!state.settings.keyboardEnabled) return;
    if (state.screen !== 'song') return;
    if (activeModal) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    if (e.code === 'Space') { e.preventDefault(); state.player && state.player.togglePlay(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); state.player && state.player.skip(e.shiftKey ? -10 : -5); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); state.player && state.player.skip(e.shiftKey ? 10 : 5); }
  });

  // ============================================================
  // ユーティリティ
  // ============================================================
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ============================================================
  // 初期化
  // ============================================================
  async function init() {
    applyTheme();
    els.defaultRateSelect.value = String(state.settings.defaultRate);

    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('service-worker.js'); }
      catch (err) { console.warn('Service Worker登録に失敗しました', err); }
    }

    try {
      await showHome();
    } catch (err) {
      showError(err, 'アプリの初期化に失敗しました。');
    }
  }

  init();
})();
