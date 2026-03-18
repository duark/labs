export class InputManager {
  constructor() {
    this._queue = new Set();
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._SWIPE_THRESHOLD = 50;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('touchstart', this._onTouchStart, { passive: true });
    window.addEventListener('touchend', this._onTouchEnd, { passive: true });
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this._queue.add('left');
        break;
      case 'ArrowRight':
      case 'KeyD':
        this._queue.add('right');
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        e.preventDefault && e.preventDefault();
        this._queue.add('jump');
        break;
      case 'ArrowDown':
      case 'KeyS':
        this._queue.add('roll');
        break;
      case 'Escape':
      case 'KeyP':
        this._queue.add('pause');
        break;
    }
  }

  _onTouchStart(e) {
    const t = e.touches[0];
    this._touchStartX = t.clientX;
    this._touchStartY = t.clientY;
  }

  _onTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.clientX - this._touchStartX;
    const dy = t.clientY - this._touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < this._SWIPE_THRESHOLD) return;

    if (absDx > absDy) {
      this._queue.add(dx > 0 ? 'right' : 'left');
    } else {
      this._queue.add(dy < 0 ? 'jump' : 'roll');
    }
  }

  consume(action) {
    if (this._queue.has(action)) {
      this._queue.delete(action);
      return true;
    }
    return false;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchend', this._onTouchEnd);
  }
}
