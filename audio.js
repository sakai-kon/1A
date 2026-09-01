// audio.js — Web Audio APIを用いた複数音源の同時再生エンジン
// 各トラックを個別のGainNodeに接続し、同一のAudioContext時刻から再生することで
// トラック間のズレを可能な限り防ぐ。

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    /** @type {Map<string, {buffer:AudioBuffer, gainNode:GainNode, sourceNode:AudioBufferSourceNode|null, volume:number}>} */
    this.tracks = new Map();

    this.duration = 0;       // 曲全体の長さ（最長トラック基準）
    this.playing = false;
    this.rate = 1;

    this._startCtxTime = 0;  // 再生開始時のAudioContext時刻
    this._startOffset = 0;   // 再生開始時の再生位置（秒）

    this.repeatMode = 'off'; // 'off' | 'all' | 'ab'
    this.abPoints = { a: null, b: null };

    this._rafId = null;
    this._onTick = null;     // (position, duration) => void
    this._onEnded = null;    // () => void
  }

  async _ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  /** すべてのトラックを破棄して初期状態に戻す */
  reset() {
    this._stopSources();
    this.tracks.clear();
    this.duration = 0;
    this.playing = false;
    this._startOffset = 0;
    this.repeatMode = 'off';
    this.abPoints = { a: null, b: null };
    this._stopTicking();
  }

  /**
   * トラック音声をデコードして登録する。
   * @param {string} id trackId
   * @param {Blob} blob 音声ファイル
   * @param {number} volume 0-1
   */
  async loadTrack(id, blob, volume = 1) {
    await this._ensureContext();
    const arrayBuffer = await blob.arrayBuffer();
    let buffer;
    try {
      buffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    } catch (err) {
      throw new Error('この音声ファイルは再生できませんでした。対応していない形式か、ファイルが壊れている可能性があります。');
    }
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(this.masterGain);

    this.tracks.set(id, { buffer, gainNode, sourceNode: null, volume });
    this.duration = Math.max(this.duration, buffer.duration);
    return buffer.duration;
  }

  removeTrack(id) {
    const t = this.tracks.get(id);
    if (!t) return;
    if (t.sourceNode) {
      try { t.sourceNode.stop(); } catch {}
    }
    t.gainNode.disconnect();
    this.tracks.delete(id);
    this.duration = 0;
    for (const tr of this.tracks.values()) {
      this.duration = Math.max(this.duration, tr.buffer.duration);
    }
  }

  setTrackVolume(id, volume) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.volume = volume;
    t.gainNode.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.01);
  }

  getPosition() {
    if (!this.playing || !this.ctx) return this._startOffset;
    const elapsed = (this.ctx.currentTime - this._startCtxTime) * this.rate;
    return this._startOffset + elapsed;
  }

  _stopSources() {
    for (const t of this.tracks.values()) {
      if (t.sourceNode) {
        try { t.sourceNode.onended = null; t.sourceNode.stop(); } catch {}
        t.sourceNode = null;
      }
    }
  }

  /** 現在位置から全トラックを同時に再生開始する */
  async play(fromPosition = null) {
    await this._ensureContext();
    if (this.tracks.size === 0 || this.duration <= 0) {
      this.playing = false;
      this._startOffset = 0;
      this._stopTicking();
      if (this._onTick) this._onTick(0, this.duration);
      return;
    }

    const pos = Math.max(0, Math.min(
      fromPosition !== null ? Number(fromPosition) || 0 : this._startOffset,
      this.duration
    ));
    if (pos >= this.duration) {
      this.playing = false;
      this._startOffset = 0;
      this._stopSources();
      this._stopTicking();
      if (this._onTick) this._onTick(0, this.duration);
      if (this._onEnded) this._onEnded();
      return;
    }

    this._stopSources();

    const startAt = this.ctx.currentTime + 0.05; // わずかに先の時刻にそろえて開始しズレを防ぐ
    let scheduledTracks = 0;
    for (const [id, t] of this.tracks.entries()) {
      if (pos >= t.buffer.duration) continue; // このトラックはすでに終端
      const src = this.ctx.createBufferSource();
      src.buffer = t.buffer;
      src.playbackRate.value = this.rate;
      src.connect(t.gainNode);
      src.start(startAt, Math.min(pos, t.buffer.duration));
      src.onended = () => this._handleTrackEnded(id);
      t.sourceNode = src;
      scheduledTracks++;
    }

    if (scheduledTracks === 0) {
      this.playing = false;
      this._startOffset = 0;
      this._stopTicking();
      if (this._onTick) this._onTick(0, this.duration);
      if (this._onEnded) this._onEnded();
      return;
    }

    this._startCtxTime = startAt;
    this._startOffset = pos;
    this.playing = true;
    this._startTicking();
  }

  pause() {
    if (!this.playing) return;
    this._startOffset = this.getPosition();
    this._stopSources();
    this.playing = false;
    this._stopTicking();
  }

  stop() {
    this._stopSources();
    this.playing = false;
    this._startOffset = 0;
    this._stopTicking();
    if (this._onTick) this._onTick(0, this.duration);
  }

  async seek(position) {
    const clamped = Math.max(0, Math.min(position, this.duration));
    if (this.playing) {
      await this.play(clamped);
    } else {
      this._startOffset = clamped;
      if (this._onTick) this._onTick(clamped, this.duration);
    }
  }

  async setRate(rate) {
    // 速度変更前の位置を取得してから rate を変更する。
    // 先に rate を変更すると getPosition() の経過時間計算にも
    // 新しい倍率が使われ、再生位置が不正にジャンプしてしまう。
    const pos = this.playing ? this.getPosition() : this._startOffset;
    const clampedRate = Math.max(0.25, Math.min(4, Number(rate) || 1));
    this.rate = clampedRate;

    if (this.playing) {
      await this.play(pos);
    }
  }

  setRepeatMode(mode) {
    this.repeatMode = mode;
  }

  setABPoints(a, b) {
    this.abPoints = { a, b };
  }

  clearABPoints() {
    this.abPoints = { a: null, b: null };
    if (this.repeatMode === 'ab') this.repeatMode = 'off';
  }

  _handleTrackEnded(id) {
    // 最長トラックが終わったタイミングで曲終端の処理を行う
    const t = this.tracks.get(id);
    if (!t || !this.playing) return;
    const isLongest = Math.abs(t.buffer.duration - this.duration) < 0.05;
    if (!isLongest) return;
    this._onSongEnded();
  }

  async _onSongEnded() {
    if (this.repeatMode === 'all') {
      await this.play(0);
    } else {
      this.playing = false;
      this._startOffset = 0;
      this._stopTicking();
      if (this._onTick) this._onTick(0, this.duration);
      if (this._onEnded) this._onEnded();
    }
  }

  _startTicking() {
    this._stopTicking();
    const tick = () => {
      if (!this.playing) return;
      let pos = this.getPosition();

      if (this.repeatMode === 'ab' && this.abPoints.a !== null && this.abPoints.b !== null) {
        if (pos >= this.abPoints.b) {
          this.play(this.abPoints.a);
          pos = this.abPoints.a;
        }
      } else if (pos >= this.duration && this.duration > 0) {
        pos = this.duration;
      }

      if (this._onTick) this._onTick(pos, this.duration);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopTicking() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  onTick(fn) { this._onTick = fn; }
  onEnded(fn) { this._onEnded = fn; }
}

/** ブラウザがこの音声ファイルをデコードできそうか簡易チェックする */
function isLikelySupportedAudio(file) {
  const supportedExt = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (supportedExt.includes(ext)) return true;
  if (file.type && file.type.startsWith('audio/')) return true;
  return false;
}
