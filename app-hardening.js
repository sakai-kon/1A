// app-hardening.js — 実運用時の競合・UI境界条件を防ぐ安全層
(() => {
  'use strict';

  // AudioBufferSourceNode の古い onended が、seek / rate変更 / repeat の直後に
  // 新しい再生セッションを誤終了扱いしないようガードする。
  if (typeof AudioEngine !== 'undefined') {
    const originalPlay = AudioEngine.prototype.play;
    const originalHandleTrackEnded = AudioEngine.prototype._handleTrackEnded;
    const originalReset = AudioEngine.prototype.reset;
    const originalGetPosition = AudioEngine.prototype.getPosition;

    AudioEngine.prototype.play = async function (...args) {
      this._hardeningEndHandled = false;
      return originalPlay.apply(this, args);
    };

    AudioEngine.prototype._handleTrackEnded = function (id) {
      if (!this.playing) return;

      // 新しい再生を開始した直後に、古い source の onended が飛んできた場合を除外。
      // 本当に曲末まで到達している場合だけ既存処理へ渡す。
      const position = this.getPosition();
      const endTolerance = Math.max(0.12, 0.25 / Math.max(this.rate || 1, 0.25));
      if (this.duration > 0 && position < this.duration - endTolerance) return;

      // 同じ曲末で複数トラックが同時に onended しても一度だけ処理する。
      if (this._hardeningEndHandled) return;
      this._hardeningEndHandled = true;
      originalHandleTrackEnded.call(this, id);
    };

    AudioEngine.prototype.reset = function (...args) {
      this._hardeningEndHandled = false;
      const result = originalReset.apply(this, args);
      // ミュート状態が次の曲へ意図せず持ち越されないよう初期状態へ戻す。
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
      }
      return result;
    };

    AudioEngine.prototype.getPosition = function (...args) {
      const position = Number(originalGetPosition.apply(this, args));
      if (!Number.isFinite(position)) return 0;
      const duration = Number(this.duration);
      return duration > 0 ? Math.max(0, Math.min(position, duration)) : 0;
    };
  }

  // AudioEngine のミュート状態をリセットした後、プレイヤー側の表示も必ず同期する。
  if (typeof PlayerController !== 'undefined') {
    const originalPlayerReset = PlayerController.prototype.reset;
    PlayerController.prototype.reset = function (...args) {
      const result = originalPlayerReset.apply(this, args);
      if (this.els.volumeBtn) {
        this.els.volumeBtn.textContent = '🔊';
        this.els.volumeBtn.setAttribute('aria-label', 'ミュート');
      }
      return result;
    };
  }

  // 確認ダイアログを背景クリック / Escape で閉じた場合、Promise を必ず解決する。
  // 元実装のキャンセルボタン経由で閉じるため、削除処理などの待機状態を残さない。
  const getOpenModal = () => document.querySelector('.modal:not([hidden])');
  const clickCancelForOpenModal = () => {
    const modal = getOpenModal();
    if (!modal) return false;
    const cancel = modal.querySelector('.btn-secondary');
    if (!cancel) return false;
    cancel.click();
    return true;
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !getOpenModal()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clickCancelForOpenModal();
  }, true);

  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target !== overlay) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clickCancelForOpenModal();
    }, true);
  }
})();
