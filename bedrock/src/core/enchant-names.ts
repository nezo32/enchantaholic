import { customDef, CUSTOM_ENCHANTS } from "./custom/roster";
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

const BY_NAME: ReadonlyMap<string, string> = new Map(Object.entries(NAMES).map(([id, name]) => [name, id]));
/** Custom enchantment names (disjoint from the vanilla table). */
const CUSTOM_BY_NAME: ReadonlyMap<string, string> = new Map(CUSTOM_ENCHANTS.map((d) => [d.name, d.id]));

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
