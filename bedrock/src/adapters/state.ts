import { world } from "@minecraft/server";
import { PROP_CUSTOM_ENABLED, PROP_ENABLED } from "../core/config";

let cached: boolean | undefined;
let customCached: boolean | undefined;

/** Enchantaholic Mode flag. A missing property counts as ON (D2). */
export function isEnabled(): boolean {
  if (cached === undefined) cached = world.getDynamicProperty(PROP_ENABLED) !== false;
  return cached;
}

/** Persists the flag. Must be called outside restricted execution (e.g. from system.run). */
export function setEnabled(on: boolean): void {
  world.setDynamicProperty(PROP_ENABLED, on);
  cached = on;
}

/** Custom Enchantments flag. Missing property (or anything but true) = OFF. Cached like isEnabled. */
export function isCustomEnabled(): boolean {
  if (customCached === undefined) customCached = world.getDynamicProperty(PROP_CUSTOM_ENABLED) === true;
  return customCached;
}

/** Persists the custom flag. Outside restricted execution only. */
export function setCustomEnabled(on: boolean): void {
  world.setDynamicProperty(PROP_CUSTOM_ENABLED, on);
  customCached = on;
}

/** Test helper (clears both caches). */
export function _resetStateCache(): void {
  cached = undefined;
  customCached = undefined;
}
