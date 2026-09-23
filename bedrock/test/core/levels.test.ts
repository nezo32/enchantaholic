import { describe, expect, it } from "vitest";
import { appliedLevel, nextTrueLevel, overcapOf, pruneExtras, resolveTrueLevel } from "../../src/core/levels";

describe("levels", () => {
  it.each([
    [0, 5, 9, 0],
    [0, 5, undefined, 0],
    [3, 5, 9, 3],
    [5, 5, undefined, 5],
    [5, 5, 7, 7],
    [5, 5, 4, 5],
    [1, 1, 12, 12],
  ] as const)("resolveTrueLevel(%s, %s, %s) = %s", (v, max, extra, want) => {
    expect(resolveTrueLevel(v, max, extra)).toBe(want);
  });

  it("nextTrueLevel has no cap", () => {
    expect(nextTrueLevel(0)).toBe(1);
    expect(nextTrueLevel(5)).toBe(6);
    expect(nextTrueLevel(9999)).toBe(10000);
  });

  it("appliedLevel / overcapOf bounds", () => {
    expect(appliedLevel(1, 5)).toBe(1);
    expect(appliedLevel(5, 5)).toBe(5);
    expect(appliedLevel(8, 5)).toBe(5);
    expect(overcapOf(3, 5)).toBe(0);
    expect(overcapOf(5, 5)).toBe(0);
    expect(overcapOf(8, 5)).toBe(3);
  });

  it("pruneExtras drops stale / non-overcap / unknown entries", () => {
    const extras = new Map([
      ["minecraft:sharpness", 7], // kept
      ["minecraft:smite", 7], // vanilla < max → stale
      ["minecraft:power", 5], // level <= max
      ["minecraft:unknown", 9], // unknown id
      ["minecraft:mending", 3], // kept (max 1)
    ]);
    const vanilla: Record<string, number> = { "minecraft:sharpness": 5, "minecraft:smite": 3, "minecraft:power": 5, "minecraft:mending": 1 };
    const max: Record<string, number> = { "minecraft:sharpness": 5, "minecraft:smite": 5, "minecraft:power": 5, "minecraft:mending": 1 };
    const out = pruneExtras(extras, (id) => vanilla[id] ?? 0, (id) => max[id]);
    expect([...out.entries()]).toEqual([
      ["minecraft:sharpness", 7],
      ["minecraft:mending", 3],
    ]);
    expect(extras.size).toBe(5); // input untouched
  });

  it("pruneExtras drops entries whose vanilla enchant was removed", () => {
    const out = pruneExtras(new Map([["minecraft:sharpness", 9]]), () => 0, () => 5);
    expect(out.size).toBe(0);
  });
});
