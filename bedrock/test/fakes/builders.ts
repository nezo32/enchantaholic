/**
 * Test builders on top of the fake `@minecraft/server` module.
 * All builders return fakes; use asPlayer/asItem/asEntity (or asReal<T>) to pass them where the
 * real type is expected.
 */
import type * as mc from "@minecraft/server";
import {
  EntityDamageCause,
  EquipmentSlot,
  FakeEnchantable,
  FakeEntity,
  FakeItemStack,
  FakePlayer,
  GameMode,
  asReal,
  type FakeEnchantableOptions,
} from "./minecraft-server";

export type EquipName = "Head" | "Chest" | "Legs" | "Feet" | "Offhand";

// ───────────────────────────── casts ─────────────────────────────

export const asPlayer = (p: FakePlayer): mc.Player => asReal<mc.Player>(p);
export const asItem = (i: FakeItemStack): mc.ItemStack => asReal<mc.ItemStack>(i);
export const asEntity = (e: FakeEntity): mc.Entity => asReal<mc.Entity>(e);
/** Inverse cast: a real-typed value that is actually a fake. */
export const fakeItem = (i: mc.ItemStack | undefined): FakeItemStack | undefined => i as unknown as FakeItemStack;
export const fakeEnchantable = (c: unknown): FakeEnchantable | undefined => c as FakeEnchantable | undefined;

// ───────────────────────────── compatibility tables ─────────────────────────────

const PROTECTIONS = ["protection", "fire_protection", "blast_protection", "projectile_protection"];
const COMMON = ["unbreaking", "mending", "vanishing"];
const DAMAGE = ["sharpness", "smite", "bane_of_arthropods"];

function mutuallyExclusive(ids: readonly string[]): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) out.push([ids[i] as string, ids[j] as string]);
  }
  return out;
}

export const COMPAT = {
  sword: {
    compatible: [...DAMAGE, "knockback", "fire_aspect", "looting", ...COMMON],
    conflicts: mutuallyExclusive(DAMAGE),
  },
  spear: {
    compatible: [...DAMAGE, "knockback", "fire_aspect", "looting", "lunge", ...COMMON],
    conflicts: mutuallyExclusive(DAMAGE),
  },
  pickaxe: {
    compatible: ["efficiency", "fortune", "silk_touch", ...COMMON],
    conflicts: [["fortune", "silk_touch"]],
  },
  helmet: {
    compatible: [...PROTECTIONS, "respiration", "aqua_affinity", "thorns", "binding", ...COMMON],
    conflicts: mutuallyExclusive(PROTECTIONS),
  },
  armor: {
    compatible: [...PROTECTIONS, "thorns", "binding", ...COMMON],
    conflicts: mutuallyExclusive(PROTECTIONS),
  },
  leggings: {
    compatible: [...PROTECTIONS, "thorns", "binding", "swift_sneak", ...COMMON],
    conflicts: mutuallyExclusive(PROTECTIONS),
  },
  boots: {
    compatible: [
      ...PROTECTIONS,
      "feather_falling",
      "depth_strider",
      "frost_walker",
      "soul_speed",
      "thorns",
      "binding",
      ...COMMON,
    ],
    conflicts: [...mutuallyExclusive(PROTECTIONS), ["depth_strider", "frost_walker"]],
  },
  bow: {
    compatible: ["power", "punch", "flame", "infinity", ...COMMON],
    conflicts: [["infinity", "mending"]],
  },
  shield: { compatible: [...COMMON], conflicts: [] },
  book: { compatible: "all", conflicts: [] },
} satisfies Record<string, { compatible: string[] | "all"; conflicts: Array<[string, string]> }>;

// ───────────────────────────── items ─────────────────────────────

export interface ItemSpec {
  amount?: number;
  maxAmount?: number;
  nameTag?: string;
  lore?: string[];
  /** Enchantable options, or false for items without minecraft:enchantable. Default false. */
  enchantable?: FakeEnchantableOptions | false;
  /** Pre-set vanilla levels (validation bypassed). */
  levels?: Record<string, number>;
  /** Pre-set item dynamic properties (only valid for non-stackables). */
  props?: Record<string, string | number | boolean>;
}

export function makeItem(typeId: string, spec: ItemSpec = {}): FakeItemStack {
  const enchantable = spec.enchantable ? new FakeEnchantable(spec.enchantable) : undefined;
  const item = new FakeItemStack(typeId, spec.amount ?? 1, {
    ...(spec.maxAmount !== undefined ? { maxAmount: spec.maxAmount } : {}),
    ...(spec.nameTag !== undefined ? { nameTag: spec.nameTag } : {}),
    ...(spec.lore ? { lore: spec.lore } : {}),
    ...(enchantable ? { enchantable } : {}),
  });
  for (const [id, lvl] of Object.entries(spec.levels ?? {})) enchantable?._set(id, lvl);
  for (const [k, v] of Object.entries(spec.props ?? {})) item.props.set(k, v);
  return item;
}

type Extra = Omit<ItemSpec, "enchantable">;

