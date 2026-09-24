/**
 * Fake `@minecraft/server` for vitest (aliased in vitest.config.ts). The real npm package ships
 * type declarations only, so adapters are type-checked against the real 2.10.0 typings while tests
 * run against this module.
 *
 * Usage in tests:
 *   - Adapter code imports "@minecraft/server" as usual → resolves here at runtime.
 *   - Tests import fake-only helpers from "../fakes/minecraft-server" (same module instance):
 *       resetFakes()             reset world/system/signals/fixtures (call in beforeEach)
 *       world.afterEvents.X.emit(ev) / world.beforeEvents.X.emit(ev) / system.beforeEvents.startup.emit(ev)
 *       system.flushRuns()       run queued system.run callbacks
 *       system.tickIntervals(n)  invoke every live runInterval callback n times
 *       world.messages           world.sendMessage log;  world.players (getAllPlayers source)
 *   - Classes: FakeItemStack (exported also as ItemStack), FakeEnchantable, FakeContainer,
 *     FakeEquippable, FakeEntity, FakePlayer, FakeTypeFamily, FakeCustomCommandRegistry.
 *   - Cast a fake to the real type with `asReal<Player>(fake)` (see builders.ts helpers).
 */
import type * as mc from "@minecraft/server";

// ───────────────────────────── enums (string values match 2.10.0) ─────────────────────────────

export enum EquipmentSlot {
  Chest = "Chest",
  Feet = "Feet",
  Head = "Head",
  Legs = "Legs",
  Mainhand = "Mainhand",
  Offhand = "Offhand",
}

export enum GameMode {
  Adventure = "Adventure",
  Creative = "Creative",
  Spectator = "Spectator",
  Survival = "Survival",
}

export enum EntityComponentTypes {
  Equippable = "minecraft:equippable",
  Health = "minecraft:health",
  Inventory = "minecraft:inventory",
  Projectile = "minecraft:projectile",
  TypeFamily = "minecraft:type_family",
}

export enum ItemComponentTypes {
  Book = "minecraft:book",
  Durability = "minecraft:durability",
  Enchantable = "minecraft:enchantable",
}

export enum CommandPermissionLevel {
  Any = 0,
  GameDirectors = 1,
  Admin = 2,
  Host = 3,
  Owner = 4,
}

export enum CustomCommandStatus {
  Success = 0,
  Failure = 1,
}

export enum CustomCommandParamType {
  BlockType = "BlockType",
  Boolean = "Boolean",
  EntitySelector = "EntitySelector",
  EntityType = "EntityType",
  Enum = "Enum",
  Float = "Float",
  Integer = "Integer",
  ItemType = "ItemType",
  Location = "Location",
  PlayerSelector = "PlayerSelector",
  String = "String",
}

export enum CustomCommandSource {
  Block = "Block",
  Entity = "Entity",
  NPCDialogue = "NPCDialogue",
  Server = "Server",
}

export enum EntityDamageCause {
  anvil = "anvil",
  blockExplosion = "blockExplosion",
  campfire = "campfire",
  charging = "charging",
  contact = "contact",
  drowning = "drowning",
  entityAttack = "entityAttack",
  entityExplosion = "entityExplosion",
  fall = "fall",
  fallingBlock = "fallingBlock",
  fire = "fire",
  fireTick = "fireTick",
  fireworks = "fireworks",
  flyIntoWall = "flyIntoWall",
  freezing = "freezing",
  lava = "lava",
  lightning = "lightning",
  maceSmash = "maceSmash",
  magic = "magic",
  magma = "magma",
  none = "none",
  override = "override",
  piston = "piston",
  projectile = "projectile",
  ramAttack = "ramAttack",
  selfDestruct = "selfDestruct",
  sonicBoom = "sonicBoom",
  soulCampfire = "soulCampfire",
  stalactite = "stalactite",
  stalagmite = "stalagmite",
  starve = "starve",
  suffocation = "suffocation",
  temperature = "temperature",
  thorns = "thorns",
  wither = "wither",
}

// ───────────────────────────── errors ─────────────────────────────

export class EnchantmentLevelOutOfBoundsError extends Error {
  override name = "EnchantmentLevelOutOfBoundsError";
}
export class EnchantmentTypeNotCompatibleError extends Error {
  override name = "EnchantmentTypeNotCompatibleError";
}
export class EnchantmentTypeUnknownIdError extends Error {
  override name = "EnchantmentTypeUnknownIdError";
}
export class InvalidContainerSlotError extends Error {
  override name = "InvalidContainerSlotError";
}

// ───────────────────────────── helpers ─────────────────────────────

/** Cast a fake object to the real `@minecraft/server` type it stands in for. */
export function asReal<T>(fake: unknown): T {
  return fake as T;
}

