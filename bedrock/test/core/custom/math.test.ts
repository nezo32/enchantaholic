import { describe, expect, it } from "vitest";
import {
  barrageCount,
  butterPct,
  chickenPct,
  hiccupPct,
  horizontalDir,
  kaboomPower,
  magnetRadius,
  midasDrop,
  moonAmplifier,
  pullVector,
  rollPct,
  spreadVelocity,
  unbreakingSkips,
  veinLimit,
  yeetForce,
} from "../../../src/core/custom/math";
import {
  BARRAGE_MAX_COPIES,
  BUTTER_MAX_PCT,
  HICCUP_MAX_PCT,
  KABOOM_MAX_POWER,
  MAGNET_MAX_RADIUS,
  MOON_MAX_AMPLIFIER,
  VEIN_MAX_BLOCKS,
  YEET_H_MAX,
  YEET_V_MAX,
} from "../../../src/core/custom/tuning";
import { mulberry32 } from "../../../src/core/rng";

const DEG = Math.PI / 180;
const len = (v: { x: number; y: number; z: number }): number => Math.hypot(v.x, v.y, v.z);

describe("level formulas and caps", () => {
  it("veinLimit = min(8L, 256), 0 for L <= 0", () => {
    expect(veinLimit(0)).toBe(0);
    expect(veinLimit(-3)).toBe(0);
    expect(veinLimit(1)).toBe(8);
    expect(veinLimit(31)).toBe(248);
    expect(veinLimit(32)).toBe(VEIN_MAX_BLOCKS);
    expect(veinLimit(100)).toBe(256);
    expect(veinLimit(Number.NaN)).toBe(0);
  });

  it("barrageCount = min(10L, 64)", () => {
    expect(barrageCount(0)).toBe(0);
    expect(barrageCount(1)).toBe(10);
    expect(barrageCount(6)).toBe(60);
    expect(barrageCount(7)).toBe(BARRAGE_MAX_COPIES);
    expect(barrageCount(1e9)).toBe(64);
  });

  it("kaboomPower = min(1 + 0.5L, 8)", () => {
    expect(kaboomPower(0)).toBe(0);
    expect(kaboomPower(1)).toBe(1.5);
    expect(kaboomPower(14)).toBe(8);
    expect(kaboomPower(20)).toBe(KABOOM_MAX_POWER);
  });

  it("yeetForce grows then caps", () => {
    expect(yeetForce(1).h).toBeCloseTo(1.2);
    expect(yeetForce(1).v).toBeCloseTo(0.8);
    expect(yeetForce(1000)).toEqual({ h: YEET_H_MAX, v: YEET_V_MAX });
  });

  it("percent chances cap exactly", () => {
    expect(chickenPct(1)).toBe(5);
    expect(chickenPct(20)).toBe(100);
    expect(chickenPct(500)).toBe(100);
    expect(butterPct(1)).toBe(2);
    expect(butterPct(25)).toBe(50);
    expect(butterPct(40)).toBe(BUTTER_MAX_PCT);
    expect(hiccupPct(1)).toBe(3);
    expect(hiccupPct(20)).toBe(60);
    expect(hiccupPct(30)).toBe(HICCUP_MAX_PCT);
  });

  it("magnetRadius = min(3 + L, 24)", () => {
    expect(magnetRadius(1)).toBe(4);
    expect(magnetRadius(21)).toBe(24);
    expect(magnetRadius(99)).toBe(MAGNET_MAX_RADIUS);
  });

  it("moonAmplifier = min(L - 1, 10), never negative", () => {
    expect(moonAmplifier(0)).toBe(0);
    expect(moonAmplifier(1)).toBe(0);
    expect(moonAmplifier(5)).toBe(4);
    expect(moonAmplifier(11)).toBe(10);
    expect(moonAmplifier(50)).toBe(MOON_MAX_AMPLIFIER);
  });
});

