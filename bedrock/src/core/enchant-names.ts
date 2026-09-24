import { customDef, CUSTOM_ENCHANTS } from "./custom/roster";
import { customNameKey, type Msg } from "./i18n";
import { normalizeId } from "./ids";

/** Explicit English display names for all vanilla enchantment ids. */
const NAMES: Readonly<Record<string, string>> = {
  "minecraft:aqua_affinity": "Aqua Affinity",
  "minecraft:bane_of_arthropods": "Bane of Arthropods",
  "minecraft:binding": "Curse of Binding",
  "minecraft:blast_protection": "Blast Protection",
  "minecraft:breach": "Breach",
  "minecraft:channeling": "Channeling",
  "minecraft:density": "Density",
  "minecraft:depth_strider": "Depth Strider",
  "minecraft:efficiency": "Efficiency",
  "minecraft:feather_falling": "Feather Falling",
  "minecraft:fire_aspect": "Fire Aspect",
  "minecraft:fire_protection": "Fire Protection",
  "minecraft:flame": "Flame",
  "minecraft:fortune": "Fortune",
  "minecraft:frost_walker": "Frost Walker",
  "minecraft:impaling": "Impaling",
  "minecraft:infinity": "Infinity",
  "minecraft:knockback": "Knockback",
  "minecraft:looting": "Looting",
  "minecraft:loyalty": "Loyalty",
  "minecraft:luck_of_the_sea": "Luck of the Sea",
  "minecraft:lunge": "Lunge",
  "minecraft:lure": "Lure",
  "minecraft:mending": "Mending",
  "minecraft:multishot": "Multishot",
  "minecraft:piercing": "Piercing",
  "minecraft:power": "Power",
  "minecraft:projectile_protection": "Projectile Protection",
  "minecraft:protection": "Protection",
  "minecraft:punch": "Punch",
  "minecraft:quick_charge": "Quick Charge",
  "minecraft:respiration": "Respiration",
  "minecraft:riptide": "Riptide",
  "minecraft:sharpness": "Sharpness",
  "minecraft:silk_touch": "Silk Touch",
  "minecraft:smite": "Smite",
  "minecraft:soul_speed": "Soul Speed",
  "minecraft:swift_sneak": "Swift Sneak",
  "minecraft:thorns": "Thorns",
  "minecraft:unbreaking": "Unbreaking",
  "minecraft:vanishing": "Curse of Vanishing",
  "minecraft:wind_burst": "Wind Burst",
};

/**
 * Vanilla Bedrock lang keys of all 42 vanilla enchantments (verified against Mojang/bedrock-samples
 * resource_pack/texts/en_US.lang and ru_RU.lang). The client translates them itself.
 */
