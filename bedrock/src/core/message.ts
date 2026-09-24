import { MODE_LABEL } from "./config";
import type { EnchantInfo } from "./eligibility";
import { displayName, isCurse } from "./enchant-names";
import { toRoman } from "./roman";

/** Structurally equal to a RawMessage fragment. */
export type MsgPart = { text: string } | { translate: string };

/** Actionbar: `§d✦ <item> §7→ §b<Enchant> <Roman>` (curse §c, overcapped level §6). */
export function buildEnchantMessage(
  item: { nameTag?: string; localizationKey: string },
  enchant: EnchantInfo,
  level: number,
): MsgPart[] {
  const color = isCurse(enchant.id) ? "§c" : "§b";
  const levelColor = level > enchant.maxLevel ? "§6" : "";
  return [
    { text: "§d✦ " },
    item.nameTag ? { text: item.nameTag } : { translate: item.localizationKey },
    { text: "§r§7 → " },
    { text: `${color}${displayName(enchant.id)} ${levelColor}${toRoman(level)}` },
  ];
}

/** "Enchantaholic Mode: §aON" / "Enchantaholic Mode: §cOFF". */
export function statusText(enabled: boolean): string {
  return `${MODE_LABEL}: ${enabled ? "§aON" : "§cOFF"}`;
}