describe("vectors", () => {
  it("horizontalDir is a unit XZ vector, zero when coincident", () => {
    const d = horizontalDir({ x: 0, y: 0, z: 0 }, { x: 3, y: 10, z: 4 });
    expect(d.x).toBeCloseTo(0.6);
    expect(d.z).toBeCloseTo(0.8);
    expect(horizontalDir({ x: 1, y: 0, z: 1 }, { x: 1, y: 5, z: 1 })).toEqual({ x: 0, z: 0 });
  });

  it("pullVector points at the target with |xz| = strength and a bounded lift", () => {
    const v = pullVector({ x: 10, y: 60, z: 0 }, { x: 0, y: 64, z: 0 }, 0.6);
    expect(v.x).toBeCloseTo(-0.6);
    expect(v.z).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0.5);
    expect(pullVector({ x: 0, y: 64, z: 0 }, { x: 1, y: 0, z: 0 }, 0.6).y).toBeCloseTo(0.1);
    expect(pullVector({ x: 0, y: 0, z: 0 }, { x: 0, y: 100, z: 0 }, 0.6)).toEqual({ x: 0, y: 0.5, z: 0 });
  });

  it("spreadVelocity keeps the speed and stays within the spread", () => {
    const rng = mulberry32(7);
    const v = { x: 0.3, y: 0.4, z: 2.5 };
    const yaw0 = Math.atan2(v.x, v.z);
    const pitch0 = Math.asin(v.y / len(v));
    for (let i = 0; i < 500; i++) {
      const s = spreadVelocity(v, 10, rng);
      expect(Math.abs(len(s) - len(v))).toBeLessThan(1e-9);
      const dyaw = Math.atan2(s.x, s.z) - yaw0;
      const dpitch = Math.asin(s.y / len(s)) - pitch0;
      expect(Math.abs(dyaw)).toBeLessThanOrEqual(10 * DEG + 1e-9);
      expect(Math.abs(dpitch)).toBeLessThanOrEqual(10 * DEG + 1e-9);
    }
    expect(spreadVelocity({ x: 0, y: 0, z: 0 }, 10, rng)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe("rolls", () => {
  it("rollPct clamps to [0, 100]", () => {
    expect(rollPct(0, () => 0)).toBe(false);
    expect(rollPct(100, () => 0.999999)).toBe(true);
    expect(rollPct(250, () => 0.999999)).toBe(true);
    expect(rollPct(-5, () => 0)).toBe(false);
    expect(rollPct(50, () => 0.49)).toBe(true);
    expect(rollPct(50, () => 0.5)).toBe(false);
  });

  it("midasDrop: never an ingot below L = 34; rate ~3L %", () => {
    const rng = mulberry32(42);
    let hits = 0;
    for (let i = 0; i < 20000; i++) {
      const d = midasDrop(33, rng);
      expect(d).not.toBe("ingot");
      if (d) hits++;
    }
    expect(hits / 20000).toBeGreaterThan(0.97);
    let nuggets = 0;
    for (let i = 0; i < 20000; i++) if (midasDrop(5, rng) === "nugget") nuggets++;
    expect(nuggets / 20000).toBeCloseTo(0.15, 1);
    expect(midasDrop(0, () => 0)).toBeUndefined();
  });

  it("midasDrop: L >= 34 can give ingots, L >= 67 always ingots", () => {
    const rng = mulberry32(3);
    let ingots = 0;
    for (let i = 0; i < 20000; i++) if (midasDrop(50, rng) === "ingot") ingots++;
    expect(ingots / 20000).toBeCloseTo(0.5, 1);
    expect(midasDrop(34, () => 0)).toBe("ingot");
    for (let i = 0; i < 100; i++) expect(midasDrop(67, rng)).toBe("ingot");
  });

  it("unbreakingSkips follows 1/(u+1) with u capped at 3", () => {
    const rng = mulberry32(9);
    const ratio = (u: number): number => {
      let skips = 0;
      for (let i = 0; i < 40000; i++) if (unbreakingSkips(u, rng)) skips++;
      return skips / 40000;
    };
    expect(ratio(0)).toBe(0);
    expect(ratio(1)).toBeCloseTo(0.5, 1);
    expect(ratio(3)).toBeCloseTo(0.75, 1);
    expect(ratio(10)).toBeCloseTo(0.75, 1);
  });
});