function ns(id: string): string {
  return id.includes(":") ? id : `minecraft:${id}`;
}

// ───────────────────────────── execution privileges ─────────────────────────────

/**
 * Simulated script execution privilege (see `@privilege` tags in the 2.10.0 typings):
 *   - "early":      top-level module evaluation and system.beforeEvents.startup. Only APIs tagged
 *                   `early-execution-allowed` may be called; world reads/writes throw.
 *   - "restricted": before-event callbacks (world.beforeEvents.*) and custom-command callbacks.
 *                   APIs tagged `no-restricted-execution` throw.
 * The fake enforces this for the APIs listed below; test/integration/fake-fidelity.test.ts checks
 * the lists against the real index.d.ts.
 */
export type ExecMode = "normal" | "early" | "restricted";
let execMode: ExecMode = "normal";

export class FakePrivilegeError extends Error {
  override name = "FakePrivilegeError";
}

/** Members tagged `@privilege no-restricted-execution` in 2.10.0 that the fake enforces. */
export const NO_RESTRICTED_APIS: ReadonlySet<string> = new Set([
  "Container.setItem",
  "EntityEquippableComponent.setEquipment",
  "ItemStack.setLore",
  "ItemEnchantableComponent.addEnchantment",
  "ItemEnchantableComponent.addEnchantments",
  "ItemEnchantableComponent.removeEnchantment",
  "ItemEnchantableComponent.removeAllEnchantments",
  "Entity.addEffect",
  "Entity.removeEffect",
  "Entity.applyDamage",
  "Player.playSound",
  "Player.setGameMode",
  "ScreenDisplay.setActionBar",
  "ScreenDisplay.setTitle",
  "CustomCommandRegistry.registerCommand",
  "CustomCommandRegistry.registerEnum",
  "PlayerBreakBlockAfterEventSignal.subscribe",
  "EntityHurtBeforeEventSignal.subscribe",
]);

/** Members that are NOT `early-execution-allowed` in 2.10.0 and that the fake rejects in early mode. */
export const EARLY_FORBIDDEN_APIS: ReadonlySet<string> = new Set([
  "World.getDynamicProperty",
  "World.setDynamicProperty",
  "World.getAllPlayers",
  "World.sendMessage",
  "EnchantmentTypes.getAll",
  "EnchantmentTypes.get",
]);

/** Runs `fn` with the given simulated privilege, restoring the previous one afterwards. */
export function _withExecMode<T>(mode: ExecMode, fn: () => T): T {
  const prev = execMode;
  execMode = mode;
  try {
    return fn();
  } finally {
    execMode = prev;
  }
}

/** Sets the simulated privilege until changed again (for async module evaluation). */
export function _setExecMode(mode: ExecMode): void {
  execMode = mode;
}

export function _execMode(): ExecMode {
  return execMode;
}

function guard(api: string): void {
  if (execMode === "restricted" && NO_RESTRICTED_APIS.has(api)) {
    throw new FakePrivilegeError(
      `Native function [${api}] does not have required privileges.`,
    );
  }
  if (execMode === "early" && EARLY_FORBIDDEN_APIS.has(api)) {
    throw new FakePrivilegeError(
      `Native function [${api}] cannot be used during early execution.`,
    );
  }
}

// ───────────────────────────── signals ─────────────────────────────

export class FakeSignal<T> {
  readonly listeners: Array<(ev: T) => void> = [];

  /** `mode`: the privilege the engine runs callbacks with (before-events: restricted; startup: early). */
  constructor(readonly mode: ExecMode = "normal") {}

  subscribe<F extends (ev: T) => void>(cb: F): F {
    if (execMode === "restricted")
      throw new FakePrivilegeError(
        "subscribe() does not have required privileges.",
      );
    this.listeners.push(cb);
    return cb;
  }

  unsubscribe(cb: (ev: T) => void): void {
    if (execMode === "restricted")
      throw new FakePrivilegeError(
        "unsubscribe() does not have required privileges.",
      );
    const i = this.listeners.indexOf(cb);
    if (i >= 0) this.listeners.splice(i, 1);
  }

  /** Test helper: deliver an event to every subscriber with the signal's privilege (exceptions propagate). */
  emit(ev: T): void {
    _withExecMode(this.mode, () => {
      for (const cb of [...this.listeners]) cb(ev);
    });
  }

  get count(): number {
    return this.listeners.length;
  }

