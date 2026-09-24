import { beforeEach, describe, expect, it } from "vitest";
import { _resetStateCache, isCustomEnabled, isEnabled, setCustomEnabled, setEnabled } from "../../src/adapters/state";
import { PROP_CUSTOM_ENABLED, PROP_ENABLED } from "../../src/core/config";
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

describe("custom enchantments state", () => {
  beforeEach(() => void resetAll());

  it("defaults to OFF when the property is missing (or not exactly true)", () => {
    expect(isCustomEnabled()).toBe(false);
    _resetStateCache();
    world.setDynamicProperty(PROP_CUSTOM_ENABLED, "true");
    expect(isCustomEnabled()).toBe(false);
  });

  it("persists, caches, and is independent of the mode", () => {
    setCustomEnabled(true);
    expect(world.getDynamicProperty(PROP_CUSTOM_ENABLED)).toBe(true);
    expect(isCustomEnabled()).toBe(true);
    expect(isEnabled()).toBe(true);
    world.setDynamicProperty(PROP_CUSTOM_ENABLED, false); // cache wins until reset
    expect(isCustomEnabled()).toBe(true);
    _resetStateCache();
    expect(isCustomEnabled()).toBe(false);
    world.setDynamicProperty(PROP_CUSTOM_ENABLED, true); // reload with ON persisted
    _resetStateCache();
    expect(isCustomEnabled()).toBe(true);
  });
});

