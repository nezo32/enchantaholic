/**
 * Stacking math.
 * vanilla: current real level (0 = absent); extra: stored true level from dynprop/lore (if any).
 * Overcap is valid only while the vanilla level equals the max level.
 */
export function resolveTrueLevel(vanilla: number, maxLevel: number, extra: number | undefined): number {
  if (vanilla <= 0) return 0;
  if (vanilla < maxLevel) return vanilla;
  return Math.max(vanilla, extra ?? 0);
}

/** trueLevel + 1 (no cap). */
export function nextTrueLevel(trueLevel: number): number {
  return trueLevel + 1;
}

/** Level actually written to the vanilla enchantment. */
export function appliedLevel(trueLevel: number, maxLevel: number): number {
  return Math.min(trueLevel, maxLevel);
}

export function overcapOf(trueLevel: number, maxLevel: number): number {
  return Math.max(0, trueLevel - maxLevel);
}

/** Drop entries whose vanilla level < max, whose level <= max, or whose id is unknown. */
export function pruneExtras(
  extras: ReadonlyMap<string, number>,
  vanillaOf: (id: string) => number,
  maxOf: (id: string) => number | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, level] of extras) {
    const max = maxOf(id);
    if (max === undefined) continue;
    if (level <= max) continue;
    if (vanillaOf(id) < max) continue;
    out.set(id, level);
  }
  return out;
}
