// player.js — 音声プレイヤーUIの制御
// AudioEngine（audio.js）とDOM要素を結びつける。

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

class PlayerController {
  /**
   * @param {AudioEngine} engine
   * @param {object} els DOM要素の集合
   * @param {object} callbacks {onPositionChange, onPlayStateChange, onEnded}
   */
  constructor(engine, els, callbacks = {}) {
    this.engine = engine;
    this.els = els;
    this.callbacks = callbacks;
    this.isSeeking = false;
    this._wireEvents();
    this.engine.onTick((pos, dur) => this._renderTime(pos, dur));
    this.engine.onEnded(() => { if (this.callbacks.onEnded) this.callbacks.onEnded(); });
  }

  _wireEvents() {
    const { playBtn, back10Btn, fwd10Btn, seekBar, volumeBtn, rateBtn, repeatBtn,
      abBtn, abClearBtn } = this.els;

    playBtn.addEventListener('click', () => this.togglePlay());
    back10Btn.addEventListener('click', () => this.skip(-10));
    fwd10Btn.addEventListener('click', () => this.skip(10));

    seekBar.addEventListener('input', () => {
      this.isSeeking = true;
      this._renderTime(Number(seekBar.value), this.engine.duration);
    });
    seekBar.addEventListener('change', async () => {
      await this.engine.seek(Number(seekBar.value));
      this.isSeeking = false;
    });

    if (volumeBtn) {
      volumeBtn.addEventListener('click', () => this.toggleMute());
    }
    if (rateBtn) {
      rateBtn.addEventListener('click', () => this._cycleRate());
    }
    if (repeatBtn) {
      repeatBtn.addEventListener('click', () => this._cycleRepeat());
    }
    if (abBtn) {
      abBtn.addEventListener('click', () => this._handleABTap());
    }
    if (abClearBtn) {
      abClearBtn.addEventListener('click', () => this._clearAB());
    }
  }

  async togglePlay() {
    if (this.engine.playing) {
      this.engine.pause();
    } else {
      await this.engine.play();
    }
    this._renderPlayState();
    if (this.callbacks.onPlayStateChange) this.callbacks.onPlayStateChange(this.engine.playing);
  }

  async skip(deltaSec) {
    const pos = this.engine.getPosition() + deltaSec;
    await this.engine.seek(pos);
  }

  toggleMute() {
    const master = this.engine.masterGain;
    if (!master) return;
    const muted = master.gain.value === 0;
    master.gain.value = muted ? 1 : 0;
    this.els.volumeBtn.textContent = muted ? '🔊' : '🔇';
    this.els.volumeBtn.setAttribute('aria-label', muted ? 'ミュート解除' : 'ミュート');
  }

  async _cycleRate() {
    const idx = PLAYBACK_RATES.indexOf(this.engine.rate);
    const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    await this.engine.setRate(next);
    this.els.rateBtn.textContent = `${next}x`;
  }

  async setRate(rate) {
    await this.engine.setRate(rate);
    if (this.els.rateBtn) this.els.rateBtn.textContent = `${rate}x`;
  }

  _cycleRepeat() {
    const order = ['off', 'all'];
    // ABが設定済みならABモードも巡回対象に含める
    const modes = (this.engine.abPoints.a !== null && this.engine.abPoints.b !== null)
      ? ['off', 'all', 'ab'] : order;
    const idx = modes.indexOf(this.engine.repeatMode);
    const next = modes[(idx + 1) % modes.length];
    this.engine.setRepeatMode(next);
    this._renderRepeatState();
  }

  _handleABTap() {
    const pos = this.engine.getPosition();
    const { a, b } = this.engine.abPoints;
    if (a === null) {
      this.engine.setABPoints(pos, null);
    } else if (b === null) {
      if (pos <= a) {
        // B地点がA地点より前ならA/Bを入れ替える
        this.engine.setABPoints(pos, a);
      } else {
        this.engine.setABPoints(a, pos);
      }
      this.engine.setRepeatMode('ab');
      this._renderRepeatState();
    } else {
      // すでにA/B両方あるならリセットして新たにAから設定し直す
      this.engine.setABPoints(pos, null);
    }
    this._renderABState();
  }

  _clearAB() {
    this.engine.clearABPoints();
    this._renderABState();
    this._renderRepeatState();
  }

  _renderABState() {
    const { a, b } = this.engine.abPoints;
    const { abLabel, abClearBtn } = this.els;
    if (!abLabel) return;
    if (a === null) {
      abLabel.textContent = 'A-Bリピート未設定';
      abClearBtn.hidden = true;
    } else if (b === null) {
      abLabel.textContent = `A: ${formatTime(a)}（B地点をタップして設定）`;
      abClearBtn.hidden = false;
    } else {
      abLabel.textContent = `A: ${formatTime(a)} → B: ${formatTime(b)}`;
      abClearBtn.hidden = false;
    }
  }

  _renderRepeatState() {
    const { repeatBtn } = this.els;
    if (!repeatBtn) return;
    const labels = { off: '🔁', all: '🔁 全体', ab: '🔁 A-B' };
    repeatBtn.textContent = labels[this.engine.repeatMode] || '🔁';
    repeatBtn.classList.toggle('active', this.engine.repeatMode !== 'off');
  }

  _renderPlayState() {
    this.els.playBtn.textContent = this.engine.playing ? '⏸' : '▶';
    this.els.playBtn.setAttribute('aria-label', this.engine.playing ? '一時停止' : '再生');
  }

  _renderTime(pos, dur) {
    if (!this.isSeeking) {
      this.els.seekBar.max = dur || 0;
      this.els.seekBar.value = pos || 0;
    }
    this.els.currentTimeEl.textContent = formatTime(pos);
    this.els.totalTimeEl.textContent = formatTime(dur);
    this._renderPlayState();
    if (this.callbacks.onPositionChange) this.callbacks.onPositionChange(pos, dur);
  }

  reset() {
    this.els.seekBar.value = 0;
    this.els.seekBar.max = 0;
    this.els.currentTimeEl.textContent = '0:00';
    this.els.totalTimeEl.textContent = '0:00';
    this._renderPlayState();
    this._renderABState();
    this._renderRepeatState();
    if (this.els.rateBtn) this.els.rateBtn.textContent = '1x';
  }
}
