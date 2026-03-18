const MISSION_POOL = [
  { id: 'coins250',  text: 'colete 250 moedas',          target: 250,  type: 'coins'    },
  { id: 'coins500',  text: 'colete 500 moedas',          target: 500,  type: 'coins'    },
  { id: 'run500',    text: 'corra 500m',                  target: 500,  type: 'distance' },
  { id: 'run1000',   text: 'corra 1000m',                 target: 1000, type: 'distance' },
  { id: 'powerups3', text: 'colete 3 power-ups',          target: 3,    type: 'powerups' },
  { id: 'jetpack2',  text: 'use o jetpack 2 vezes',       target: 2,    type: 'jetpack'  },
  { id: 'noscratch', text: 'evite 5 obstáculos seguidos', target: 5,    type: 'dodged'   },
  { id: 'coins100',  text: 'colete 100 moedas em corrida',target: 100,  type: 'coins'    },
];

const STORAGE_KEY = 'subwayB1_missions';

export class MissionSystem {
  constructor() {
    this.multiplierBonus = 0;
    this._active = [];
    this._dodgeStreak = 0;
    this._load();
    if (this._active.length < 3) {
      this._fillMissions();
    }
  }

  _load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (data) {
        this.multiplierBonus = data.multiplierBonus || 0;
        this._active = data.active || [];
      }
    } catch (e) {
      this._active = [];
      this.multiplierBonus = 0;
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        multiplierBonus: this.multiplierBonus,
        active: this._active,
      }));
    } catch (e) { /* ignore */ }
  }

  _fillMissions() {
    const usedIds = new Set(this._active.map(m => m.id));
    const available = MISSION_POOL.filter(m => !usedIds.has(m.id));
    while (this._active.length < 3 && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      const def = available.splice(idx, 1)[0];
      this._active.push({ ...def, progress: 0, completed: false });
    }
    this._save();
  }

  track(type, amount) {
    let changed = false;
    for (const m of this._active) {
      if (m.completed) continue;
      if (m.type === type) {
        m.progress += amount;
        if (m.progress >= m.target) {
          m.progress = m.target;
          m.completed = true;
          changed = true;
        }
      }
      // Special: dodged streak
      if (type === 'dodged' && amount > 0) {
        this._dodgeStreak++;
        if (m.type === 'dodged') {
          m.progress = this._dodgeStreak;
          if (m.progress >= m.target) {
            m.progress = m.target;
            m.completed = true;
            changed = true;
          }
        }
      } else if (type === 'dodged' && amount === 0) {
        // Reset streak (hoverboard used)
        this._dodgeStreak = 0;
      }
    }
    if (changed) this._completeCheck();
    this._save();
  }

  _completeCheck() {
    const allDone = this._active.every(m => m.completed);
    if (allDone) {
      this.multiplierBonus++;
      this._active = [];
      this._fillMissions();
    } else {
      // Replace completed missions individually
      const completedIndices = this._active
        .map((m, i) => m.completed ? i : -1)
        .filter(i => i !== -1);
      for (const i of completedIndices) {
        this.multiplierBonus += 0.1; // partial bonus per mission
        const usedIds = new Set(this._active.map(m => m.id));
        const available = MISSION_POOL.filter(m => !usedIds.has(m.id) && !this._active.some(a => a.id === m.id));
        if (available.length > 0) {
          const def = available[Math.floor(Math.random() * available.length)];
          this._active[i] = { ...def, progress: 0, completed: false };
        }
      }
    }
    this._save();
  }

  getActiveMissions() {
    return this._active.map(m => ({
      text: m.text,
      progress: m.progress,
      target: m.target,
      completed: m.completed,
    }));
  }

  getMultiplierBonus() {
    return Math.floor(this.multiplierBonus);
  }

  reset() {
    // Reset per-run progress but keep multiplier bonus
    this._dodgeStreak = 0;
    for (const m of this._active) {
      if (!m.completed) m.progress = 0;
    }
    this._save();
  }
}
