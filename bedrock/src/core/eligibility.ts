import { isSpear } from "./ids";

/** An enchantment type as seen by core logic (id normalized). */
export interface EnchantInfo {
  readonly id: string;
  readonly maxLevel: number;
  /** True for Enchantaholic custom enchantments (lore/dynprop based, no engine enchantment type). */
  readonly custom?: boolean;
}

const LUNGE = "minecraft:lunge";

/** Removes minecraft:lunge unless the item is a spear. */
export function eligibleEnchants(all: readonly EnchantInfo[], itemTypeId: string): EnchantInfo[] {
  const spear = isSpear(itemTypeId);
  return all.filter((e) => spear || e.id !== LUNGE);
}
