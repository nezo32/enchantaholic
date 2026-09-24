import { describe, expect, it } from "vitest";
import { LORE_TAG } from "../../../src/core/config";
import { customLevelsFrom, withoutCustoms } from "../../../src/core/custom/levels";
import { encodeLoreLine } from "../../../src/core/lore";

const magnet = encodeLoreLine("Magnet", 3, "9");
const hiccups = encodeLoreLine("Curse of Hiccups", 2, "c");
const sharp = encodeLoreLine("Sharpness", 7);

describe("customLevelsFrom", () => {
  it("reads custom lines from lore only (vanilla and user lines ignored)", () => {
    const m = customLevelsFrom(["user", magnet, sharp, hiccups], undefined, false);
    expect(m).toEqual(
      new Map([
        ["enchantaholic:magnet", 3],
        ["enchantaholic:hiccups", 2],
      ]),
    );
  });

  it("overlays the dynprop on non-stackables (dynprop wins, lore-only entries kept)", () => {
    const raw = JSON.stringify({ "enchantaholic:magnet": 9, "enchantaholic:yeet": 4 });
    expect(customLevelsFrom([magnet, hiccups], raw, false)).toEqual(
      new Map([
        ["enchantaholic:magnet", 9],
        ["enchantaholic:hiccups", 2],
        ["enchantaholic:yeet", 4],
      ]),
    );
  });

  it("ignores the dynprop on stackables", () => {
    const raw = JSON.stringify({ "enchantaholic:magnet": 9 });
    expect(customLevelsFrom([magnet], raw, true)).toEqual(new Map([["enchantaholic:magnet", 3]]));
  });

  it("drops garbage, unknown ids and non-positive levels", () => {
    expect(customLevelsFrom([`${LORE_TAG}§9Nonsense V`, `${LORE_TAG}§9`], "{not json", false)).toEqual(new Map());
    const raw = JSON.stringify({ "enchantaholic:nope": 3, "minecraft:sharpness": 9, "enchantaholic:magnet": 0 });
    expect(customLevelsFrom([], raw, false)).toEqual(new Map());
    expect(customLevelsFrom([], 42, false)).toEqual(new Map());
  });
});

describe("withoutCustoms", () => {
  it("keeps only non-custom entries and does not mutate", () => {
    const m = new Map([
      ["minecraft:sharpness", 7],
      ["enchantaholic:magnet", 3],
    ]);
    expect(withoutCustoms(m)).toEqual(new Map([["minecraft:sharpness", 7]]));
    expect(m.size).toBe(2);
  });
});
