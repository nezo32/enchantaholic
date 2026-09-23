import { beforeEach, describe, expect, it } from "vitest";
import { meleeModifier } from "../../../src/adapters/effects/melee";
import { arrow, makeItem, makePlayer, spider, zombie } from "../../fakes/builders";
import { overcapped, resetAll } from "../helpers";
import { hurt } from "./fx-helpers";

const holding = (item: ReturnType<typeof makeItem>) => makePlayer({ selected: 2, inv: { 2: item } });

describe("melee overcap", () => {
  beforeEach(() => void resetAll());

  it("Sharpness true-VII adds 2 × 1.25", () => {
    const p = holding(overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 7));
    expect(hurt([meleeModifier], { victim: zombie(), attacker: p, damage: 8 })).toBeCloseTo(10.5);
  });

  it("Smite over 2 adds 5 vs undead and nothing vs arthropods", () => {
    const p = holding(overcapped("minecraft:diamond_sword", "minecraft:smite", 5, 7));
    expect(hurt([meleeModifier], { victim: zombie(), attacker: p, damage: 8 })).toBeCloseTo(13);
    expect(hurt([meleeModifier], { victim: spider(), attacker: p, damage: 8 })).toBe(8);
  });

  it("Bane over 1 adds 2.5 vs arthropods only", () => {
    const p = holding(overcapped("minecraft:diamond_sword", "minecraft:bane_of_arthropods", 5, 6));
    expect(hurt([meleeModifier], { victim: spider(), attacker: p, damage: 8 })).toBeCloseTo(10.5);
    expect(hurt([meleeModifier], { victim: zombie(), attacker: p, damage: 8 })).toBe(8);
  });

  it("vanilla max without stored overcap adds nothing", () => {
    const p = holding(makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" }, levels: { sharpness: 5 } }));
    expect(hurt([meleeModifier], { victim: zombie(), attacker: p, damage: 8 })).toBe(8);
  });

  it("ignores non-player attackers, projectiles and non-melee causes", () => {
    const sword = overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 9);
    const p = holding(sword);
    expect(hurt([meleeModifier], { victim: p, attacker: zombie(), damage: 4 })).toBe(4);
    expect(hurt([meleeModifier], { victim: zombie(), attacker: p, projectile: arrow(), damage: 4, cause: "projectile" })).toBe(4);
    expect(hurt([meleeModifier], { victim: zombie(), attacker: p, projectile: arrow(), damage: 4 })).toBe(4);
    expect(hurt([meleeModifier], { victim: zombie(), attacker: p, damage: 4, cause: "fire" })).toBe(4);
  });

  it("an empty hand adds nothing", () => {
    expect(hurt([meleeModifier], { victim: zombie(), attacker: makePlayer(), damage: 1 })).toBe(1);
  });
});