  clear(): void {
    this.listeners.length = 0;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Every real signal name is a typed property (not index access), so tests need no `!`. */
type RealSignalNames =
  | keyof mc.WorldAfterEvents
  | keyof mc.WorldBeforeEvents
  | keyof mc.SystemAfterEvents
  | keyof mc.SystemBeforeEvents;
type KnownSignals = { [K in RealSignalNames]: FakeSignal<any> };
/** Lazily creates a FakeSignal for any property name (world.afterEvents.anything). */
type SignalBag = KnownSignals &
  Record<string, FakeSignal<any>> & {
    _all(): Map<string, FakeSignal<unknown>>;
  };
/* eslint-enable @typescript-eslint/no-explicit-any */

function signalBag(
  modeOf: (name: string) => ExecMode = () => "normal",
): SignalBag {
  const map = new Map<string, FakeSignal<unknown>>();
  return new Proxy({} as SignalBag, {
    get(_t, prop) {
      if (prop === "_all") return () => map;
      if (typeof prop !== "string") return undefined;
      let s = map.get(prop);
      if (!s) {
        s = new FakeSignal<unknown>(modeOf(prop));
        map.set(prop, s);
      }
      return s;
    },
  });
}

// ───────────────────────────── enchantment types ─────────────────────────────

/** Bedrock vanilla enchantments (42) with their max levels. */
export const VANILLA_ENCHANT_MAX: Readonly<Record<string, number>> = {
  "minecraft:aqua_affinity": 1,
  "minecraft:bane_of_arthropods": 5,
  "minecraft:binding": 1,
  "minecraft:blast_protection": 4,
  "minecraft:breach": 4,
  "minecraft:channeling": 1,
  "minecraft:density": 5,
  "minecraft:depth_strider": 3,
  "minecraft:efficiency": 5,
  "minecraft:feather_falling": 4,
  "minecraft:fire_aspect": 2,
  "minecraft:fire_protection": 4,
  "minecraft:flame": 1,
  "minecraft:fortune": 3,
  "minecraft:frost_walker": 2,
  "minecraft:impaling": 5,
  "minecraft:infinity": 1,
  "minecraft:knockback": 2,
  "minecraft:looting": 3,
  "minecraft:loyalty": 3,
  "minecraft:luck_of_the_sea": 3,
  "minecraft:lunge": 3,
  "minecraft:lure": 3,
  "minecraft:mending": 1,
  "minecraft:multishot": 1,
  "minecraft:piercing": 4,
  "minecraft:power": 5,
  "minecraft:projectile_protection": 4,
  "minecraft:protection": 4,
  "minecraft:punch": 2,
  "minecraft:quick_charge": 3,
  "minecraft:respiration": 3,
  "minecraft:riptide": 3,
  "minecraft:sharpness": 5,
  "minecraft:silk_touch": 1,
  "minecraft:smite": 5,
  "minecraft:soul_speed": 3,
  "minecraft:swift_sneak": 3,
  "minecraft:thorns": 3,
  "minecraft:unbreaking": 3,
  "minecraft:vanishing": 1,
  "minecraft:wind_burst": 3,
};

let enchantFixture = new Map<string, number>(
  Object.entries(VANILLA_ENCHANT_MAX),
);
const enchantTypeCache = new Map<string, EnchantmentType>();

export class EnchantmentType {
  readonly id: string;
  readonly maxLevel: number;
  constructor(enchantmentType: string, maxLevel?: number) {
    const id = ns(enchantmentType);
    const max = maxLevel ?? enchantFixture.get(id);
    if (max === undefined)
      throw new EnchantmentTypeUnknownIdError(
        `Unknown enchantment ${enchantmentType}`,
      );
    this.id = id;
    this.maxLevel = max;
  }
}

export class EnchantmentTypes {
  static get(enchantmentId: string): EnchantmentType | undefined {
    guard("EnchantmentTypes.get");
    const id = ns(enchantmentId);
    const max = enchantFixture.get(id);
    if (max === undefined) return undefined;
    let t = enchantTypeCache.get(id);
    if (!t || t.maxLevel !== max) {
      t = new EnchantmentType(id, max);
      enchantTypeCache.set(id, t);
    }
    return t;
  }

  static getAll(): EnchantmentType[] {
    guard("EnchantmentTypes.getAll");
    return [...enchantFixture.keys()].map(
      (id) => EnchantmentTypes.get(id) as EnchantmentType,
    );
  }
}

/** Test helper: replace the enchantment registry (id → maxLevel). */
export function _setEnchantFixture(entries: Record<string, number>): void {
  enchantFixture = new Map(Object.entries(entries).map(([k, v]) => [ns(k), v]));
  enchantTypeCache.clear();
}

interface EnchantmentLike {
  type: { id: string; maxLevel: number };
  level: number;
}

function typeIdOf(t: EnchantmentType | { id: string } | string): string {
  return ns(typeof t === "string" ? t : t.id);
}

// ───────────────────────────── items ─────────────────────────────

export interface FakeEnchantableOptions {
  /** Ids this item accepts; "all" accepts every registered enchantment. Default "all". */
  compatible?: Iterable<string> | "all";
  /** Mutually exclusive pairs (e.g. sharpness/smite). */
  conflicts?: ReadonlyArray<readonly [string, string]>;
}

/**
 * Mirrors ItemEnchantableComponent semantics: addEnchantment throws LevelOutOfBounds when level is
 * outside [1, maxLevel], NotCompatible for incompatible/conflicting ids, UnknownId for unknown ids,
 * and replaces the level when the enchant is already present. canAddEnchantment returns false for
 * incompatibility and throws on out-of-bounds.
 */
export class FakeEnchantable {
  readonly typeId = "minecraft:enchantable";
  readonly slots: string[] = [];
  readonly compatible: ReadonlySet<string> | "all";
  readonly conflicts: ReadonlyArray<readonly [string, string]>;
  readonly levels = new Map<string, number>();

  constructor(opts: FakeEnchantableOptions = {}) {
    const c = opts.compatible ?? "all";
    this.compatible = c === "all" ? "all" : new Set([...c].map(ns));
    this.conflicts = (opts.conflicts ?? []).map(
      ([a, b]) => [ns(a), ns(b)] as const,
    );
  }

  get isValid(): boolean {
    return true;
  }

  private accepts(id: string): boolean {
    if (this.compatible !== "all" && !this.compatible.has(id)) return false;
    for (const [a, b] of this.conflicts) {
      if (a === id && this.levels.has(b)) return false;
      if (b === id && this.levels.has(a)) return false;
    }
    return true;
  }

  private check(e: EnchantmentLike): string {
    const id = typeIdOf(e.type);
    const t = EnchantmentTypes.get(id);
    if (!t)
      throw new EnchantmentTypeUnknownIdError(`Unknown enchantment ${id}`);
    if (!Number.isInteger(e.level) || e.level < 1 || e.level > t.maxLevel) {
      throw new EnchantmentLevelOutOfBoundsError(
        `${id} level ${e.level} out of bounds [1, ${t.maxLevel}]`,
      );
    }
    return id;
  }

  addEnchantment(enchantment: EnchantmentLike): void {
    guard("ItemEnchantableComponent.addEnchantment");
    const id = this.check(enchantment);
    if (!this.accepts(id))
      throw new EnchantmentTypeNotCompatibleError(`${id} not compatible`);
    this.levels.set(id, enchantment.level);
  }

  addEnchantments(enchantments: EnchantmentLike[]): void {
    guard("ItemEnchantableComponent.addEnchantments");
    for (const e of enchantments) this.addEnchantment(e);
  }

  canAddEnchantment(enchantment: EnchantmentLike): boolean {
    const id = this.check(enchantment);
    return this.accepts(id);
  }

  getEnchantment(
    enchantmentType: EnchantmentType | string,
  ): { type: EnchantmentType; level: number } | undefined {
    const id = typeIdOf(enchantmentType);
    const level = this.levels.get(id);
    const type = EnchantmentTypes.get(id);
    if (level === undefined || !type) return undefined;
    return { type, level };
  }

  getEnchantments(): Array<{ type: EnchantmentType; level: number }> {
    return [...this.levels.keys()]
      .map((id) => this.getEnchantment(id))
      .filter((e) => e !== undefined);
  }

  hasEnchantment(enchantmentType: EnchantmentType | string): boolean {
    return this.levels.has(typeIdOf(enchantmentType));
  }

  removeEnchantment(enchantmentType: EnchantmentType | string): void {
    guard("ItemEnchantableComponent.removeEnchantment");
    this.levels.delete(typeIdOf(enchantmentType));
  }

  removeAllEnchantments(): void {
    guard("ItemEnchantableComponent.removeAllEnchantments");
    this.levels.clear();
  }

  /** Test helper: set a level directly, bypassing validation. */
  _set(id: string, level: number): this {
    this.levels.set(ns(id), level);
    return this;
  }

  clone(): FakeEnchantable {
    const c = new FakeEnchantable({
      compatible: this.compatible === "all" ? "all" : [...this.compatible],
      conflicts: this.conflicts,
    });
    for (const [k, v] of this.levels) c.levels.set(k, v);
    return c;
  }
}

const NON_STACKABLE_RE =
  /(_sword|_pickaxe|_axe|_shovel|_hoe|_spear|_helmet|_chestplate|_leggings|_boots|^minecraft:(bow|crossbow|trident|shield|mace|elytra|fishing_rod|shears|flint_and_steel|enchanted_book|brush|carrot_on_a_stick|warped_fungus_on_a_stick|turtle_helmet))$/;
const SIXTEEN_RE =
  /^minecraft:(ender_pearl|snowball|egg|bucket|sign|honey_bottle)$/;

export function defaultMaxAmount(typeId: string): number {
  const id = ns(typeId);
  if (NON_STACKABLE_RE.test(id)) return 1;
  if (SIXTEEN_RE.test(id)) return 16;
  return 64;
}

export interface FakeItemOptions {
  maxAmount?: number;
  nameTag?: string;
  localizationKey?: string;
  lore?: string[];
  enchantable?: FakeEnchantable;
  tags?: string[];
}

export const LORE_LIMIT_LINES = 20;
export const LORE_LIMIT_CHARS = 50;

export class FakeItemStack {
  readonly typeId: string;
  readonly maxAmount: number;
  readonly localizationKey: string;
  amount: number;
  nameTag?: string;
  keepOnDeath = false;
  lockMode = "none";
  readonly weight = 1;
  enchantable: FakeEnchantable | undefined;
  lore: string[] = [];
  readonly props = new Map<string, boolean | number | string | object>();
  readonly tags: string[];
  /** Extra components by id (besides minecraft:enchantable). */
  readonly components = new Map<string, unknown>();

  constructor(
    itemType: string | { id: string },
    amount = 1,
    opts: FakeItemOptions = {},
  ) {
    this.typeId = ns(typeof itemType === "string" ? itemType : itemType.id);
    this.maxAmount = opts.maxAmount ?? defaultMaxAmount(this.typeId);
    if (amount < 1 || amount > 255) throw new RangeError(`amount ${amount}`);
    this.amount = amount;
    this.localizationKey =
      opts.localizationKey ??
      `item.${this.typeId.slice(this.typeId.indexOf(":") + 1)}.name`;
    if (opts.nameTag !== undefined) this.nameTag = opts.nameTag;
    if (opts.lore) this.lore = [...opts.lore];
    this.enchantable = opts.enchantable;
    this.tags = [...(opts.tags ?? [])];
  }

  get isStackable(): boolean {
    return this.maxAmount > 1;
  }

  get type(): { id: string } {
    return { id: this.typeId };
  }

  getComponent(componentId: string): unknown {
    const id = ns(componentId);
    if (id === ItemComponentTypes.Enchantable) return this.enchantable;
    return this.components.get(id);
  }

  hasComponent(componentId: string): boolean {
    return this.getComponent(componentId) !== undefined;
  }

  getComponents(): unknown[] {
    return [
      ...(this.enchantable ? [this.enchantable] : []),
      ...this.components.values(),
    ];
  }

  getTags(): string[] {
    return [...this.tags];
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag);
  }

  getLore(): string[] {
    return [...this.lore];
  }

  getRawLore(): Array<{ text: string }> {
    return this.lore.map((text) => ({ text }));
  }

  /** Enforces the 20 lines × 50 chars limit like the engine (throws on violation). */
  setLore(loreList?: Array<string | object>): void {
    guard("ItemStack.setLore");
    const list = loreList ?? [];
    if (list.length > LORE_LIMIT_LINES)
      throw new Error(
        `Lore has ${list.length} lines (max ${LORE_LIMIT_LINES})`,
      );
    for (const line of list) {
      if (typeof line !== "string")
        throw new TypeError("FakeItemStack.setLore only supports strings");
      if (line.length > LORE_LIMIT_CHARS)
        throw new Error(
          `Lore line too long (${line.length} > ${LORE_LIMIT_CHARS})`,
        );
    }
    this.lore = [...(list as string[])];
  }

  private assertPropsAllowed(): void {
    if (this.isStackable)
      throw new Error(
        `Dynamic properties are not supported on stackable item ${this.typeId}`,
      );
  }

  getDynamicProperty(
    identifier: string,
  ): boolean | number | string | undefined {
    this.assertPropsAllowed();
    return this.props.get(identifier) as boolean | number | string | undefined;
  }

  setDynamicProperty(
    identifier: string,
    value?: boolean | number | string | object,
  ): void {
    this.assertPropsAllowed();
    if (value === undefined) this.props.delete(identifier);
    else this.props.set(identifier, value);
  }

  getDynamicPropertyIds(): string[] {
    this.assertPropsAllowed();
    return [...this.props.keys()];
  }

  clearDynamicProperties(): void {
    this.props.clear();
  }

  getDynamicPropertyTotalByteCount(): number {
    let n = 0;
    for (const [k, v] of this.props) n += k.length + JSON.stringify(v).length;
    return n;
  }

  isStackableWith(other: FakeItemStack): boolean {
    return (
      this.isStackable &&
      other.typeId === this.typeId &&
      other.nameTag === this.nameTag &&
      JSON.stringify(other.lore) === JSON.stringify(this.lore)
    );
  }

  matches(itemName: string): boolean {
    return ns(itemName) === this.typeId;
  }

  clone(): FakeItemStack {
    const c = new FakeItemStack(this.typeId, this.amount, {
      maxAmount: this.maxAmount,
      localizationKey: this.localizationKey,
      lore: this.lore,
      tags: this.tags,
      ...(this.enchantable ? { enchantable: this.enchantable.clone() } : {}),
      ...(this.nameTag !== undefined ? { nameTag: this.nameTag } : {}),
    });
    c.keepOnDeath = this.keepOnDeath;
    c.lockMode = this.lockMode;
    for (const [k, v] of this.props) c.props.set(k, v);
    for (const [k, v] of this.components) c.components.set(k, v);
    return c;
  }
}

export { FakeItemStack as ItemStack };

// ───────────────────────────── containers / equipment ─────────────────────────────

/** Items are copied in and out, like the engine: forgetting write-back loses changes. */
export class FakeContainer {
  readonly slots: Array<FakeItemStack | undefined>;
  readonly writes: Array<{ slot: number; item: FakeItemStack | undefined }> =
    [];