const make =
  (suffix: string, compat: FakeEnchantableOptions) =>
  (material = "diamond", extra: Extra = {}): FakeItemStack =>
    makeItem(`minecraft:${material}_${suffix}`, { ...extra, enchantable: compat });

export const sword = make("sword", COMPAT.sword);
export const pickaxe = make("pickaxe", COMPAT.pickaxe);
export const helmet = make("helmet", COMPAT.helmet);
export const chestplate = make("chestplate", COMPAT.armor);
export const leggings = make("leggings", COMPAT.leggings);
export const boots = make("boots", COMPAT.boots);
export const spear = (material = "iron", extra: Extra = {}): FakeItemStack =>
  makeItem(`minecraft:${material}_spear`, { ...extra, enchantable: COMPAT.spear });

export const bow = (extra: Extra = {}): FakeItemStack =>
  makeItem("minecraft:bow", { ...extra, enchantable: COMPAT.bow });
export const shield = (extra: Extra = {}): FakeItemStack =>
  makeItem("minecraft:shield", { ...extra, enchantable: COMPAT.shield });
export const trident = (extra: Extra = {}): FakeItemStack =>
  makeItem("minecraft:trident", {
    ...extra,
    enchantable: { compatible: ["loyalty", "riptide", "channeling", "impaling", ...COMMON] },
  });
export const dirt = (amount = 64): FakeItemStack => makeItem("minecraft:dirt", { amount });
export const enchantedBook = (extra: Extra = {}): FakeItemStack =>
  makeItem("minecraft:enchanted_book", { ...extra, enchantable: COMPAT.book });
/** Plain book stack without minecraft:enchantable. */
export const booksStack = (n = 5): FakeItemStack => makeItem("minecraft:book", { amount: n });

// ───────────────────────────── players / entities ─────────────────────────────

export interface PlayerSpec {
  name?: string;
  gameMode?: GameMode;
  selected?: number;
  inv?: Record<number, FakeItemStack>;
  equip?: Partial<Record<EquipName, FakeItemStack>>;
}

export function makePlayer(spec: PlayerSpec = {}): FakePlayer {
  const p = new FakePlayer(spec.name ?? "Steve");
  if (spec.gameMode) p.gameMode = spec.gameMode;
  if (spec.selected !== undefined) p.selectedSlotIndex = spec.selected;
  for (const [i, item] of Object.entries(spec.inv ?? {})) p.container.slots[Number(i)] = item;
  for (const [slot, item] of Object.entries(spec.equip ?? {})) {
    p.equippable.items.set(EquipmentSlot[slot as EquipName], item);
  }
  // Clear write logs so tests only see writes made by the code under test.
  p.container.writes.length = 0;
  p.equippable.writes.length = 0;
  return p;
}

/** Items currently held by the player (stored objects, no copies), keyed by slot. */
export function playerItems(p: FakePlayer): Array<{ slot: string; item: FakeItemStack }> {
  const out: Array<{ slot: string; item: FakeItemStack }> = [];
  p.container.slots.forEach((item, i) => item && out.push({ slot: `inv:${i}`, item }));
  for (const [slot, item] of p.equippable.items) if (item) out.push({ slot: `equip:${slot}`, item });
  return out;
}

export function makeEntity(typeId: string, families: readonly string[] = []): FakeEntity {
  return new FakeEntity(typeId, { families });
}

export const zombie = (): FakeEntity => makeEntity("minecraft:zombie", ["zombie", "undead", "monster", "mob"]);
export const spider = (): FakeEntity => makeEntity("minecraft:spider", ["spider", "arthropod", "monster", "mob"]);
export const cow = (): FakeEntity => makeEntity("minecraft:cow", ["cow", "mob"]);
export const arrow = (): FakeEntity => makeEntity("minecraft:arrow", ["arrow"]);

// ───────────────────────────── events ─────────────────────────────

export function makeBreakEvent(player: FakePlayer, blockId: string): mc.PlayerBreakBlockAfterEvent {
  return asReal<mc.PlayerBreakBlockAfterEvent>({
    player,
    block: { typeId: "minecraft:air", location: { x: 0, y: 64, z: 0 } },
    brokenBlockPermutation: { type: { id: blockId } },
    dimension: { id: "minecraft:overworld" },
    itemStackBeforeBreak: undefined,
    itemStackAfterBreak: undefined,
  });
}

export interface HurtSpec {
  victim: FakeEntity;
  damage: number;
  cause?: EntityDamageCause | string;
  attacker?: FakeEntity;
  projectile?: FakeEntity;
}

export interface FakeHurtEvent {
  cancel: boolean;
  damage: number;
  readonly hurtEntity: FakeEntity;
  readonly damageSource: { cause: string; damagingEntity?: FakeEntity; damagingProjectile?: FakeEntity };
}

export function makeHurtEvent(spec: HurtSpec): FakeHurtEvent {
  return {
    cancel: false,
    damage: spec.damage,
    hurtEntity: spec.victim,
    damageSource: {
      cause: spec.cause ?? EntityDamageCause.entityAttack,
      ...(spec.attacker ? { damagingEntity: spec.attacker } : {}),
      ...(spec.projectile ? { damagingProjectile: spec.projectile } : {}),
    },
  };
}

export { GameMode };
