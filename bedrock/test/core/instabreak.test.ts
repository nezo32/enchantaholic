import { MinecraftBlockTypes } from "@minecraft/vanilla-data";
import { describe, expect, it } from "vitest";
import data from "../../src/core/data/instabreak-blocks.json";
import { INSTABREAK, isInstabreak } from "../../src/core/instabreak";

const vanillaBlocks = new Set<string>(Object.values(MinecraftBlockTypes));

describe("instabreak list", () => {
  it("has the expected sizes (142 vanilla + 119 education elements)", () => {
    expect(data.vanilla).toHaveLength(142);
    expect(data.education_elements).toHaveLength(119);
    expect(INSTABREAK.size).toBe(142 + 119);
  });

  it("every vanilla id exists in vanilla-data MinecraftBlockTypes", () => {
    const missing = data.vanilla.filter((id) => !vanillaBlocks.has(id));
    expect(missing).toEqual([]);
  });

  it("education ids are element_0..element_118", () => {
    const expected = Array.from({ length: 119 }, (_, i) => `minecraft:element_${i}`).sort();
    expect([...data.education_elements].sort()).toEqual(expected);
  });

  it("ids are namespaced, unique, and sorted-stable data", () => {
    const all = [...data.vanilla, ...data.education_elements];
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(/^minecraft:[a-z0-9_]+$/);
  });

  it.each([
    "short_grass", "tall_grass", "poppy", "dandelion", "torch", "soul_torch", "redstone_torch", "redstone_wire",
    "slime", "honey_block", "tnt", "reeds", "oak_sapling", "fire", "wheat", "sweet_berry_bush", "kelp",
    "seagrass", "fern", "deadbush", "red_mushroom", "flower_pot", "scaffolding", "end_rod", "element_0",
    "element_118", "unpowered_repeater", "tripwire_hook", "decorated_pot",
  ])("%s is instabreak", (id) => {
    expect(isInstabreak(id)).toBe(true);
    expect(isInstabreak(`minecraft:${id}`)).toBe(true);
  });

  it.each([
    "stone", "dirt", "grass_block", "candle", "white_candle", "bamboo", "vine", "frame", "glow_frame", "hard_glass",
    "cake", "lever", "snow_layer", "air", "bedrock", "oak_log", "sand", "glass", "cobweb", "sugar_cane",
  ])("%s is NOT instabreak", (id) => {
    expect(isInstabreak(`minecraft:${id}`)).toBe(false);
  });

  it("does not match foreign namespaces", () => {
    expect(isInstabreak("custom:short_grass")).toBe(false);
  });
});
