/** Pure math of the custom enchantment effects (levels → effect sizes, with every cap applied). */
import type { Rng } from "../rng";
import {
  BARRAGE_MAX_COPIES,
  BARRAGE_PER_LEVEL,
  BUTTER_MAX_PCT,
  BUTTER_PCT_PER_LEVEL,
  CHICKEN_PCT_PER_LEVEL,
  HICCUP_MAX_PCT,
  HICCUP_PCT_PER_LEVEL,
  KABOOM_BASE,
  KABOOM_MAX_POWER,
  KABOOM_PER_LEVEL,
  MAGNET_BASE_RADIUS,
  MAGNET_MAX_RADIUS,
  MIDAS_PCT_PER_LEVEL,
  MOON_MAX_AMPLIFIER,
  VEIN_MAX_BLOCKS,
  VEIN_PER_LEVEL,
  YEET_H_BASE,
  YEET_H_MAX,
  YEET_H_PER_LEVEL,
  YEET_V_BASE,
  YEET_V_MAX,
  YEET_V_PER_LEVEL,
} from "./tuning";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A level usable in formulas: a finite number > 0 (0 otherwise). */
function lvl(level: number): number {
  return Number.isFinite(level) && level > 0 ? level : 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Extra blocks broken by Vein Miner: min(8L, 256); 0 when L <= 0. */
export function veinLimit(level: number): number {
  return Math.floor(Math.min(VEIN_PER_LEVEL * lvl(level), VEIN_MAX_BLOCKS));
}

/** Extra projectiles fired by Barrage: min(10L, 64). */
export function barrageCount(level: number): number {
  return Math.floor(Math.min(BARRAGE_PER_LEVEL * lvl(level), BARRAGE_MAX_COPIES));
}

/** Kaboom explosion power: min(1 + 0.5L, 8); 0 when L <= 0. */
export function kaboomPower(level: number): number {
  const l = lvl(level);
  return l > 0 ? Math.min(KABOOM_BASE + KABOOM_PER_LEVEL * l, KABOOM_MAX_POWER) : 0;
}

/** Yeet knockback: horizontal and vertical strength, each capped. */
export function yeetForce(level: number): { h: number; v: number } {
  const l = lvl(level);
  return {
    h: Math.min(YEET_H_BASE + YEET_H_PER_LEVEL * l, YEET_H_MAX),
    v: Math.min(YEET_V_BASE + YEET_V_PER_LEVEL * l, YEET_V_MAX),
  };
}

/** Unit XZ vector from `from` to `to`; {0,0} when they are horizontally coincident. */
export function horizontalDir(from: Vec3, to: Vec3): { x: number; z: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (!(len > 1e-9)) return { x: 0, z: 0 };
  return { x: dx / len, z: dz / len };
}

const DEG = Math.PI / 180;

/**
 * Same speed as `v`, rotated by a random yaw offset and a random pitch offset, each uniform in
 * [-maxDeg, maxDeg]. The pitch is clamped to ±90°. A zero vector is returned unchanged.
 */
export function spreadVelocity(v: Vec3, maxDeg: number, rng: Rng): Vec3 {
  const speed = Math.hypot(v.x, v.y, v.z);
  if (!(speed > 1e-12)) return { x: v.x, y: v.y, z: v.z };
  const spread = Math.max(0, maxDeg) * DEG;
  const yaw = Math.atan2(v.x, v.z) + (rng() * 2 - 1) * spread;
  const pitch = clamp(Math.asin(clamp(v.y / speed, -1, 1)) + (rng() * 2 - 1) * spread, -Math.PI / 2, Math.PI / 2);
  const h = Math.cos(pitch) * speed;
  return { x: Math.sin(yaw) * h, y: Math.sin(pitch) * speed, z: Math.cos(yaw) * h };
}

/** rng()*100 < clamp(pct, 0, 100). */
export function rollPct(pct: number, rng: Rng): boolean {
  const p = Number.isFinite(pct) ? clamp(pct, 0, 100) : 0;
  return rng() * 100 < p;
}

/** Chicken Rain chance in percent: min(5L, 100). */
export function chickenPct(level: number): number {
  return Math.min(CHICKEN_PCT_PER_LEVEL * lvl(level), 100);
}

/**
 * Midas Touch drop. Chance min(3L, 100) %; on a hit the drop is an ingot with probability
 * clamp(3L − 100, 0, 100) % (so only L ≥ 34 can give ingots), else a nugget.
 */
export function midasDrop(level: number, rng: Rng): "nugget" | "ingot" | undefined {
  const raw = MIDAS_PCT_PER_LEVEL * lvl(level);
  if (!rollPct(Math.min(raw, 100), rng)) return undefined;
  return rollPct(raw - 100, rng) ? "ingot" : "nugget";
}

/** Magnet radius in blocks: min(3 + L, 24). */
export function magnetRadius(level: number): number {
  return Math.min(MAGNET_BASE_RADIUS + lvl(level), MAGNET_MAX_RADIUS);
}

/** Impulse pulling `from` toward `to`: |xz| = strength (0 when coincident), y = 0.1 + clamp(dy·0.1, 0, 0.4). */
export function pullVector(from: Vec3, to: Vec3, strength: number): Vec3 {
  const d = horizontalDir(from, to);
  return { x: d.x * strength, y: 0.1 + clamp((to.y - from.y) * 0.1, 0, 0.4), z: d.z * strength };
}

/** Jump Boost amplifier of Moon Boots: min(L − 1, 10), never below 0. */
export function moonAmplifier(level: number): number {
  return Math.floor(clamp(lvl(level) - 1, 0, MOON_MAX_AMPLIFIER));
}

/** Curse of Butterfingers chance in percent: min(2L, 50). */
export function butterPct(level: number): number {
  return Math.min(BUTTER_PCT_PER_LEVEL * lvl(level), BUTTER_MAX_PCT);
}

/** Curse of Hiccups chance in percent: min(3L, 60). */
export function hiccupPct(level: number): number {
  return Math.min(HICCUP_PCT_PER_LEVEL * lvl(level), HICCUP_MAX_PCT);
}

/** Vanilla tool Unbreaking rule: true = this use costs no durability (chance 1 − 1/(u+1), u capped at 3). */
export function unbreakingSkips(unbreaking: number, rng: Rng): boolean {
  const u = Math.floor(Math.min(lvl(unbreaking), 3));
  if (u <= 0) return false;
  return rng() >= 1 / (u + 1);
}
