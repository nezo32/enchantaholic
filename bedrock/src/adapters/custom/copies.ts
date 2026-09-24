import type { Entity } from "@minecraft/server";
import { COPY_TAG, MAX_TRACKED_COPIES } from "../../core/custom/tuning";

/** Ids of live Barrage copies (oldest evicted first; the tag still identifies evicted ones). */
const copies = new Set<string>();

export function rememberCopy(id: string): void {
  copies.delete(id);
  copies.add(id);
  while (copies.size > MAX_TRACKED_COPIES) {
    const oldest = copies.values().next().value;
    if (oldest === undefined) break;
    copies.delete(oldest);
  }
}

/** Number of tracked (live) copies. */
export function liveCopies(): number {
  return copies.size;
}

export function forgetCopy(id: string): void {
  copies.delete(id);
}

/** True for a Barrage copy (tracked id or COPY_TAG). */
export function isCopy(entity: Entity): boolean {
  try {
    return copies.has(entity.id) || entity.hasTag(COPY_TAG);
  } catch {
    return false;
  }
}

/** Test helpers. */
export function _copies(): ReadonlySet<string> {
  return copies;
}
export function _resetCopies(): void {
  copies.clear();
}
