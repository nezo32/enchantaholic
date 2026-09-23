import { MinecraftEnchantmentTypes, MinecraftItemTypes } from "@minecraft/vanilla-data";
import { describe, expect, it } from "vitest";
import { eligibleEnchants, type EnchantInfo } from "../../src/core/eligibility";

const ALL: EnchantInfo[] = (Object.values(MinecraftEnchantmentTypes) as string[]).map((id) => ({ id, maxLevel: 3 }));
const LUNGE = "minecraft:lunge";
const SPEARS = (Object.values(MinecraftItemTypes) as string[]).filter((id) => id.endsWith("_spear"));

describe("eligibleEnchants (lunge-only-on-spear)", () => {
  it("vanilla-data has 7 spears", () => {
    expect(SPEARS.sort()).toEqual([
      "minecraft:copper_spear",
      "minecraft:diamond_spear",
      "minecraft:golden_spear",
      "minecraft:iron_spear",
      "minecraft:netherite_spear",
      "minecraft:stone_spear",
      "minecraft:wooden_spear",
    ]);
  });

  it.each(SPEARS)("keeps lunge (and everything else) for %s", (spear) => {
    expect(eligibleEnchants(ALL, spear)).toEqual(ALL);
  });

  it("removes only lunge for every non-spear item", () => {
    const nonSpears = (Object.values(MinecraftItemTypes) as string[]).filter((id) => !id.endsWith("_spear"));
    for (const item of nonSpears) {
      const out = eligibleEnchants(ALL, item);
      expect(out.some((e) => e.id === LUNGE)).toBe(false);
      expect(out).toHaveLength(ALL.length - 1);
    }
  });

  it("handles unnamespaced ids and preserves order without mutating input", () => {
    const input = Object.freeze([...ALL]);
    const out = eligibleEnchants(input, "iron_spear");
    expect(out).toEqual(ALL);
    expect(out).not.toBe(input);
    expect(eligibleEnchants(input, "diamond_sword").map((e) => e.id)).toEqual(
      ALL.filter((e) => e.id !== LUNGE).map((e) => e.id),
    );
  });
});
