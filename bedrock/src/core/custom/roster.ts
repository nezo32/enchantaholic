/** Enchantaholic's own enchantments (v0.3.0). Pure: no @minecraft/* imports. */
import type { EnchantInfo } from "../eligibility";

export const CUSTOM_KEYS = [
  "vein_miner",
  "barrage",
  "yeet",
  "kaboom",
  "party_popper",
  "chicken_rain",
  "midas_touch",
  "magnet",
  "moon_boots",
  "butterfingers",
  "hiccups",
] as const;
export type CustomKey = (typeof CUSTOM_KEYS)[number];
export type CustomId = `enchantaholic:${CustomKey}`;

export interface CustomEnchantDef extends EnchantInfo {
  readonly id: CustomId;
  readonly key: CustomKey;
  /** English display name, e.g. "Vein Miner", "Curse of Butterfingers". */
  readonly name: string;
  readonly curse: boolean;
  /** Always true: lets core/adapters branch without a lookup. */
  readonly custom: true;
  /** Nominal max, used ONLY for message colouring (level > maxLevel is shown gold). Always 5. */
  readonly maxLevel: 5;
}

const NAMES: Readonly<Record<CustomKey, string>> = {
  vein_miner: "Vein Miner",
  barrage: "Barrage",
  yeet: "Yeet",
  kaboom: "Kaboom",
  party_popper: "Party Popper",
  chicken_rain: "Chicken Rain",
  midas_touch: "Midas Touch",
  magnet: "Magnet",
  moon_boots: "Moon Boots",
  butterfingers: "Curse of Butterfingers",
  hiccups: "Curse of Hiccups",
};

const CURSE_KEYS: ReadonlySet<CustomKey> = new Set<CustomKey>(["butterfingers", "hiccups"]);

/** Same order as CUSTOM_KEYS. */
export const CUSTOM_ENCHANTS: readonly CustomEnchantDef[] = Object.freeze(
  CUSTOM_KEYS.map(
    (key): CustomEnchantDef =>
      Object.freeze({
        id: `enchantaholic:${key}` as const,
        key,
        name: NAMES[key],
        curse: CURSE_KEYS.has(key),
        custom: true as const,
        maxLevel: 5 as const,
      }),
  ),
);

/** CUSTOM.vein_miner === "enchantaholic:vein_miner", … */
export const CUSTOM: { readonly [K in CustomKey]: `enchantaholic:${K}` } = Object.freeze(
  Object.fromEntries(CUSTOM_KEYS.map((k) => [k, `enchantaholic:${k}`])) as { [K in CustomKey]: `enchantaholic:${K}` },
);

const BY_ID: ReadonlyMap<string, CustomEnchantDef> = new Map(CUSTOM_ENCHANTS.map((d) => [d.id, d]));

export function isCustomId(id: string): id is CustomId {
  return BY_ID.has(id);
}

export function customDef(id: string): CustomEnchantDef | undefined {
  return BY_ID.get(id);
}