  constructor(readonly size = 36) {
    this.slots = new Array<FakeItemStack | undefined>(size).fill(undefined);
  }

  get isValid(): boolean {
    return true;
  }

  get emptySlotsCount(): number {
    return this.slots.filter((s) => s === undefined).length;
  }

  private check(slot: number): void {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.size)
      throw new InvalidContainerSlotError(`slot ${slot}`);
  }

  getItem(slot: number): FakeItemStack | undefined {
    this.check(slot);
    return this.slots[slot]?.clone();
  }

  setItem(slot: number, itemStack?: FakeItemStack): void {
    guard("Container.setItem");
    this.check(slot);
    this.writes.push({ slot, item: itemStack });
    this.slots[slot] = itemStack?.clone();
  }

  /** Test helper: the stored item itself (no copy). */
  peek(slot: number): FakeItemStack | undefined {
    return this.slots[slot];
  }
}

export class FakeInventoryComponent {
  readonly typeId = EntityComponentTypes.Inventory;
  constructor(readonly container: FakeContainer) {}
}

export class FakeEquippable {
  readonly typeId = EntityComponentTypes.Equippable;
  readonly items = new Map<EquipmentSlot, FakeItemStack | undefined>();
  readonly writes: Array<{
    slot: EquipmentSlot;
    item: FakeItemStack | undefined;
  }> = [];
  /** When true, setEquipment returns false and stores nothing. */
  rejectWrites = false;

