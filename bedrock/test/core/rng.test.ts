import { describe, expect, it } from "vitest";
import { defaultRng, mulberry32, pickIndex, shuffled } from "../../src/core/rng";

describe("mulberry32", () => {
  it("is deterministic per seed and in [0,1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });

  it("defaultRng is Math.random", () => {
    expect(defaultRng).toBe(Math.random);
  });
});

describe("pickIndex", () => {
  it("stays in bounds, including rng() ≈ 1 and 0", () => {
    expect(pickIndex(5, () => 0)).toBe(0);
    expect(pickIndex(5, () => 0.9999999)).toBe(4);
    expect(pickIndex(5, () => 1)).toBe(4); // misbehaving rng is clamped
    expect(pickIndex(5, () => -0.5)).toBe(0);
    expect(pickIndex(5, () => Number.NaN)).toBe(0);
    expect(pickIndex(1, () => 0.7)).toBe(0);
    expect(pickIndex(10, () => 0.35)).toBe(3);
  });

  it("throws RangeError for length <= 0", () => {
    expect(() => pickIndex(0, () => 0.5)).toThrow(RangeError);
    expect(() => pickIndex(-1, () => 0.5)).toThrow(RangeError);
  });

  it("is roughly uniform (chi-square, 41 buckets × 1000)", () => {
    const n = 41;
    const draws = 41_000;
    const rng = mulberry32(1234);
    const counts = new Array<number>(n).fill(0);
    for (let i = 0; i < draws; i++) {
      const k = pickIndex(n, rng);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const expected = draws / n;
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    // df = 40; p=0.001 critical value ≈ 73.4
    expect(chi2).toBeLessThan(73.4);
  });
});

describe("shuffled", () => {
  it("returns a permutation and leaves input unchanged", () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const out = shuffled(input, mulberry32(7));
    expect(out).not.toBe(input);
    expect([...out].sort((a, b) => a - b)).toEqual([...input]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffled([], mulberry32(1))).toEqual([]);
    expect(shuffled(["a"], mulberry32(1))).toEqual(["a"]);
  });

  it("puts each element first roughly uniformly", () => {
    const rng = mulberry32(99);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 20_000; i++) counts[shuffled([0, 1, 2, 3], rng)[0] as number]! += 1;
    for (const c of counts) expect(c / 20_000).toBeCloseTo(0.25, 1);
  });
});
