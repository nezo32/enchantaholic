import { beforeEach, describe, expect, it, type MockInstance } from "vitest";
import { debug, safe, warnOnce } from "../../src/adapters/log";
import { resetAll } from "./helpers";

describe("log", () => {
  let warn: MockInstance;
  beforeEach(() => {
    warn = resetAll();
  });

  it("warnOnce warns once per key", () => {
    warnOnce("k", new Error("boom"));
    warnOnce("k", new Error("again"));
    warnOnce("other", "text");
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain("[Enchantaholic] k:");
  });

  it("safe swallows exceptions and forwards arguments", () => {
    const seen: number[] = [];
    const wrapped = safe("s", (a: number, b: number) => {
      seen.push(a + b);
      throw new Error("x");
    });
    expect(() => wrapped(1, 2)).not.toThrow();
    expect(seen).toEqual([3]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("debug is silent in non-debug builds", () => {
    expect(() => debug("hello")).not.toThrow();
  });
});