  /** mainhand: optional accessor pair so Mainhand maps onto the selected hotbar slot. */
  constructor(
    private readonly mainhand?: {
      get(): FakeItemStack | undefined;
      set(item: FakeItemStack | undefined): void;
    },
  ) {}

  get isValid(): boolean {
    return true;
  }

  getEquipment(slot: EquipmentSlot): FakeItemStack | undefined {
    if (slot === EquipmentSlot.Mainhand && this.mainhand)
      return this.mainhand.get();
    return this.items.get(slot)?.clone();
  }

  setEquipment(slot: EquipmentSlot, itemStack?: FakeItemStack): boolean {
    guard("EntityEquippableComponent.setEquipment");
    this.writes.push({ slot, item: itemStack });
    if (this.rejectWrites) return false;
    if (slot === EquipmentSlot.Mainhand && this.mainhand) {
      this.mainhand.set(itemStack);
      return true;
    }
    this.items.set(slot, itemStack?.clone());
    return true;
  }

  /** Test helper: the stored item itself (no copy). */
  peek(slot: EquipmentSlot): FakeItemStack | undefined {
    if (slot === EquipmentSlot.Mainhand && this.mainhand)
      return this.mainhand.get();
    return this.items.get(slot);
  }
}

export class FakeTypeFamily {
  readonly typeId = EntityComponentTypes.TypeFamily;
  constructor(readonly families: readonly string[]) {}
  getTypeFamilies(): string[] {
    return [...this.families];
  }
  hasTypeFamily(typeFamily: string): boolean {
    return this.families.includes(typeFamily);
  }
}

