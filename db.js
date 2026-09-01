// db.js — IndexedDB永続化レイヤー
// 音声データ（Blob）は IndexedDB に、軽量な設定値は localStorage に保存する。

const DB_NAME = 'choirPracticeDB';
const DB_VERSION = 1;

const STORE_SONGS = 'songs';
const STORE_TRACKS = 'tracks';
const STORE_MEMOS = 'memos';
const STORE_PRESETS = 'presets';

let dbInstance = null;

/** DB接続を開く（初回はスキーマを作成） */
function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_SONGS)) {
        const songs = db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
        songs.createIndex('title', 'title', { unique: false });
        songs.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        const tracks = db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
        tracks.createIndex('songId', 'songId', { unique: false });
        tracks.createIndex('order', 'order', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_MEMOS)) {
        const memos = db.createObjectStore(STORE_MEMOS, { keyPath: 'id' });
        memos.createIndex('songId', 'songId', { unique: false });
        memos.createIndex('trackId', 'trackId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PRESETS)) {
        const presets = db.createObjectStore(STORE_PRESETS, { keyPath: 'id' });
        presets.createIndex('songId', 'songId', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      dbInstance.onversionchange = () => { dbInstance.close(); dbInstance = null; };
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('データベースが他のタブで使用中です。他のタブを閉じてから再度お試しください。'));
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** ストレージ容量不足などのエラーを判定してわかりやすいメッセージに変換する */
function friendlyStorageError(err) {
  const name = err && err.name ? err.name : '';
  if (name === 'QuotaExceededError' || name === 'QUOTA_EXCEEDED_ERR') {
    return new Error('端末の保存容量が不足している可能性があります。不要な音源を削除してから、もう一度お試しください。');
  }
  return new Error('データの保存中にエラーが発生しました。もう一度お試しください。');
}

const DB = {
  // ---------- Songs ----------
  async addSong(song) {
    try {
      const store = await tx(STORE_SONGS, 'readwrite');
      await reqToPromise(store.add(song));
      return song;
    } catch (err) { throw friendlyStorageError(err); }
  },
  async updateSong(song) {
    try {
      const store = await tx(STORE_SONGS, 'readwrite');
      await reqToPromise(store.put(song));
      return song;
    } catch (err) { throw friendlyStorageError(err); }
  },
  async deleteSong(id) {
    const store = await tx(STORE_SONGS, 'readwrite');
    await reqToPromise(store.delete(id));
  },
  async getSong(id) {
    const store = await tx(STORE_SONGS);
    return reqToPromise(store.get(id));
  },
  async getAllSongs() {
    const store = await tx(STORE_SONGS);
    return reqToPromise(store.getAll());
  },

  // ---------- Tracks ----------
  async addTrack(track) {
    try {
      const store = await tx(STORE_TRACKS, 'readwrite');
      await reqToPromise(store.add(track));
      return track;
    } catch (err) { throw friendlyStorageError(err); }
  },
  async updateTrack(track) {
    try {
      const store = await tx(STORE_TRACKS, 'readwrite');
      await reqToPromise(store.put(track));
      return track;
    } catch (err) { throw friendlyStorageError(err); }
  },
  async deleteTrack(id) {
    const store = await tx(STORE_TRACKS, 'readwrite');
    await reqToPromise(store.delete(id));
  },
  async getTrack(id) {
    const store = await tx(STORE_TRACKS);
    return reqToPromise(store.get(id));
  },
  async getTracksBySong(songId) {
    const store = await tx(STORE_TRACKS);
    const idx = store.index('songId');
    return reqToPromise(idx.getAll(IDBKeyRange.only(songId)));
  },
  async deleteTracksBySong(songId) {
    const tracks = await this.getTracksBySong(songId);
    const store = await tx(STORE_TRACKS, 'readwrite');
    for (const t of tracks) store.delete(t.id);
  },

  // ---------- Memos ----------
  async addMemo(memo) {
    try {
      const store = await tx(STORE_MEMOS, 'readwrite');
      await reqToPromise(store.add(memo));
      return memo;
    } catch (err) { throw friendlyStorageError(err); }
  },
  async updateMemo(memo) {
    try {
      const store = await tx(STORE_MEMOS, 'readwrite');
      await reqToPromise(store.put(memo));
      return memo;
    } catch (err) { throw friendlyStorageError(err); }
  },
  async deleteMemo(id) {
    const store = await tx(STORE_MEMOS, 'readwrite');
    await reqToPromise(store.delete(id));
  },
  async getMemosBySong(songId) {
    const store = await tx(STORE_MEMOS);
    const idx = store.index('songId');
    return reqToPromise(idx.getAll(IDBKeyRange.only(songId)));
  },
  async deleteMemosBySong(songId) {
    const memos = await this.getMemosBySong(songId);
    const store = await tx(STORE_MEMOS, 'readwrite');
    for (const m of memos) store.delete(m.id);
  },

  // ---------- Presets ----------
  async addPreset(preset) {
    try {
      const store = await tx(STORE_PRESETS, 'readwrite');
      await reqToPromise(store.add(preset));
      return preset;
    } catch (err) { throw friendlyStorageError(err); }
  },
  async updatePreset(preset) {
    try {
      const store = await tx(STORE_PRESETS, 'readwrite');
      await reqToPromise(store.put(preset));
      return preset;
    } catch (err) { throw friendlyStorageError(err); }
  },
  async deletePreset(id) {
    const store = await tx(STORE_PRESETS, 'readwrite');
    await reqToPromise(store.delete(id));
  },
  async getPresetsBySong(songId) {
    const store = await tx(STORE_PRESETS);
    const idx = store.index('songId');
    return reqToPromise(idx.getAll(IDBKeyRange.only(songId)));
  },
  async deletePresetsBySong(songId) {
    const presets = await this.getPresetsBySong(songId);
    const store = await tx(STORE_PRESETS, 'readwrite');
    for (const p of presets) store.delete(p.id);
  },

  /** 曲を関連データごとすべて削除する */
  async deleteSongCascade(songId) {
    await this.deleteTracksBySong(songId);
    await this.deleteMemosBySong(songId);
    await this.deletePresetsBySong(songId);
    await this.deleteSong(songId);
  },

  /** バックアップ用に全データを取り出す（音声Blobを含むトラック情報も含む） */
  async exportAllMeta() {
    const [songs, tracksStore, memosStore, presetsStore] = await Promise.all([
      this.getAllSongs(),
      tx(STORE_TRACKS),
      tx(STORE_MEMOS),
      tx(STORE_PRESETS),
    ]);
    const [tracks, memos, presets] = await Promise.all([
      reqToPromise(tracksStore.getAll()),
      reqToPromise(memosStore.getAll()),
      reqToPromise(presetsStore.getAll()),
    ]);
    return { songs, tracks, memos, presets };
  },
};

// ---------- localStorage: 軽量設定 ----------
const SETTINGS_KEY = 'choir_settings_v1';

const Settings = {
  defaults: {
    theme: 'auto', // 'auto' | 'light' | 'dark'
    defaultRate: 1,
    sortBy: 'createdAt', // 'createdAt' | 'title' | 'part'
    keyboardEnabled: true,
  },
  load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...this.defaults };
      return { ...this.defaults, ...JSON.parse(raw) };
    } catch {
      return { ...this.defaults };
    }
  },
  save(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch {
      return false;
    }
  },
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
