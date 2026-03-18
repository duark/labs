export const LANES = [-2.5, 0, 2.5];
export const GRAVITY = -25;
export const JUMP_VELOCITY = 14;
export const CHUNK_LEN = 40;
export const BASE_SPEED = 12;
export const MAX_SPEED = 45;
export const SPEED_INC = 0.3;

export const POWERUP_CONFIGS = {
  jetpack:  { name: 'jetpack',         color: 0xFF3B3B, emissive: 0xFF0000, emissiveIntensity: 1.5, duration: 15 },
  tenis:    { name: 'tênis turbo',     color: 0xFFD700, emissive: 0xFFAA00, emissiveIntensity: 1.2, duration: 15 },
  ima:      { name: 'ímã',             color: 0x3B8BFF, emissive: 0x0044FF, emissiveIntensity: 1.0, duration: 15 },
  multi:    { name: 'x2',              color: 0xA855F7, emissive: 0x7700FF, emissiveIntensity: 2.0, duration: 15 },
  coinRush: { name: 'chuva de moedas', color: 0xFF8C00, emissive: 0xFF5500, emissiveIntensity: 1.3, duration: 8  },
};

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function rnd(min, max) { return Math.random() * (max - min) + min; }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
