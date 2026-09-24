import type { EnchantInfo } from "./eligibility";
import { englishNameOfKey, isCurse, nameMsg } from "./enchant-names";
import { join, K, onOff, renderText, tr, type Msg } from "./i18n";
import { toRoman } from "./roman";

/** Structurally equal to a RawMessage fragment. */
export type MsgPart = Msg;

/**
 * Actionbar: `§d✦ <item> §7→ §b<Enchant> <Roman>` (curse §c, overcapped level §6). The item and
 * enchantment names are translate keys, so each player sees them in their own language.
 */
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
    { text: `§r§7 → ${color}` },
    nameMsg(enchant.id),
    { text: ` ${levelColor}${toRoman(level)}` },
  ];
}

/** "Enchantaholic Mode: §aON" / "Enchantaholic Mode: §cOFF". */
export function statusText(enabled: boolean): Msg {
  return tr(K.modeStatus, onOff(enabled));
}

/** "Custom Enchantments: §aON" / "Custom Enchantments: §cOFF" (status reply). */
export function customStatusText(on: boolean): Msg {
  return tr(K.customStatus, onOff(on));
}

/** "Custom Enchantments are now §aON§r for this world" (on/off reply and broadcast). */
export function customChangedText(on: boolean): Msg {
  return tr(K.customChanged, onOff(on));
}

/** Second line after turning customs on while Enchantaholic Mode is off. */
export const CUSTOM_MODE_OFF_HINT: Msg = tr(K.customModeOffHint);

/** Reply plus the hint on a second line. */
export function withHint(msg: Msg): Msg {
  return join(msg, { text: "\n" }, CUSTOM_MODE_OFF_HINT);
}

/** English text of any message built here (vanilla enchantment names included). */
export function englishText(msg: Msg | readonly Msg[]): string {
  return renderText(Array.isArray(msg) ? { rawtext: [...msg] } : (msg as Msg), englishNameOfKey);
}
