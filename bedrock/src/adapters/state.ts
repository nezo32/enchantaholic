import { world } from "@minecraft/server";
import { PROP_ENABLED } from "../core/config";

let cached: boolean | undefined;

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

/** Test helper. */
export function _resetStateCache(): void {
  cached = undefined;
}