// ───────────────────────────── entities ─────────────────────────────

export interface FakeEffect {
  readonly typeId: string;
  readonly amplifier: number;
  readonly duration: number;
  readonly showParticles: boolean;
  readonly isValid: boolean;
  readonly displayName: string;
}

let nextEntityId = 1;

export class FakeEntity {
  readonly id: string;
  readonly typeId: string;
  readonly components = new Map<string, unknown>();
  readonly props = new Map<string, boolean | number | string | object>();
  readonly effects = new Map<string, FakeEffect>();
  readonly addedEffects: Array<{
    id: string;
    duration: number;
    options: unknown;
  }> = [];
  readonly damageLog: Array<{ amount: number; options: unknown }> = [];
  isValid = true;
  location = { x: 0, y: 64, z: 0 };

  constructor(typeId: string, opts: { families?: readonly string[] } = {}) {
    this.id = String(nextEntityId++);
    this.typeId = ns(typeId);
    if (opts.families)
      this.components.set(
        EntityComponentTypes.TypeFamily,
        new FakeTypeFamily(opts.families),
      );
  }

  getComponent(componentId: string): unknown {
    return this.components.get(ns(componentId));
  }

  hasComponent(componentId: string): boolean {
    return this.components.has(ns(componentId));
  }

  getDynamicProperty(
    identifier: string,
  ): boolean | number | string | undefined {
    return this.props.get(identifier) as boolean | number | string | undefined;
  }

