import { CUSTOM_LABEL, MODE_LABEL } from "./config";
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

/** "Custom Enchantments: §aON" / "Custom Enchantments: §cOFF" (status reply). */
export function customStatusText(on: boolean): string {
  return `${CUSTOM_LABEL}: ${on ? "§aON" : "§cOFF"}`;
}

/** "Custom Enchantments are now §aON§r for this world" (on/off reply and broadcast). */
export function customChangedText(on: boolean): string {
  return `${CUSTOM_LABEL} are now ${on ? "§aON" : "§cOFF"}§r for this world`;
}

/** Second line after turning customs on while Enchantaholic Mode is off. */
export const CUSTOM_MODE_OFF_HINT =
  "§7(Enchantaholic Mode is §cOFF§7, so nothing will roll until you turn it on with /enchantaholic:toggle on)";
