import { eligibleEnchants, type EnchantInfo } from "./eligibility";
import { pickIndex, shuffled, type Rng } from "./rng";

/** Read-only view of an item that the selection algorithm needs. */
export interface ItemProbe {
  readonly typeId: string;
  /** Has minecraft:enchantable. */
  readonly enchantable: boolean;
  /** Resolved true level, 0 if absent. */
  trueLevel(enchantId: string): number;
  /** canAddEnchantment({type, level: 1}); false on throw. */
  canAddFresh(enchantId: string): boolean;
}

/** Non-empty slots only. */
export interface SlotCandidate<K> {
  readonly key: K;
  readonly item: ItemProbe;
}

export interface EnchantPlan<K> {
  readonly key: K;
  readonly enchant: EnchantInfo;
  /** True level before (0 = new). */
  readonly fromLevel: number;
  /** fromLevel + 1. */
  readonly toLevel: number;
}

/**
 * Lazily yields plans in priority order; the adapter applies the first that succeeds.
 * Slots are drawn uniformly without replacement; within a slot, eligible enchants are shuffled and
 * each one already on the item (true level > 0) or freshly addable is yielded.
 */
export function* iteratePlans<K>(
  slots: readonly SlotCandidate<K>[],
  enchants: readonly EnchantInfo[],
  rng: Rng,
): Generator<EnchantPlan<K>> {
  const remaining = slots.slice();
  while (remaining.length > 0) {
    const c = remaining.splice(pickIndex(remaining.length, rng), 1)[0] as SlotCandidate<K>;
    if (!c.item.enchantable) continue;
    for (const e of shuffled(eligibleEnchants(enchants, c.item.typeId), rng)) {
      const lvl = c.item.trueLevel(e.id);
      if (lvl > 0 || c.item.canAddFresh(e.id)) {
        yield { key: c.key, enchant: e, fromLevel: lvl, toLevel: lvl + 1 };
      }
    }
  }
}