const VANILLA_KEYS: Readonly<Record<string, string>> = {
  "minecraft:aqua_affinity": "enchantment.waterWorker",
  "minecraft:bane_of_arthropods": "enchantment.damage.arthropods",
  "minecraft:binding": "enchantment.curse.binding",
  "minecraft:blast_protection": "enchantment.protect.explosion",
  "minecraft:breach": "enchantment.heavy_weapon.breach",
  "minecraft:channeling": "enchantment.tridentChanneling",
  "minecraft:density": "enchantment.heavy_weapon.density",
  "minecraft:depth_strider": "enchantment.waterWalker",
  "minecraft:efficiency": "enchantment.digging",
  "minecraft:feather_falling": "enchantment.protect.fall",
  "minecraft:fire_aspect": "enchantment.fire",
  "minecraft:fire_protection": "enchantment.protect.fire",
  "minecraft:flame": "enchantment.arrowFire",
  "minecraft:fortune": "enchantment.lootBonusDigger",
  "minecraft:frost_walker": "enchantment.frostwalker",
  "minecraft:impaling": "enchantment.tridentImpaling",
  "minecraft:infinity": "enchantment.arrowInfinite",
  "minecraft:knockback": "enchantment.knockback",
  "minecraft:looting": "enchantment.lootBonus",
  "minecraft:loyalty": "enchantment.tridentLoyalty",
  "minecraft:luck_of_the_sea": "enchantment.lootBonusFishing",
  "minecraft:lunge": "enchantment.lunge",
  "minecraft:lure": "enchantment.fishingSpeed",
  "minecraft:mending": "enchantment.mending",
  "minecraft:multishot": "enchantment.crossbowMultishot",
  "minecraft:piercing": "enchantment.crossbowPiercing",
  "minecraft:power": "enchantment.arrowDamage",
  "minecraft:projectile_protection": "enchantment.protect.projectile",
  "minecraft:protection": "enchantment.protect.all",
  "minecraft:punch": "enchantment.arrowKnockback",
  "minecraft:quick_charge": "enchantment.crossbowQuickCharge",
  "minecraft:respiration": "enchantment.oxygen",
  "minecraft:riptide": "enchantment.tridentRiptide",
  "minecraft:sharpness": "enchantment.damage.all",
  "minecraft:silk_touch": "enchantment.untouching",
  "minecraft:smite": "enchantment.damage.undead",
  "minecraft:soul_speed": "enchantment.soul_speed",
  "minecraft:swift_sneak": "enchantment.swift_sneak",
  "minecraft:thorns": "enchantment.thorns",
  "minecraft:unbreaking": "enchantment.durability",
  "minecraft:vanishing": "enchantment.curse.vanishing",
  "minecraft:wind_burst": "enchantment.heavy_weapon.windburst",
};

const BY_NAME: ReadonlyMap<string, string> = new Map(Object.entries(NAMES).map(([id, name]) => [name, id]));
/** Custom enchantment names (disjoint from the vanilla table). */
const CUSTOM_BY_NAME: ReadonlyMap<string, string> = new Map(CUSTOM_ENCHANTS.map((d) => [d.name, d.id]));

const ID_BY_KEY: ReadonlyMap<string, string> = new Map([
  ...Object.entries(VANILLA_KEYS).map(([id, key]) => [key, id] as const),
  ...CUSTOM_ENCHANTS.map((d) => [customNameKey(d.key), d.id] as const),
]);

export const CURSES: ReadonlySet<string> = new Set(["minecraft:binding", "minecraft:vanishing"]);

/** Explicit table for vanilla ids, then custom names; fallback: title-cased path with "_" → " ". */
export function displayName(enchantId: string): string {
  const id = normalizeId(enchantId);
  const known = NAMES[id];
  if (known !== undefined) return known;
  const custom = customDef(id);
  if (custom) return custom.name;
  const path = id.slice(id.indexOf(":") + 1);
  return path
    .split("_")
    .filter((w) => w.length > 0)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Reverse of the explicit table (vanilla first, then custom names). */
export function idFromDisplayName(name: string): string | undefined {
  return BY_NAME.get(name) ?? CUSTOM_BY_NAME.get(name);
}

/** Vanilla curses (CURSES) and the custom curses. */
export function isCurse(enchantId: string): boolean {
  const id = normalizeId(enchantId);
  return CURSES.has(id) || customDef(id)?.curse === true;
}

/** Lang key of an enchantment's name: the vanilla key, our own key for customs, undefined for unknown ids. */
export function nameKey(enchantId: string): string | undefined {
  const id = normalizeId(enchantId);
  const vanilla = VANILLA_KEYS[id];
  if (vanilla !== undefined) return vanilla;
  const custom = customDef(id);
  return custom ? customNameKey(custom.key) : undefined;
}

/** Reverse of nameKey. */
export function idFromNameKey(key: string): string | undefined {
  return ID_BY_KEY.get(key);
}

/** Translatable name (`{ translate }`), or the English fallback name as text for unknown ids. */
export function nameMsg(enchantId: string): Msg {
  const key = nameKey(enchantId);
  return key !== undefined ? { translate: key } : { text: displayName(enchantId) };
}

/** English name for a vanilla or custom name key (renderText lookup); undefined for other keys. */
export function englishNameOfKey(key: string): string | undefined {
  const id = ID_BY_KEY.get(key);
  return id === undefined ? undefined : displayName(id);
}
