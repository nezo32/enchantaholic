import { ROMAN_MAX } from "./config";

const TABLE: ReadonlyArray<readonly [number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** 1..3999 → canonical numerals; anything else (n > 3999, n < 1, non-integer) → String(n). */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > ROMAN_MAX) return String(n);
  let rest = n;
  let out = "";
  for (const [value, sym] of TABLE) {
    while (rest >= value) {
      out += sym;
      rest -= value;
    }
  }
  return out;
}

const ROMAN_RE = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const SYM: Readonly<Record<string, number>> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** Canonical numerals or decimal digits → number; otherwise undefined. */
export function fromRoman(s: string): number | undefined {
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return Number.isSafeInteger(n) ? n : undefined;
  }
  if (s.length === 0 || !ROMAN_RE.test(s)) return undefined;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = SYM[s[i] as string] ?? 0;
    const next = SYM[s[i + 1] ?? ""] ?? 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}
