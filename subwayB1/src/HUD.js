import { POWERUP_CONFIGS } from './Utils.js';

export class HUD {
  constructor() {
    this._el = {
      hud:            document.getElementById('hud'),
      scoreValue:     document.getElementById('score-value'),
      coinValue:      document.getElementById('coin-value'),
      missionText:    document.getElementById('mission-text'),
      missionFill:    document.getElementById('mission-progress-fill'),
      powerupInd:     document.getElementById('powerup-indicator'),
      powerupIcon:    document.getElementById('powerup-icon'),
      powerupBarFill: document.getElementById('powerup-bar-fill'),
      powerupName:    document.getElementById('powerup-name'),
      hoverboardInd:  document.getElementById('hoverboard-indicator'),
    };
  }

  show() {
    if (this._el.hud) this._el.hud.style.display = 'flex';
  }

  hide() {
    if (this._el.hud) this._el.hud.style.display = 'none';
  }

  update(score, coins, missions, powerup, hoverboard) {
    // Score
    if (this._el.scoreValue) {
      this._el.scoreValue.textContent = score.toLocaleString();
    }

    // Coins
    if (this._el.coinValue) {
      this._el.coinValue.textContent = coins.toLocaleString();
    }

    // First mission
    const m = missions && missions[0];
    if (m) {
      if (this._el.missionText) {
        this._el.missionText.textContent = m.text;
      }
      if (this._el.missionFill) {
        const pct = Math.min(100, (m.progress / m.target) * 100);
        this._el.missionFill.style.width = pct + '%';
      }
    }

    // Power-up indicator
    if (powerup) {
      const cfg = POWERUP_CONFIGS[powerup.kind];
      if (this._el.powerupInd) this._el.powerupInd.style.display = 'flex';

      if (this._el.powerupName) this._el.powerupName.textContent = cfg ? cfg.name : powerup.kind;

      if (cfg && this._el.powerupIcon) {
        const hex = '#' + cfg.color.toString(16).padStart(6, '0');
        this._el.powerupIcon.style.backgroundColor = hex;
      }

      if (this._el.powerupBarFill && cfg) {
        const pct = Math.min(100, (powerup.timeLeft / powerup.maxTime) * 100);
        this._el.powerupBarFill.style.width = pct + '%';
        const hex = '#' + cfg.color.toString(16).padStart(6, '0');
        this._el.powerupBarFill.style.backgroundColor = hex;
      }
    } else {
      if (this._el.powerupInd) this._el.powerupInd.style.display = 'none';
    }

    // Hoverboard indicator
    if (this._el.hoverboardInd) {
      this._el.hoverboardInd.style.display = hoverboard ? 'flex' : 'none';
    }
  }
}
