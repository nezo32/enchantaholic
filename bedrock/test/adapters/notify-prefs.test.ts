import { beforeEach, describe, expect, it, type MockInstance } from "vitest";
import { getNotifyPrefs, setNotifyPrefs } from "../../src/adapters/notify-prefs";
import { PROP_NOTIFY } from "../../src/core/config";
import { DEFAULT_NOTIFY } from "../../src/core/notify";
import { makePlayer } from "../fakes/builders";
import { _withExecMode, system } from "../fakes/minecraft-server";
import { resetAll } from "./helpers";

describe("notify prefs adapter", () => {
  let warn: MockInstance;
  beforeEach(() => {
    warn = resetAll();
  });

  it("a fresh player gets DEFAULT", () => {
    expect(getNotifyPrefs(makePlayer())).toEqual(DEFAULT_NOTIFY);
  });

  it("reads a stored value", () => {
    const p = makePlayer();
    p.props.set(PROP_NOTIFY, '{"sound":false,"message":true}');
    expect(getNotifyPrefs(p)).toEqual({ sound: false, message: true });
  });

  it("set updates the cache at once and persists only after system.run (restricted execution)", () => {
    const p = makePlayer();
    _withExecMode("restricted", () => setNotifyPrefs(p, { sound: false, message: true }));
    expect(getNotifyPrefs(p)).toEqual({ sound: false, message: true });
    expect(p.props.has(PROP_NOTIFY)).toBe(false);
    system.flushRuns();
    expect(p.props.get(PROP_NOTIFY)).toBe('{"sound":false,"message":true}');
  });

  it("two sets before a flush write the last one", () => {
    const p = makePlayer();
    _withExecMode("restricted", () => {
      setNotifyPrefs(p, { sound: false, message: false });
      setNotifyPrefs(p, { sound: true, message: false });
    });
    expect(p.props.has(PROP_NOTIFY)).toBe(false);
    system.flushRuns();
    expect(p.props.get(PROP_NOTIFY)).toBe('{"sound":true,"message":false}');
    expect(getNotifyPrefs(p)).toEqual({ sound: true, message: false });
  });

  it.each([42, "not json", "[]", "null", '{"sound":'])("a corrupt stored value (%j) gives DEFAULT without warnings", (raw) => {
    const p = makePlayer();
    p.props.set(PROP_NOTIFY, raw);
    for (let i = 0; i < 5; i++) expect(getNotifyPrefs(p)).toEqual(DEFAULT_NOTIFY);
    expect(p.props.get(PROP_NOTIFY)).toBe(raw); // reading never rewrites
    expect(warn).not.toHaveBeenCalled();
  });

  it("a throwing read warns once and returns DEFAULT", () => {
    const bad = {
      id: "x",
      getDynamicProperty: () => {
        throw new Error("boom");
      },
      setDynamicProperty: () => undefined,
    };
    expect(getNotifyPrefs(bad)).toEqual(DEFAULT_NOTIFY);
    expect(getNotifyPrefs(bad)).toEqual(DEFAULT_NOTIFY);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("separate players stay independent", () => {
    const a = makePlayer();
    const b = makePlayer();
    expect(a.id).not.toBe(b.id);
    setNotifyPrefs(a, { sound: false, message: false });
    system.flushRuns();
    expect(getNotifyPrefs(a)).toEqual({ sound: false, message: false });
    expect(getNotifyPrefs(b)).toEqual(DEFAULT_NOTIFY);
    expect(b.props.has(PROP_NOTIFY)).toBe(false);
  });
});
