import { describe, expect, it } from "vitest";
import { CUSTOM, CUSTOM_ENCHANTS, CUSTOM_KEYS, customDef, isCustomId } from "../../../src/core/custom/roster";

describe("custom roster", () => {
  it("has 11 enchantaholic: ids in CUSTOM_KEYS order with the exact names", () => {
    expect(CUSTOM_ENCHANTS).toHaveLength(11);
    expect(CUSTOM_ENCHANTS.map((d) => d.key)).toEqual([...CUSTOM_KEYS]);
    expect(CUSTOM_ENCHANTS.map((d) => [d.id, d.name])).toEqual([
      ["enchantaholic:vein_miner", "Vein Miner"],
      ["enchantaholic:barrage", "Barrage"],
      ["enchantaholic:yeet", "Yeet"],
      ["enchantaholic:kaboom", "Kaboom"],
      ["enchantaholic:party_popper", "Party Popper"],
      ["enchantaholic:chicken_rain", "Chicken Rain"],
      ["enchantaholic:midas_touch", "Midas Touch"],
      ["enchantaholic:magnet", "Magnet"],
      ["enchantaholic:moon_boots", "Moon Boots"],
      ["enchantaholic:butterfingers", "Curse of Butterfingers"],
      ["enchantaholic:hiccups", "Curse of Hiccups"],
    ]);
    for (const d of CUSTOM_ENCHANTS) {
      expect(d.id).toBe(`enchantaholic:${d.key}`);
      expect(d.custom).toBe(true);
      expect(d.maxLevel).toBe(5);
    }
  });

  it("the curses are butterfingers and hiccups", () => {
    expect(CUSTOM_ENCHANTS.filter((d) => d.curse).map((d) => d.key)).toEqual(["butterfingers", "hiccups"]);
  });

  it("CUSTOM maps keys to ids", () => {
    expect(CUSTOM.vein_miner).toBe("enchantaholic:vein_miner");
    expect(CUSTOM.hiccups).toBe("enchantaholic:hiccups");
    expect(Object.keys(CUSTOM)).toEqual([...CUSTOM_KEYS]);
  });

  it("isCustomId and customDef", () => {
    expect(isCustomId("enchantaholic:magnet")).toBe(true);
    expect(isCustomId("magnet")).toBe(false);
    expect(isCustomId("minecraft:magnet")).toBe(false);
    expect(isCustomId("enchantaholic:levels")).toBe(false);
    expect(customDef("enchantaholic:yeet")?.name).toBe("Yeet");
    expect(customDef("minecraft:sharpness")).toBeUndefined();
  });
});
