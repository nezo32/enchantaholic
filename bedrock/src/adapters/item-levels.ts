import { ItemComponentTypes, type ItemEnchantableComponent, type ItemStack } from "@minecraft/server";
import { NON_ENCHANTABLE_OVERRIDE, PROP_CUSTOM_LEVELS, PROP_LEVELS } from "../core/config";
import { customLevelsFrom, withoutCustoms } from "../core/custom/levels";
import type { CustomId } from "../core/custom/roster";
import type { EnchantInfo } from "../core/eligibility";
import { normalizeId } from "../core/ids";
import { decodeLevels, encodeLevels } from "../core/level-codec";
import { overcapOf, pruneExtras, resolveTrueLevel } from "../core/levels";
import { composeLore, splitLore } from "../core/lore";
import type { ItemProbe } from "../core/selection";
import { warnOnce } from "./log";
import type { EnchantRegistry } from "./registry";

/** The item's enchantable component, or undefined when absent, overridden, or the lookup throws. */
export function getEnchantable(item: ItemStack): ItemEnchantableComponent | undefined {
  try {
    if (NON_ENCHANTABLE_OVERRIDE.has(normalizeId(item.typeId))) return undefined;
    return item.getComponent(ItemComponentTypes.Enchantable);
  } catch {
    return undefined;
  }
}

/** Current vanilla level of an enchantment (0 when absent or on error). */
function vanillaLevel(ench: ItemEnchantableComponent, id: string): number {
  try {
    return ench.getEnchantment(id)?.level ?? 0;
  } catch {
    return 0;
  }
}

function safeLore(item: ItemStack): string[] {
  try {
    return item.getLore();
  } catch {
    return [];
  }
}

/**
 * Stored true levels above max: the managed lore map, overlaid by the item dynamic property
 * (source of truth) on non-stackable items. Custom enchantments are excluded (see readCustoms):
 * they have no registry max, so pruneExtras would drop them.
 */
export function readExtras(item: ItemStack): Map<string, number> {
  const managed = withoutCustoms(splitLore(safeLore(item)).managed);
  if (!item.isStackable) {
    let raw: unknown;
    try {
      raw = item.getDynamicProperty(PROP_LEVELS);
    } catch {
      raw = undefined;
    }
    for (const [id, level] of decodeLevels(raw)) managed.set(normalizeId(id), level);
  }
  return withoutCustoms(managed);
}

/** All custom levels on the item (lore ∪ dynprop; dynprop wins on non-stackables). Never throws. */
export function readCustoms(item: ItemStack): Map<CustomId, number> {
  try {
    const stackable = item.isStackable;
    let raw: unknown;
    if (!stackable) {
      try {
        raw = item.getDynamicProperty(PROP_CUSTOM_LEVELS);
      } catch {
        raw = undefined;
      }
    }
    return customLevelsFrom(safeLore(item), raw, stackable);
  } catch {
    return new Map();
  }
}

/** Level of one custom enchant; 0 for undefined item, absent enchant, or error. Never throws. Does NOT check the setting. */
export function getCustomLevel(item: ItemStack | undefined, id: CustomId): number {
  if (!item) return 0;
  return readCustoms(item).get(id) ?? 0;
}

/** Recomposes the managed lore lines from `managed` (vanilla extras ∪ customs); writes only on change. */
function writeManagedLore(item: ItemStack, managed: ReadonlyMap<string, number>): void {
  const current = safeLore(item);
  const next = composeLore(splitLore(current).user, managed);
  if (!sameLines(current, next)) {
    try {
      item.setLore(next);
    } catch (err) {
      warnOnce("lore", err);
    }
  }
}

/** Persists customs: dynprop (non-stackable, skip if unchanged) + recomposed lore that keeps vanilla-overcap lines. Never throws. */
export function writeCustoms(item: ItemStack, customs: ReadonlyMap<CustomId, number>): void {
  const clean = new Map<string, number>();
  for (const [id, level] of customs) if (Number.isSafeInteger(level) && level >= 1) clean.set(id, level);
  let stackable: boolean;
  try {
    stackable = item.isStackable;
  } catch {
    stackable = true;
  }
  if (!stackable) {
    try {
      const encoded = encodeLevels(clean);
      if (item.getDynamicProperty(PROP_CUSTOM_LEVELS) !== encoded) item.setDynamicProperty(PROP_CUSTOM_LEVELS, encoded);
    } catch (err) {
      warnOnce("dynprop", err);
    }
  }
  const managed = readExtras(item);
  for (const [id, level] of clean) managed.set(id, level);
  writeManagedLore(item, managed);
}

