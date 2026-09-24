import { MinecraftEnchantmentTypes } from "@minecraft/vanilla-data";
import { describe, expect, it } from "vitest";
import { CURSES, displayName, idFromDisplayName, isCurse } from "../../src/core/enchant-names";

const VANILLA = Object.values(MinecraftEnchantmentTypes) as string[];

describe("enchant names", () => {
  it("covers all 42 vanilla enchantments with explicit names that round-trip", () => {
    expect(VANILLA).toHaveLength(42);
    const names = new Set<string>();
    for (const id of VANILLA) {
      const name = displayName(id);
      expect(idFromDisplayName(name), `${id} → ${name}`).toBe(id);
      names.add(name);
    }
    expect(names.size).toBe(42);
  });

  it.each([
    ["minecraft:binding", "Curse of Binding"],
    ["minecraft:vanishing", "Curse of Vanishing"],
    ["minecraft:bane_of_arthropods", "Bane of Arthropods"],
    ["minecraft:luck_of_the_sea", "Luck of the Sea"],
    ["minecraft:infinity", "Infinity"],
    ["sharpness", "Sharpness"],
    ["minecraft:projectile_protection", "Projectile Protection"],
    ["minecraft:wind_burst", "Wind Burst"],
    ["minecraft:lunge", "Lunge"],
  ])("displayName(%s) = %s", (id, name) => {
    expect(displayName(id)).toBe(name);
  });

  it("falls back to title case for unknown ids", () => {
    expect(displayName("addon:super_duper_speed")).toBe("Super Duper Speed");
    expect(displayName("minecraft:new_thing")).toBe("New Thing");
    expect(displayName("x:__weird__")).toBe("Weird");
    expect(idFromDisplayName("Super Duper Speed")).toBeUndefined();
  });

  it("curses are exactly binding and vanishing", () => {
    expect([...CURSES].sort()).toEqual(["minecraft:binding", "minecraft:vanishing"]);
    expect(VANILLA.filter(isCurse).sort()).toEqual(["minecraft:binding", "minecraft:vanishing"]);
    expect(isCurse("binding")).toBe(true);
    expect(isCurse("minecraft:mending")).toBe(false);
  });
});
