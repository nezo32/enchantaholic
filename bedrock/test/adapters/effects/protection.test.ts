import { beforeEach, describe, expect, it } from "vitest";
import { protectionModifier } from "../../../src/adapters/effects/protection";
import { makeItem, makePlayer, zombie } from "../../fakes/builders";
import { overcapped, resetAll } from "../helpers";
import { hurt } from "./fx-helpers";

const prot = (type: string, trueLevel: number) => overcapped(`minecraft:diamond_${type}`, "minecraft:protection", 4, trueLevel);

function fullSet(trueLevel: number) {
  return makePlayer({
    equip: {
      Head: prot("helmet", trueLevel),
      Chest: prot("chestplate", trueLevel),
      Legs: prot("leggings", trueLevel),
      Feet: prot("boots", trueLevel),
    },
  });
}

describe("protection overcap", () => {
  beforeEach(() => void resetAll());

  it("four Protection true-V pieces → overEpf 4 → ×1/1.16", () => {
    const p = fullSet(5);
    expect(hurt([protectionModifier], { victim: p, attacker: zombie(), damage: 11.6 })).toBeCloseTo(10);
  });

  it("four Protection true-VI pieces → overEpf 8 → ×1/1.32", () => {
    const p = fullSet(6);
    expect(hurt([protectionModifier], { victim: p, damage: 13.2, cause: "lava" })).toBeCloseTo(10);
  });

  it("Feather Falling true-V boots (over 1) → ×1/1.12 for falls only", () => {
    const p = makePlayer({ equip: { Feet: overcapped("minecraft:diamond_boots", "minecraft:feather_falling", 4, 5) } });
    expect(hurt([protectionModifier], { victim: p, damage: 11.2, cause: "fall" })).toBeCloseTo(10);
    expect(hurt([protectionModifier], { victim: p, damage: 5, cause: "fire" })).toBe(5);
  });

  it("excluded causes (starve) are unchanged", () => {
    expect(hurt([protectionModifier], { victim: fullSet(8), damage: 1, cause: "starve" })).toBe(1);
  });

  it("non-player victims are unchanged", () => {
    const z = zombie();
    expect(hurt([protectionModifier], { victim: z, attacker: fullSet(8), damage: 6 })).toBe(6);
  });

  it("armor at vanilla max without stored overcap is unchanged", () => {
    const p = makePlayer({
      equip: { Chest: makeItem("minecraft:diamond_chestplate", { enchantable: { compatible: "all" }, levels: { protection: 4 } }) },
    });
    expect(hurt([protectionModifier], { victim: p, damage: 6, cause: "fall" })).toBe(6);
  });
});
