import type { Entity } from "@minecraft/server";
import { system } from "@minecraft/server";
import { PROP_NOTIFY } from "../core/config";
import { DEFAULT_NOTIFY, encodeNotifyPrefs, parseNotifyPrefs, type NotifyPrefs } from "../core/notify";
import { safe, warnOnce } from "./log";

/** Anything with a stable id and dynamic properties (Player / Entity; FakePlayer in tests). */
export type PrefsHolder = Pick<Entity, "id" | "getDynamicProperty" | "setDynamicProperty">;

/** In-memory source of truth per entity id; writes to the property are deferred to system.run. */
const cache = new Map<string, NotifyPrefs>();

/** Cached per entity id; first read parses PROP_NOTIFY. Never throws (errors -> warnOnce("notify-read") + DEFAULT_NOTIFY). */
export function getNotifyPrefs(p: PrefsHolder): NotifyPrefs {
  try {
    const hit = cache.get(p.id);
    if (hit) return hit;
    const prefs = parseNotifyPrefs(p.getDynamicProperty(PROP_NOTIFY));
    cache.set(p.id, prefs);
    return prefs;
  } catch (err) {
    warnOnce("notify-read", err);
    return DEFAULT_NOTIFY;
  }
}

/**
 * Updates the cache now; persists in system.run (custom command callbacks run in restricted
 * execution), writing the latest cached value for p.id so several changes in one tick end up
 * as the last one.
 */
export function setNotifyPrefs(p: PrefsHolder, prefs: NotifyPrefs): void {
  const id = p.id;
  cache.set(id, { sound: prefs.sound, message: prefs.message });
  system.run(
    safe("notify-save", () => {
      const latest = cache.get(id) ?? prefs;
      p.setDynamicProperty(PROP_NOTIFY, encodeNotifyPrefs(latest));
    }),
  );
}

/** Test helper. */
export function _resetNotifyCache(): void {
  cache.clear();
}
