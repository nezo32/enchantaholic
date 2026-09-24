/** Pure helpers for custom enchantment levels. */
import { decodeLevels } from "../level-codec";
import { splitLore, type LoreLine } from "../lore";
import { isCustomId, type CustomId } from "./roster";

/** Custom levels from managed lore lines, overlaid by the decoded dynprop (non-stackables only). Unknown ids dropped. */
export function customLevelsFrom(lore: readonly LoreLine[], rawProp: unknown, stackable: boolean): Map<CustomId, number> {
  const out = new Map<CustomId, number>();
  for (const [id, level] of splitLore(lore).managed) if (isCustomId(id)) out.set(id, level);
  if (!stackable) {
    for (const [id, level] of decodeLevels(rawProp)) if (isCustomId(id)) out.set(id, level);
  }
  return out;
}

/** Only the non-custom entries of a map (used by readExtras). */
export function withoutCustoms<V>(m: ReadonlyMap<string, V>): Map<string, V> {
  const out = new Map<string, V>();
  for (const [k, v] of m) if (!isCustomId(k)) out.set(k, v);
  return out;
}