  setDynamicProperty(
    identifier: string,
    value?: boolean | number | string | object,
  ): void {
    if (value === undefined) this.props.delete(identifier);
    else this.props.set(identifier, value);
  }

  getEffect(
    effectType: string | { getName(): string },
  ): FakeEffect | undefined {
    const id = ns(
      typeof effectType === "string" ? effectType : effectType.getName(),
    );
    return this.effects.get(id);
  }

  getEffects(): FakeEffect[] {
    return [...this.effects.values()];
  }

  addEffect(
    effectType: string | { getName(): string },
    duration: number,
    options?: { amplifier?: number; showParticles?: boolean },
  ): FakeEffect | undefined {
    guard("Entity.addEffect");
    const id = ns(
      typeof effectType === "string" ? effectType : effectType.getName(),
    );
    this.addedEffects.push({ id, duration, options });
    const effect: FakeEffect = {
      typeId: id,
      amplifier: options?.amplifier ?? 0,
      duration,
      showParticles: options?.showParticles ?? true,
      isValid: true,
      displayName: id,
    };
    this.effects.set(id, effect);
    return effect;
  }

  removeEffect(effectType: string): boolean {
    guard("Entity.removeEffect");
    return this.effects.delete(ns(effectType));
  }

  applyDamage(amount: number, options?: unknown): boolean {
    guard("Entity.applyDamage");
    this.damageLog.push({ amount, options });
    return true;
  }
}

export class FakeScreenDisplay {
  readonly actionBars: unknown[] = [];
  readonly titles: unknown[] = [];
  readonly isValid = true;
  setActionBar(text: unknown): void {
    guard("ScreenDisplay.setActionBar");
    this.actionBars.push(text);
  }
  setTitle(title: unknown): void {
    guard("ScreenDisplay.setTitle");
    this.titles.push(title);
  }
}

export class FakePlayer extends FakeEntity {
  readonly name: string;
  gameMode: GameMode = GameMode.Survival;
  selectedSlotIndex = 0;
  readonly container: FakeContainer;
  readonly equippable: FakeEquippable;
  readonly onScreenDisplay = new FakeScreenDisplay();
  readonly sounds: Array<{ soundId: string; options: unknown }> = [];
  readonly messages: unknown[] = [];

  constructor(name = "Steve", inventorySize = 36) {
    super("minecraft:player", { families: ["player", "mob"] });
    this.name = name;
    this.container = new FakeContainer(inventorySize);
    this.equippable = new FakeEquippable({
      get: () => this.container.getItem(this.selectedSlotIndex),
      set: (item) => this.container.setItem(this.selectedSlotIndex, item),
    });
    this.components.set(
      EntityComponentTypes.Inventory,
      new FakeInventoryComponent(this.container),
    );
    this.components.set(EntityComponentTypes.Equippable, this.equippable);
  }

  getGameMode(): GameMode {
    return this.gameMode;
  }

  setGameMode(gameMode?: GameMode): void {
    guard("Player.setGameMode");
    this.gameMode = gameMode ?? GameMode.Survival;
  }

  playSound(soundId: string, soundOptions?: unknown): void {
    guard("Player.playSound");
    this.sounds.push({ soundId, options: soundOptions });
  }

  sendMessage(message: unknown): void {
    this.messages.push(message);
  }
}

// ───────────────────────────── custom commands ─────────────────────────────

export type FakeCommandCallback = (
  origin: unknown,
  ...args: unknown[]
) => unknown;

export class FakeCustomCommandRegistry {
  readonly enums = new Map<string, string[]>();
  readonly commands = new Map<
    string,
    { command: mc.CustomCommand; callback: FakeCommandCallback }
  >();

  registerEnum(name: string, values: string[]): void {
    guard("CustomCommandRegistry.registerEnum");
    if (this.enums.has(name))
      throw new Error(`Enum ${name} already registered`);
    this.enums.set(name, [...values]);
  }

