import { ItemComponentTypes, type ItemEnchantableComponent, type ItemStack } from "@minecraft/server";
import { NON_ENCHANTABLE_OVERRIDE, PROP_LEVELS } from "../core/config";
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
 * (source of truth) on non-stackable items.
 */
export function readExtras(item: ItemStack): Map<string, number> {
  const { managed } = splitLore(safeLore(item));
  if (!item.isStackable) {
    let raw: unknown;
    try {
      raw = item.getDynamicProperty(PROP_LEVELS);
    } catch {
      raw = undefined;
    }
    for (const [id, level] of decodeLevels(raw)) managed.set(normalizeId(id), level);
  }
  return managed;
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
      item.setDynamicProperty(PROP_LEVELS, encodeLevels(pruned));
    } catch (err) {
      warnOnce("dynprop", err);
    }
  }
  const current = safeLore(item);
  const next = composeLore(splitLore(current).user, pruned);
  if (!sameLines(current, next)) {
    try {
      item.setLore(next);
    } catch (err) {
      warnOnce("lore", err);
    }
  }
}

/** Lazy ItemProbe for the selection algorithm. */
export function makeProbe(item: ItemStack, reg: EnchantRegistry): ItemProbe {
  const ench = getEnchantable(item);
  let extras: Map<string, number> | undefined;
  return {
    typeId: item.typeId,
    enchantable: ench !== undefined,
    trueLevel(enchantId: string): number {
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
      if (!ench) return false;
      const type = reg.type(enchantId);
      if (!type) return false;
      try {
        return ench.canAddEnchantment({ type, level: 1 });
      } catch {
        return false;
      }
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
