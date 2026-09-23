import { beforeEach, describe, expect, it } from "vitest";
import { _resetStateCache, isEnabled, setEnabled } from "../../src/adapters/state";
import { PROP_ENABLED } from "../../src/core/config";
import { world } from "../fakes/minecraft-server";
import { resetAll } from "./helpers";

describe("state", () => {
  beforeEach(() => void resetAll());

  it("defaults to ON when the property is missing", () => {
    expect(isEnabled()).toBe(true);
  });

  it("persists and caches setEnabled(false)", () => {
    setEnabled(false);
    expect(world.getDynamicProperty(PROP_ENABLED)).toBe(false);
    expect(isEnabled()).toBe(false);
    world.setDynamicProperty(PROP_ENABLED, true); // cache wins until reset
    expect(isEnabled()).toBe(false);
    _resetStateCache();
    expect(isEnabled()).toBe(true);
  });

  it("reads a persisted OFF after a reload", () => {
    world.setDynamicProperty(PROP_ENABLED, false);
    expect(isEnabled()).toBe(false);
  });
});
