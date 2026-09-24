import { describe, expect, it } from "vitest";
import { decodeLevels, encodeLevels } from "../../src/core/level-codec";

describe("level codec", () => {
  it("round-trips", () => {
    const m = new Map([
      ["minecraft:sharpness", 7],
      ["minecraft:efficiency", 12],
    ]);
    expect(decodeLevels(encodeLevels(m))).toEqual(m);
  });

  it("empty map encodes to undefined", () => {
    expect(encodeLevels(new Map())).toBeUndefined();
  });

  it("uses stable (sorted) key order", () => {
    const a = encodeLevels(new Map([["b", 2], ["a", 3], ["c", 4]]));
    const b = encodeLevels(new Map([["c", 4], ["b", 2], ["a", 3]]));
    expect(a).toBe(b);
    expect(a).toBe('{"a":3,"b":2,"c":4}');
  });

  it.each([
    [undefined],
    [42],
    [true],
    [null],
    ["{"],
    [""],
    ["null"],
    ["[1,2]"],
    ['"str"'],
    ['{"a":"x"}'],
    ['{"a":-1}'],
    ['{"a":0}'],
    ['{"a":1.5}'],
    ['{"a":null}'],
    ['{"a":1e400}'],
  ])("tolerates garbage %j", (raw) => {
    expect(() => decodeLevels(raw)).not.toThrow();
    expect(decodeLevels(raw).size).toBe(0);
  });

  it("keeps valid entries next to invalid ones", () => {
    expect(decodeLevels('{"minecraft:sharpness":6,"bad":"x","neg":-2}')).toEqual(new Map([["minecraft:sharpness", 6]]));
  });
});
