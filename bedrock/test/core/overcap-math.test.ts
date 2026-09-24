import { describe, expect, it } from "vitest";
import {
  PROTECTION_EXCLUDED_CAUSES,
  PROTECTION_RULES,
  hasteAmplifier,
  meleeBonus,
  overEpfForCause,
  powerMultiplier,
  protectionFactor,
} from "../../src/core/overcap-math";

const neither = { undead: false, arthropod: false };
const undead = { undead: true, arthropod: false };
const arthropod = { undead: false, arthropod: true };

describe("meleeBonus", () => {
  it("sharpness applies to everything", () => {
    expect(meleeBonus({ sharpness: 2, smite: 0, bane: 0 }, neither)).toBe(2.5);
    expect(meleeBonus({ sharpness: 3, smite: 0, bane: 0 }, undead)).toBe(3.75);
  });

  it("smite only vs undead, bane only vs arthropods", () => {
    expect(meleeBonus({ sharpness: 0, smite: 2, bane: 0 }, undead)).toBe(5);
    expect(meleeBonus({ sharpness: 0, smite: 2, bane: 0 }, arthropod)).toBe(0);
    expect(meleeBonus({ sharpness: 0, smite: 0, bane: 1 }, arthropod)).toBe(2.5);
    expect(meleeBonus({ sharpness: 0, smite: 0, bane: 1 }, undead)).toBe(0);
    expect(meleeBonus({ sharpness: 1, smite: 1, bane: 1 }, { undead: true, arthropod: true })).toBe(6.25);
  });

  it("ignores negative / NaN overcap", () => {
    expect(meleeBonus({ sharpness: -3, smite: Number.NaN, bane: 0 }, undead)).toBe(0);
  });
});

describe("powerMultiplier / hasteAmplifier", () => {
  it("power", () => {
    expect(powerMultiplier(0)).toBe(1);
    expect(powerMultiplier(2)).toBeCloseTo(1.2);
    expect(powerMultiplier(5)).toBe(1.5);
    expect(powerMultiplier(-1)).toBe(1);
  });

  it("haste", () => {
    expect(hasteAmplifier(0)).toBeUndefined();
    expect(hasteAmplifier(-2)).toBeUndefined();
    expect(hasteAmplifier(Number.NaN)).toBeUndefined();
    expect(hasteAmplifier(1)).toBe(0);
    expect(hasteAmplifier(2)).toBe(1);
    expect(hasteAmplifier(10)).toBe(9);
    expect(hasteAmplifier(50)).toBe(9);
  });
});

describe("protection", () => {
  const over = (o: Record<string, number>) => new Map(Object.entries(o).map(([k, v]) => [`minecraft:${k}`, v]));

  it("has the 5 documented rules", () => {
    expect(PROTECTION_RULES.map((r) => [r.id, r.epfPerLevel])).toEqual([
      ["minecraft:protection", 1],
      ["minecraft:fire_protection", 2],
      ["minecraft:blast_protection", 2],
      ["minecraft:projectile_protection", 2],
      ["minecraft:feather_falling", 3],
    ]);
    expect([...PROTECTION_EXCLUDED_CAUSES].sort()).toEqual(["none", "override", "selfDestruct", "sonicBoom", "starve"]);
  });

  it("fall uses feather_falling×3 + protection×1", () => {
    expect(overEpfForCause("fall", over({ feather_falling: 2, protection: 4, fire_protection: 5 }))).toBe(10);
  });

  it("fire ignores blast; blast ignores fire", () => {
    const m = over({ fire_protection: 1, blast_protection: 3 });
    expect(overEpfForCause("fire", m)).toBe(2);
    expect(overEpfForCause("lava", m)).toBe(2);
    expect(overEpfForCause("entityExplosion", m)).toBe(6);
    expect(overEpfForCause("fireworks", m)).toBe(6);
  });

  it("projectile protection only for projectiles; generic causes only use protection", () => {
    const m = over({ projectile_protection: 2, protection: 1 });
    expect(overEpfForCause("projectile", m)).toBe(5);
    expect(overEpfForCause("entityAttack", m)).toBe(1);
  });

  it("excluded causes give 0", () => {
    const m = over({ protection: 10, feather_falling: 10 });
    for (const c of ["starve", "override", "selfDestruct", "none", "sonicBoom"]) expect(overEpfForCause(c, m)).toBe(0);
  });

  it("empty map gives 0", () => {
    expect(overEpfForCause("fall", new Map())).toBe(0);
  });

  it("protectionFactor is 1 at 0, 0.5 at 25, monotonic decreasing and never 0", () => {
    expect(protectionFactor(0)).toBe(1);
    expect(protectionFactor(25)).toBe(0.5);
    expect(protectionFactor(4)).toBeCloseTo(1 / 1.16);
    expect(protectionFactor(-5)).toBe(1);
    let prev = protectionFactor(0);
    for (let e = 1; e <= 1000; e++) {
      const f = protectionFactor(e);
      expect(f).toBeLessThan(prev);
      expect(f).toBeGreaterThan(0);
      prev = f;
    }
  });
});