/** Resolved true level; stored extras are consulted only when the vanilla level is at max (D9). */
export function trueLevelOf(
  item: ItemStack,
  ench: ItemEnchantableComponent,
  info: EnchantInfo,
  extras?: Map<string, number>,
): number {
  const vanilla = vanillaLevel(ench, info.id);
  if (vanilla < info.maxLevel) return resolveTrueLevel(vanilla, info.maxLevel, undefined);
  return resolveTrueLevel(vanilla, info.maxLevel, (extras ?? readExtras(item)).get(info.id));
}

/** Overcap levels (true − max) of one enchantment. Fast path: no lore/dynprop read below max. */
export function overcapLevel(item: ItemStack, info: EnchantInfo): number {
  const ench = getEnchantable(item);
  if (!ench) return 0;
  const vanilla = vanillaLevel(ench, info.id);
  if (vanilla <= 0 || vanilla < info.maxLevel) return 0;
  return overcapOf(resolveTrueLevel(vanilla, info.maxLevel, readExtras(item).get(info.id)), info.maxLevel);
}

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/**
 * Persists extras: stale entries are pruned, the dynamic property is written on non-stackable
 * items, and the managed lore lines are recomposed (only when they change). Never throws.
 */
export function writeExtras(
  item: ItemStack,
  ench: ItemEnchantableComponent,
  extras: Map<string, number>,
  reg: EnchantRegistry,
): void {
  const pruned = pruneExtras(
    extras,
    (id) => vanillaLevel(ench, id),
    (id) => reg.maxLevel(id),
  );
  if (!item.isStackable) {
    try {
      const encoded = encodeLevels(pruned);
      // Skip the write when nothing changes (the common case: items that never went past max).
      if (item.getDynamicProperty(PROP_LEVELS) !== encoded) item.setDynamicProperty(PROP_LEVELS, encoded);
    } catch (err) {
      warnOnce("dynprop", err);
    }
  }
  // Custom lines have no registry max; keep them as they are (they are not part of `extras`).
  const managed = new Map<string, number>(withoutCustoms(pruned));
  for (const [id, level] of readCustoms(item)) managed.set(id, level);
  writeManagedLore(item, managed);
}

/**
 * Lazy ItemProbe for the selection algorithm. The enchantable component and the stored extras are
 * only looked up for the slots the selection actually visits (usually 1–3 of up to 41).
 */
export function makeProbe(item: ItemStack, reg: EnchantRegistry): ItemProbe {
  let resolved = false;
  let cachedEnch: ItemEnchantableComponent | undefined;
  const enchOf = (): ItemEnchantableComponent | undefined => {
    if (!resolved) {
      cachedEnch = getEnchantable(item);
      resolved = true;
    }
    return cachedEnch;
  };
  let extras: Map<string, number> | undefined;
  let customs: Map<CustomId, number> | undefined;
  return {
    typeId: item.typeId,
    get enchantable(): boolean {
      return enchOf() !== undefined;
    },
    trueLevel(enchantId: string): number {
      const ench = enchOf();
      if (!ench) return 0;
      const id = normalizeId(enchantId);
      const maxLevel = reg.maxLevel(id);
      if (maxLevel === undefined) return 0;
      const vanilla = vanillaLevel(ench, id);
      if (vanilla < maxLevel) return resolveTrueLevel(vanilla, maxLevel, undefined);
      extras ??= readExtras(item);
      return resolveTrueLevel(vanilla, maxLevel, extras.get(id));
    },
    canAddFresh(enchantId: string): boolean {
      const ench = enchOf();
      if (!ench) return false;
      const type = reg.type(enchantId);
      if (!type) return false;
      try {
        return ench.canAddEnchantment({ type, level: 1 });
      } catch {
        return false;
      }
    },
    customLevel(id: string): number {
      customs ??= readCustoms(item);
      return customs.get(id as CustomId) ?? 0;
    },
  };
}

/** overcapLevel by enchant id, using the registry's max level (0 for unknown ids). */
export function overcapById(item: ItemStack, enchantId: string, reg: EnchantRegistry): number {
  const id = normalizeId(enchantId);
  const maxLevel = reg.maxLevel(id);
  if (maxLevel === undefined) return 0;
  return overcapLevel(item, { id, maxLevel });
}