  registerCommand(
    customCommand: mc.CustomCommand,
    callback: FakeCommandCallback,
  ): void {
    guard("CustomCommandRegistry.registerCommand");
    if (!customCommand.name.includes(":"))
      throw new Error("Custom command names must be namespaced");
    if (this.commands.has(customCommand.name))
      throw new Error(`Command ${customCommand.name} already registered`);
    // The engine resolves an Enum parameter by its name, so the enum must already be registered.
    for (const param of [
      ...(customCommand.mandatoryParameters ?? []),
      ...(customCommand.optionalParameters ?? []),
    ]) {
      if (
        param.type === CustomCommandParamType.Enum &&
        !this.enums.has(param.name)
      ) {
        throw new Error(`Enum parameter ${param.name} has no registered enum`);
      }
    }
    this.commands.set(customCommand.name, { command: customCommand, callback });
  }

  /** Test helper: invoke a registered command (callbacks run in restricted execution, like the engine). */
  invoke(name: string, origin: unknown, ...args: unknown[]): unknown {
    const entry = this.commands.get(name);
    if (!entry) throw new Error(`No command ${name}`);
    return _withExecMode("restricted", () => entry.callback(origin, ...args));
  }
}

// ───────────────────────────── world / system ─────────────────────────────

const restrictedSignals = (): ExecMode => "restricted";
const systemBeforeMode = (name: string): ExecMode =>
  name === "startup" ? "early" : "restricted";

class FakeWorld {
  afterEvents: SignalBag = signalBag();
  beforeEvents: SignalBag = signalBag(restrictedSignals);
  readonly props = new Map<string, boolean | number | string | object>();
  readonly messages: unknown[] = [];
  players: FakePlayer[] = [];

  getDynamicProperty(
    identifier: string,
  ): boolean | number | string | undefined {
    guard("World.getDynamicProperty");
    return this.props.get(identifier) as boolean | number | string | undefined;
  }

  setDynamicProperty(
    identifier: string,
    value?: boolean | number | string | object,
  ): void {
    guard("World.setDynamicProperty");
    if (value === undefined) this.props.delete(identifier);
    else this.props.set(identifier, value);
  }

  getDynamicPropertyIds(): string[] {
    return [...this.props.keys()];
  }

  getAllPlayers(): FakePlayer[] {
    guard("World.getAllPlayers");
    return [...this.players];
  }

  getPlayers(): FakePlayer[] {
    return [...this.players];
  }

  sendMessage(message: unknown): void {
    guard("World.sendMessage");
    this.messages.push(message);
  }

  _reset(): void {
    this.afterEvents = signalBag();
    this.beforeEvents = signalBag(restrictedSignals);
    this.props.clear();
    this.messages.length = 0;
    this.players = [];
  }
}

interface IntervalEntry {
  id: number;
  fn: () => void;
  ticks: number;
}

class FakeSystem {
  beforeEvents: SignalBag = signalBag(systemBeforeMode);
  afterEvents: SignalBag = signalBag();
  currentTick = 0;
  private nextId = 1;
  readonly runQueue: Array<{ id: number; fn: () => void }> = [];
  readonly intervals: IntervalEntry[] = [];
  readonly timeouts: Array<{ id: number; fn: () => void; ticks: number }> = [];

  run(callback: () => void): number {
    const id = this.nextId++;
    this.runQueue.push({ id, fn: callback });
    return id;
  }

  runTimeout(callback: () => void, tickDelay = 1): number {
    const id = this.nextId++;
    this.timeouts.push({ id, fn: callback, ticks: tickDelay });
    return id;
  }

  runInterval(callback: () => void, tickInterval = 1): number {
    const id = this.nextId++;
    this.intervals.push({ id, fn: callback, ticks: tickInterval });
    return id;
  }

  clearRun(runId: number): void {
    for (const list of [this.runQueue, this.intervals, this.timeouts] as Array<
      Array<{ id: number }>
    >) {
      const i = list.findIndex((e) => e.id === runId);
      if (i >= 0) list.splice(i, 1);
    }
  }

  /** Test helper: run queued system.run callbacks (including ones queued while flushing). */
  flushRuns(): void {
    let guard = 0;
    while (this.runQueue.length > 0) {
      if (++guard > 10_000)
        throw new Error("flushRuns: runaway system.run loop");
      const next = this.runQueue.shift();
      next?.fn();
    }
  }

  /** Test helper: invoke every live interval callback `times` times. */
  tickIntervals(times = 1): void {
    for (let t = 0; t < times; t++) {
      for (const e of [...this.intervals]) e.fn();
      this.currentTick += 1;
    }
  }

  _reset(): void {
    this.beforeEvents = signalBag(systemBeforeMode);
    this.afterEvents = signalBag();
    this.currentTick = 0;
    this.runQueue.length = 0;
    this.intervals.length = 0;
    this.timeouts.length = 0;
  }
}

export const world = new FakeWorld();
export const system = new FakeSystem();

/** Reset all fake global state (call in beforeEach). */
export function resetFakes(): void {
  execMode = "normal";
  world._reset();
  system._reset();
  _setEnchantFixture(VANILLA_ENCHANT_MAX);
}
