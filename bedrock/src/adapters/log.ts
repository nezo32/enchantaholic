/**
 * Logging helpers for adapters. Warnings go to the content log once per key so a
 * misbehaving handler cannot flood it; debug output only exists in DEBUG builds.
 */

const warned = new Set<string>();

function describe(err: unknown): string {
  if (err instanceof Error) return err.stack ?? `${err.name}: ${err.message}`;
  try {
    return String(err);
  } catch {
    return "<unprintable error>";
  }
}

/** console.warn("[Enchantaholic] key: msg") at most once per key per session. */
export function warnOnce(key: string, err: unknown): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[Enchantaholic] ${key}: ${describe(err)}`);
}

/** No-op unless the bundle was built with DEBUG=1. */
export function debug(msg: string): void {
  if (__ENCHANTAHOLIC_DEBUG__) console.info(`[Enchantaholic][debug] ${msg}`);
}

/** Wraps a callback so that it never throws into the engine. */
export function safe<A extends unknown[]>(key: string, fn: (...a: A) => void): (...a: A) => void {
  return (...a: A): void => {
    try {
      fn(...a);
    } catch (err) {
      warnOnce(key, err);
    }
  };
}

/** Test helper: forget which keys have already warned. */
export function _resetWarnings(): void {
  warned.clear();
}
