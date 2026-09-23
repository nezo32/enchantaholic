import { describe, expect, it } from "vitest";
import { fromRoman, toRoman } from "../../src/core/roman";

describe("roman numerals", () => {
  it.each([
    [1, "I"], [2, "II"], [3, "III"], [4, "IV"], [5, "V"], [6, "VI"], [9, "IX"], [10, "X"], [14, "XIV"],
    [40, "XL"], [90, "XC"], [400, "CD"], [255, "CCLV"], [1994, "MCMXCIV"], [3888, "MMMDCCCLXXXVIII"],
    [3999, "MMMCMXCIX"],
  ])("toRoman(%i) = %s", (n, s) => {
    expect(toRoman(n)).toBe(s);
    expect(fromRoman(s)).toBe(n);
  });

  it("round-trips 1..3999", () => {
    for (let n = 1; n <= 3999; n++) expect(fromRoman(toRoman(n))).toBe(n);
  });

  it("falls back to decimal outside 1..3999 or for non-integers", () => {
    expect(toRoman(4000)).toBe("4000");
    expect(toRoman(123456)).toBe("123456");
    expect(toRoman(0)).toBe("0");
    expect(toRoman(-3)).toBe("-3");
    expect(toRoman(2.5)).toBe("2.5");
  });

  it("fromRoman accepts decimal digits and rejects non-canonical input", () => {
    expect(fromRoman("12")).toBe(12);
    expect(fromRoman("4000")).toBe(4000);
    expect(fromRoman("IIII")).toBeUndefined();
    expect(fromRoman("VV")).toBeUndefined();
    expect(fromRoman("IC")).toBeUndefined();
    expect(fromRoman("MMMM")).toBeUndefined();
    expect(fromRoman("")).toBeUndefined();
    expect(fromRoman("iv")).toBeUndefined();
    expect(fromRoman("X1")).toBeUndefined();
    expect(fromRoman("-1")).toBeUndefined();
    expect(fromRoman("99999999999999999999")).toBeUndefined();
  });
});
