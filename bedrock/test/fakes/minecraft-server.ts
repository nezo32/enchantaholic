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
 *       system.advance(n)        simulate n game ticks (runs, timeouts, intervals by period; currentTick++)
 *       world.getDimension(id)   FakeDimension with a sparse block map, entity list and call logs
 *       world.messages           world.sendMessage log (world.texts / player.texts: rendered in English, see lang.ts);
 *                                world.players (getAllPlayers source)
 *       item.rawLore / item.lore stored lore lines / the same rendered in English (item.loreRu: Russian)
 *   - Classes: FakeItemStack (exported also as ItemStack), FakeEnchantable, FakeContainer,
 *     FakeEquippable, FakeEntity, FakePlayer, FakeTypeFamily, FakeCustomCommandRegistry, FakeDimension,
 *     FakeBlock, FakeProjectileComponent, FakeItemEntityComponent, FakeDurability.
 *   - Cast a fake to the real type with `asReal<Player>(fake)` (see builders.ts helpers).
 */
import type * as mc from "@minecraft/server";
import { renderRaw } from "./lang";

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
  Item = "minecraft:item",
  Projectile = "minecraft:projectile",
  TypeFamily = "minecraft:type_family",
}

export enum EntityInitializationCause {
  Born = "Born",
  Event = "Event",
  Loaded = "Loaded",
  Spawned = "Spawned",
  Transformed = "Transformed",
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
/** Thrown by FakePlayer.applyImpulse: the engine does not support impulses on players. */
export class FakeUnsupportedError extends Error {
  override name = "FakeUnsupportedError";
}

// ───────────────────────────── helpers ─────────────────────────────

/** Cast a fake object to the real `@minecraft/server` type it stands in for. */
export function asReal<T>(fake: unknown): T {
  return fake as T;
}

function ns(id: string): string {
  return id.includes(":") ? id : `minecraft:${id}`;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ExplosionOptionsLike {
  breaksBlocks?: boolean;
  causesFire?: boolean;
  allowUnderwater?: boolean;
  source?: unknown;
}

const v3 = (v: Vec3): Vec3 => ({ x: v.x, y: v.y, z: v.z });

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
  "Dimension.runCommand",
  "Dimension.spawnEntity",
  "Dimension.spawnItem",
  "Dimension.spawnParticle",
  "Dimension.playSound",
  "Dimension.createExplosion",
  "Entity.addTag",
  "Entity.applyImpulse",
  "Entity.applyKnockback",
  "Entity.clearVelocity",
  "Entity.teleport",
  "Entity.remove",
  "Entity.kill",
  "EntityProjectileComponent.shoot",
  "Block.setType",
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
    throw new FakePrivilegeError(`Native function [${api}] does not have required privileges.`);
  }
  if (execMode === "early" && EARLY_FORBIDDEN_APIS.has(api)) {
    throw new FakePrivilegeError(`Native function [${api}] cannot be used during early execution.`);
  }
}

// ───────────────────────────── signals ─────────────────────────────

export class FakeSignal<T> {
  readonly listeners: Array<(ev: T) => void> = [];

  /** `mode`: the privilege the engine runs callbacks with (before-events: restricted; startup: early). */
  constructor(readonly mode: ExecMode = "normal") {}

  subscribe<F extends (ev: T) => void>(cb: F): F {
    if (execMode === "restricted") throw new FakePrivilegeError("subscribe() does not have required privileges.");
    this.listeners.push(cb);
    return cb;
  }

  unsubscribe(cb: (ev: T) => void): void {
    if (execMode === "restricted") throw new FakePrivilegeError("unsubscribe() does not have required privileges.");
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
  Record<string, FakeSignal<any>> & { _all(): Map<string, FakeSignal<unknown>> };
/* eslint-enable @typescript-eslint/no-explicit-any */

function signalBag(modeOf: (name: string) => ExecMode = () => "normal"): SignalBag {
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

let enchantFixture = new Map<string, number>(Object.entries(VANILLA_ENCHANT_MAX));
const enchantTypeCache = new Map<string, EnchantmentType>();

export class EnchantmentType {
  readonly id: string;
  readonly maxLevel: number;
  constructor(enchantmentType: string, maxLevel?: number) {
    const id = ns(enchantmentType);
    const max = maxLevel ?? enchantFixture.get(id);
    if (max === undefined) throw new EnchantmentTypeUnknownIdError(`Unknown enchantment ${enchantmentType}`);
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
    return [...enchantFixture.keys()].map((id) => EnchantmentTypes.get(id) as EnchantmentType);
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
    this.conflicts = (opts.conflicts ?? []).map(([a, b]) => [ns(a), ns(b)] as const);
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
    if (!t) throw new EnchantmentTypeUnknownIdError(`Unknown enchantment ${id}`);
    if (!Number.isInteger(e.level) || e.level < 1 || e.level > t.maxLevel) {
      throw new EnchantmentLevelOutOfBoundsError(`${id} level ${e.level} out of bounds [1, ${t.maxLevel}]`);
    }
    return id;
  }

  addEnchantment(enchantment: EnchantmentLike): void {
    guard("ItemEnchantableComponent.addEnchantment");
    const id = this.check(enchantment);
    if (!this.accepts(id)) throw new EnchantmentTypeNotCompatibleError(`${id} not compatible`);
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

  getEnchantment(enchantmentType: EnchantmentType | string): { type: EnchantmentType; level: number } | undefined {
    const id = typeIdOf(enchantmentType);
    const level = this.levels.get(id);
    const type = EnchantmentTypes.get(id);
    if (level === undefined || !type) return undefined;
    return { type, level };
  }

  getEnchantments(): Array<{ type: EnchantmentType; level: number }> {
    return [...this.levels.keys()].map((id) => this.getEnchantment(id)).filter((e) => e !== undefined);
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
const SIXTEEN_RE = /^minecraft:(ender_pearl|snowball|egg|bucket|sign|honey_bottle)$/;

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
  lore?: FakeLoreLine[];
  enchantable?: FakeEnchantable;
  tags?: string[];
}

export const LORE_LIMIT_LINES = 20;
export const LORE_LIMIT_CHARS = 50;

/** A lore line as setLore takes it (string or RawMessage). */
export type FakeLoreLine = string | object;

/** Text parts only (translate dropped): an assumption for what getLore() returns for RawMessage lines. */
function textOnly(line: unknown): string {
  if (typeof line === "string") return line;
  if (typeof line !== "object" || line === null) return "";
  const m = line as { text?: string; rawtext?: unknown[] };
  return (m.text ?? "") + (m.rawtext ?? []).map(textOnly).join("");
}

function isRawMessage(line: unknown): boolean {
  if (typeof line !== "object" || line === null || Array.isArray(line)) return false;
  const keys = Object.keys(line);
  if (keys.length === 0 || !keys.every((k) => ["text", "translate", "with", "rawtext", "score"].includes(k))) return false;
  const m = line as { rawtext?: unknown };
  return m.rawtext === undefined || (Array.isArray(m.rawtext) && m.rawtext.every(isRawMessage));
}

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
  /** Stored lore lines exactly as set (strings and RawMessages). */
  rawLore: FakeLoreLine[] = [];
  readonly props = new Map<string, boolean | number | string | object>();
  readonly tags: string[];
  /** Extra components by id (besides minecraft:enchantable). */
  readonly components = new Map<string, unknown>();

  constructor(itemType: string | { id: string }, amount = 1, opts: FakeItemOptions = {}) {
    this.typeId = ns(typeof itemType === "string" ? itemType : itemType.id);
    this.maxAmount = opts.maxAmount ?? defaultMaxAmount(this.typeId);
    if (amount < 1 || amount > 255) throw new RangeError(`amount ${amount}`);
    this.amount = amount;
    this.localizationKey = opts.localizationKey ?? `item.${this.typeId.slice(this.typeId.indexOf(":") + 1)}.name`;
    if (opts.nameTag !== undefined) this.nameTag = opts.nameTag;
    if (opts.lore) this.rawLore = structuredClone(opts.lore);
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
    return [...(this.enchantable ? [this.enchantable] : []), ...this.components.values()];
  }

  getTags(): string[] {
    return [...this.tags];
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag);
  }

  /** Test view: every line as an English-speaking client reads it (RawMessages rendered). Setter stores lines as given. */
  get lore(): string[] {
    return this.rawLore.map((l) => renderRaw(l, "en"));
  }

  set lore(lines: FakeLoreLine[]) {
    this.rawLore = structuredClone(lines);
  }

  /** Test view in Russian. */
  get loreRu(): string[] {
    return this.rawLore.map((l) => renderRaw(l, "ru"));
  }

  /** Strings as is; RawMessage lines as their text parts only (the real behavior is undocumented). */
  getLore(): string[] {
    return this.rawLore.map(textOnly);
  }

  /** Like 2.10.0: string lines are wrapped as `{ text }`, RawMessage lines returned as stored. */
  getRawLore(): mc.RawMessage[] {
    return this.rawLore.map((l) => (typeof l === "string" ? { text: l } : (structuredClone(l) as mc.RawMessage)));
  }

  /** When true, setLore rejects RawMessage lines (simulates an engine that does not accept them). */
  static rejectRawLore = false;

  /**
   * Enforces the 20 lines × 50 chars limit like the engine (throws on violation). For RawMessage lines the
   * limit is checked on the English rendering (the engine's exact rule is undocumented).
   */
  setLore(loreList?: FakeLoreLine[]): void {
    guard("ItemStack.setLore");
    const list = loreList ?? [];
    if (list.length > LORE_LIMIT_LINES) throw new Error(`Lore has ${list.length} lines (max ${LORE_LIMIT_LINES})`);
    for (const line of list) {
      if (typeof line !== "string") {
        if (FakeItemStack.rejectRawLore) throw new TypeError("RawMessage lore is not supported (simulated)");
        if (!isRawMessage(line)) throw new TypeError(`Invalid RawMessage lore line ${JSON.stringify(line)}`);
      }
      const len = renderRaw(line, "en").length;
      if (len > LORE_LIMIT_CHARS) throw new Error(`Lore line too long (${len} > ${LORE_LIMIT_CHARS})`);
    }
    this.rawLore = structuredClone(list);
  }

  private assertPropsAllowed(): void {
    if (this.isStackable) throw new Error(`Dynamic properties are not supported on stackable item ${this.typeId}`);
  }

  getDynamicProperty(identifier: string): boolean | number | string | undefined {
    this.assertPropsAllowed();
    return this.props.get(identifier) as boolean | number | string | undefined;
  }

  setDynamicProperty(identifier: string, value?: boolean | number | string | object): void {
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
      JSON.stringify(other.rawLore) === JSON.stringify(this.rawLore)
    );
  }

  matches(itemName: string): boolean {
    return ns(itemName) === this.typeId;
  }

  clone(): FakeItemStack {
    const c = new FakeItemStack(this.typeId, this.amount, {
      maxAmount: this.maxAmount,
      localizationKey: this.localizationKey,
      lore: this.rawLore,
      tags: this.tags,
      ...(this.enchantable ? { enchantable: this.enchantable.clone() } : {}),
      ...(this.nameTag !== undefined ? { nameTag: this.nameTag } : {}),
    });
    c.keepOnDeath = this.keepOnDeath;
    c.lockMode = this.lockMode;
    for (const [k, v] of this.props) c.props.set(k, v);
    for (const [k, v] of this.components) c.components.set(k, cloneComponent(v));
    return c;
  }
}

/** Components with a clone() (e.g. FakeDurability) are copied with the stack, like the engine does. */
function cloneComponent(v: unknown): unknown {
  const c = v as { clone?: () => unknown } | undefined;
  return c && typeof c.clone === "function" ? c.clone() : v;
}

export { FakeItemStack as ItemStack };

/** ItemDurabilityComponent ("minecraft:durability"). */
export class FakeDurability {
  readonly typeId = "minecraft:durability";
  unbreakable = false;
  constructor(
    public maxDurability: number,
    public damage = 0,
  ) {}

  get isValid(): boolean {
    return true;
  }

  clone(): FakeDurability {
    const c = new FakeDurability(this.maxDurability, this.damage);
    c.unbreakable = this.unbreakable;
    return c;
  }
}

// ───────────────────────────── containers / equipment ─────────────────────────────

/** Items are copied in and out, like the engine: forgetting write-back loses changes. */
export class FakeContainer {
  readonly slots: Array<FakeItemStack | undefined>;
  readonly writes: Array<{ slot: number; item: FakeItemStack | undefined }> = [];

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
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.size) throw new InvalidContainerSlotError(`slot ${slot}`);
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
  readonly writes: Array<{ slot: EquipmentSlot; item: FakeItemStack | undefined }> = [];
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
    if (slot === EquipmentSlot.Mainhand && this.mainhand) return this.mainhand.get();
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
    if (slot === EquipmentSlot.Mainhand && this.mainhand) return this.mainhand.get();
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

// ───────────────────────────── entity components ─────────────────────────────

/** Entity types that get a FakeProjectileComponent when spawned through FakeDimension.spawnEntity. */
export const PROJECTILE_TYPE_IDS: ReadonlySet<string> = new Set([
  "minecraft:arrow",
  "minecraft:thrown_trident",
  "minecraft:snowball",
  "minecraft:egg",
  "minecraft:wind_charge_projectile",
  "minecraft:fireworks_rocket",
]);

/**
 * Vanilla entities with `is_summonable: false` (Mojang/bedrock-samples behavior_pack/entities):
 * the engine's spawnEntity refuses them (EntitySpawnError). Items go through spawnItem.
 */
export const NOT_SUMMONABLE_TYPE_IDS: ReadonlySet<string> = new Set([
  "minecraft:thrown_trident",
  "minecraft:item",
  "minecraft:player",
]);

/** EntityProjectileComponent: writable owner; shoot() logs and sets the entity velocity. */
export class FakeProjectileComponent {
  readonly typeId = "minecraft:projectile";
  owner?: FakeEntity;
  readonly shots: Array<{ velocity: Vec3; options?: unknown }> = [];

  constructor(readonly entity?: FakeEntity) {}

  get isValid(): boolean {
    return this.entity?.isValid ?? true;
  }

  shoot(velocity: Vec3, options?: unknown): void {
    guard("EntityProjectileComponent.shoot");
    this.shots.push({ velocity: v3(velocity), ...(options !== undefined ? { options } : {}) });
    if (this.entity) this.entity.velocity = v3(velocity);
  }
}

/** EntityItemComponent ("minecraft:item") of an item entity. */
export class FakeItemEntityComponent {
  readonly typeId = "minecraft:item";
  constructor(readonly itemStack: FakeItemStack) {}
  get isValid(): boolean {
    return true;
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
  readonly addedEffects: Array<{ id: string; duration: number; options: unknown }> = [];
  readonly damageLog: Array<{ amount: number; options: unknown }> = [];
  isValid = true;
  location: Vec3 = { x: 0, y: 64, z: 0 };
  dimension: FakeDimension;
  velocity: Vec3 = { x: 0, y: 0, z: 0 };
  viewDirection: Vec3 = { x: 0, y: 0, z: 1 };
  readonly tags = new Set<string>();
  spawnOptions?: unknown;
  readonly impulses: Vec3[] = [];
  readonly knockbacks: Array<{ h: { x: number; z: number }; v: number }> = [];
  readonly teleports: Vec3[] = [];

  constructor(typeId: string, opts: { families?: readonly string[] } = {}) {
    this.id = String(nextEntityId++);
    this.typeId = ns(typeId);
    this.dimension = world.getDimension("overworld");
    if (opts.families) this.components.set(EntityComponentTypes.TypeFamily, new FakeTypeFamily(opts.families));
  }

  addTag(tag: string): boolean {
    guard("Entity.addTag");
    if (this.tags.has(tag)) return false;
    this.tags.add(tag);
    return true;
  }

  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }

  removeTag(tag: string): boolean {
    return this.tags.delete(tag);
  }

  getTags(): string[] {
    return [...this.tags];
  }

  getVelocity(): Vec3 {
    return v3(this.velocity);
  }

  clearVelocity(): void {
    guard("Entity.clearVelocity");
    this.velocity = { x: 0, y: 0, z: 0 };
  }

  applyImpulse(vector: Vec3): void {
    guard("Entity.applyImpulse");
    this.impulses.push(v3(vector));
    this.velocity = { x: this.velocity.x + vector.x, y: this.velocity.y + vector.y, z: this.velocity.z + vector.z };
  }

  applyKnockback(horizontalForce: { x: number; z: number }, verticalStrength: number): void {
    guard("Entity.applyKnockback");
    this.knockbacks.push({ h: { x: horizontalForce.x, z: horizontalForce.z }, v: verticalStrength });
  }

  teleport(location: Vec3, teleportOptions?: { dimension?: FakeDimension }): void {
    guard("Entity.teleport");
    this.teleports.push(v3(location));
    this.location = v3(location);
    if (teleportOptions?.dimension) this.dimension = teleportOptions.dimension;
  }

  getHeadLocation(): Vec3 {
    return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z };
  }

  getViewDirection(): Vec3 {
    return v3(this.viewDirection);
  }

  /** Invalidates the entity and emits world.afterEvents.entityRemove. */
  remove(): void {
    guard("Entity.remove");
    this.despawn();
  }

  kill(): boolean {
    guard("Entity.kill");
    if (!this.isValid) return false;
    this.despawn();
    return true;
  }

  private despawn(): void {
    if (!this.isValid) return;
    this.isValid = false;
    world.afterEvents.entityRemove.emit({ removedEntityId: this.id, typeId: this.typeId });
  }

  getComponent(componentId: string): unknown {
    return this.components.get(ns(componentId));
  }

  hasComponent(componentId: string): boolean {
    return this.components.has(ns(componentId));
  }

  getDynamicProperty(identifier: string): boolean | number | string | undefined {
    return this.props.get(identifier) as boolean | number | string | undefined;
  }

  setDynamicProperty(identifier: string, value?: boolean | number | string | object): void {
    if (value === undefined) this.props.delete(identifier);
    else this.props.set(identifier, value);
  }

  getEffect(effectType: string | { getName(): string }): FakeEffect | undefined {
    const id = ns(typeof effectType === "string" ? effectType : effectType.getName());
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
    const id = ns(typeof effectType === "string" ? effectType : effectType.getName());
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
    this.components.set(EntityComponentTypes.Inventory, new FakeInventoryComponent(this.container));
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

  /** The engine does not move players with impulses; the fake makes that loud. */
  override applyImpulse(vector: Vec3): void {
    guard("Entity.applyImpulse");
    throw new FakeUnsupportedError(`applyImpulse(${JSON.stringify(vector)}) is not supported on players`);
  }

  sendMessage(message: unknown): void {
    this.messages.push(message);
  }

  /** `messages` as an English-speaking client reads them. */
  get texts(): string[] {
    return this.messages.map((m) => renderRaw(m, "en"));
  }
}

// ───────────────────────────── blocks / dimensions ─────────────────────────────

const MIN_Y = -64;
const MAX_Y = 319;
const LIQUIDS = new Set(["minecraft:water", "minecraft:lava", "minecraft:flowing_water", "minecraft:flowing_lava"]);

const keyOf = (p: Vec3): string => `${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;

/** A live view of one position in a FakeDimension (reads the block map each time). */
export class FakeBlock {
  readonly location: Vec3;
  isValid = true;

  constructor(
    readonly dimension: FakeDimension,
    location: Vec3,
  ) {
    this.location = { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) };
  }

  get x(): number {
    return this.location.x;
  }
  get y(): number {
    return this.location.y;
  }
  get z(): number {
    return this.location.z;
  }

  get typeId(): string {
    return this.dimension.typeAt(this.location);
  }

  get isAir(): boolean {
    return this.typeId === "minecraft:air";
  }

  get isLiquid(): boolean {
    return LIQUIDS.has(this.typeId);
  }

  get permutation(): { type: { id: string } } {
    return { type: { id: this.typeId } };
  }

  center(): Vec3 {
    return { x: this.x + 0.5, y: this.y + 0.5, z: this.z + 0.5 };
  }

  bottomCenter(): Vec3 {
    return { x: this.x + 0.5, y: this.y, z: this.z + 0.5 };
  }

  setType(typeId: string): void {
    guard("Block.setType");
    this.dimension.setBlock(this.location, typeId);
  }
}

const SETBLOCK_RE = /^\/?setblock\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+([\w:.]+)(?:\s+(destroy|replace|keep))?\s*$/;

export class FakeDimension {
  /** "x,y,z" → typeId; missing = "minecraft:air". */
  readonly blocks = new Map<string, string>();
  /** Keys for which getBlock returns undefined (unloaded chunks). */
  readonly unloaded = new Set<string>();
  /** Every entity spawned/added here (including removed ones: check isValid). */
  readonly entities: FakeEntity[] = [];
  readonly commands: string[] = [];
  readonly particles: Array<{ id: string; location: Vec3 }> = [];
  readonly sounds: Array<{ id: string; location: Vec3; options?: unknown }> = [];
  readonly explosions: Array<{ location: Vec3; radius: number; options?: ExplosionOptionsLike }> = [];

  constructor(readonly id: string) {}

  get isValid(): boolean {
    return true;
  }

  /** Test helper. */
  setBlock(p: Vec3, typeId: string): void {
    const id = ns(typeId);
    if (id === "minecraft:air") this.blocks.delete(keyOf(p));
    else this.blocks.set(keyOf(p), id);
  }

  /** Test helper. */
  typeAt(p: Vec3): string {
    return this.blocks.get(keyOf(p)) ?? "minecraft:air";
  }

  /** Test helper: places an entity here without a spawn event. */
  addEntity<T extends FakeEntity>(e: T, location?: Vec3): T {
    e.dimension = this;
    if (location) e.location = v3(location);
    if (!this.entities.includes(e)) this.entities.push(e);
    return e;
  }

  getBlock(p: Vec3): FakeBlock | undefined {
    const y = Math.floor(p.y);
    if (y < MIN_Y || y > MAX_Y || this.unloaded.has(keyOf(p))) return undefined;
    return new FakeBlock(this, p);
  }

  /**
   * Logs every command. Implements `setblock X Y Z <block> [destroy|replace|keep]`: `destroy` of a
   * non-air block drops one item of the old type at the block center (as a spawned item entity).
   * Invalid setblock syntax throws; other commands succeed without effect.
   */
  runCommand(commandString: string): { successCount: number } {
    guard("Dimension.runCommand");
    this.commands.push(commandString);
    const cmd = commandString.trim();
    if (!/^\/?setblock\b/.test(cmd)) return { successCount: 1 };
    const m = SETBLOCK_RE.exec(cmd);
    if (!m) throw new Error(`Syntax error: ${commandString}`);
    const p = { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
    const block = this.getBlock(p);
    if (!block) return { successCount: 0 };
    const newType = ns(m[4] as string);
    const mode = m[5] ?? "replace";
    const oldType = block.typeId;
    if (mode === "keep" && oldType !== "minecraft:air") return { successCount: 0 };
    if (oldType === newType) return { successCount: 0 };
    const center = block.center();
    this.setBlock(p, newType);
    if (mode === "destroy" && oldType !== "minecraft:air") this.spawnItem(new FakeItemStack(oldType), center);
    return { successCount: 1 };
  }

  /** Throws for NOT_SUMMONABLE_TYPE_IDS; attaches FakeProjectileComponent for PROJECTILE_TYPE_IDS; emits entitySpawn synchronously. */
  spawnEntity(identifier: string, location: Vec3, options?: { spawnEvent?: string; initialPersistence?: boolean }): FakeEntity {
    guard("Dimension.spawnEntity");
    if (NOT_SUMMONABLE_TYPE_IDS.has(ns(identifier))) throw new Error(`EntitySpawnError: ${identifier} is not summonable`);
    const e = new FakeEntity(identifier);
    if (PROJECTILE_TYPE_IDS.has(e.typeId)) e.components.set(EntityComponentTypes.Projectile, new FakeProjectileComponent(e));
    if (options !== undefined) e.spawnOptions = options;
    this.addEntity(e, location);
    world.afterEvents.entitySpawn.emit({ entity: e, cause: EntityInitializationCause.Spawned });
    return e;
  }

  /** An item entity carrying a copy of `item`; emits entitySpawn synchronously. */
  spawnItem(itemStack: FakeItemStack, location: Vec3): FakeEntity {
    guard("Dimension.spawnItem");
    const e = new FakeEntity("minecraft:item");
    e.components.set(EntityComponentTypes.Item, new FakeItemEntityComponent(itemStack.clone()));
    this.addEntity(e, location);
    world.afterEvents.entitySpawn.emit({ entity: e, cause: EntityInitializationCause.Spawned });
    return e;
  }

  spawnParticle(effectName: string, location: Vec3): void {
    guard("Dimension.spawnParticle");
    this.particles.push({ id: effectName, location: v3(location) });
  }

  playSound(soundId: string, location: Vec3, soundOptions?: unknown): void {
    guard("Dimension.playSound");
    this.sounds.push({ id: soundId, location: v3(location), ...(soundOptions !== undefined ? { options: soundOptions } : {}) });
  }

  createExplosion(location: Vec3, radius: number, explosionOptions?: ExplosionOptionsLike): boolean {
    guard("Dimension.createExplosion");
    this.explosions.push({
      location: v3(location),
      radius,
      ...(explosionOptions !== undefined ? { options: explosionOptions } : {}),
    });
    return true;
  }

  /** Valid entities only; euclidean distance. */
  getEntities(q: { type?: string; location?: Vec3; maxDistance?: number; tags?: string[]; excludeTags?: string[] } = {}): FakeEntity[] {
    const type = q.type !== undefined ? ns(q.type) : undefined;
    return this.entities.filter((e) => {
      if (!e.isValid || e.dimension !== this) return false;
      if (type !== undefined && e.typeId !== type) return false;
      if (q.location && q.maxDistance !== undefined) {
        const dx = e.location.x - q.location.x;
        const dy = e.location.y - q.location.y;
        const dz = e.location.z - q.location.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) > q.maxDistance) return false;
      }
      if (q.tags && !q.tags.every((t) => e.hasTag(t))) return false;
      if (q.excludeTags?.some((t) => e.hasTag(t))) return false;
      return true;
    });
  }
}

const DIMENSION_IDS: Readonly<Record<string, string>> = {
  overworld: "minecraft:overworld",
  "minecraft:overworld": "minecraft:overworld",
  nether: "minecraft:nether",
  "minecraft:nether": "minecraft:nether",
  the_end: "minecraft:the_end",
  "minecraft:the_end": "minecraft:the_end",
};

// ───────────────────────────── custom commands ─────────────────────────────

export type FakeCommandCallback = (origin: unknown, ...args: unknown[]) => unknown;

export class FakeCustomCommandRegistry {
  readonly enums = new Map<string, string[]>();
  readonly commands = new Map<string, { command: mc.CustomCommand; callback: FakeCommandCallback }>();

  registerEnum(name: string, values: string[]): void {
    guard("CustomCommandRegistry.registerEnum");
    if (this.enums.has(name)) throw new Error(`Enum ${name} already registered`);
    this.enums.set(name, [...values]);
  }

  registerCommand(customCommand: mc.CustomCommand, callback: FakeCommandCallback): void {
    guard("CustomCommandRegistry.registerCommand");
    if (!customCommand.name.includes(":")) throw new Error("Custom command names must be namespaced");
    if (this.commands.has(customCommand.name)) throw new Error(`Command ${customCommand.name} already registered`);
    // The engine resolves an Enum parameter by its name, so the enum must already be registered.
    for (const param of [...(customCommand.mandatoryParameters ?? []), ...(customCommand.optionalParameters ?? [])]) {
      if (param.type === CustomCommandParamType.Enum && !this.enums.has(param.name)) {
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
const systemBeforeMode = (name: string): ExecMode => (name === "startup" ? "early" : "restricted");

class FakeWorld {
  afterEvents: SignalBag = signalBag();
  beforeEvents: SignalBag = signalBag(restrictedSignals);
  readonly props = new Map<string, boolean | number | string | object>();
  readonly messages: unknown[] = [];
  players: FakePlayer[] = [];
  private readonly dimensions = new Map<string, FakeDimension>();

  /** Same instance per id until resetFakes(). */
  getDimension(dimensionId: string): FakeDimension {
    const id = DIMENSION_IDS[dimensionId];
    if (id === undefined) throw new Error(`Unknown dimension ${dimensionId}`);
    let d = this.dimensions.get(id);
    if (!d) {
      d = new FakeDimension(id);
      this.dimensions.set(id, d);
    }
    return d;
  }

  getDynamicProperty(identifier: string): boolean | number | string | undefined {
    guard("World.getDynamicProperty");
    return this.props.get(identifier) as boolean | number | string | undefined;
  }

  setDynamicProperty(identifier: string, value?: boolean | number | string | object): void {
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

  /** `messages` as an English-speaking client reads them. */
  get texts(): string[] {
    return this.messages.map((m) => renderRaw(m, "en"));
  }

  _reset(): void {
    this.afterEvents = signalBag();
    this.beforeEvents = signalBag(restrictedSignals);
    this.props.clear();
    this.messages.length = 0;
    this.players = [];
    this.dimensions.clear();
  }
}

interface IntervalEntry {
  id: number;
  fn: () => void;
  ticks: number;
  /** currentTick at registration (used by advance). */
  start: number;
}

class FakeSystem {
  beforeEvents: SignalBag = signalBag(systemBeforeMode);
  afterEvents: SignalBag = signalBag();
  currentTick = 0;
  private nextId = 1;
  readonly runQueue: Array<{ id: number; fn: () => void }> = [];
  readonly intervals: IntervalEntry[] = [];
  readonly timeouts: Array<{ id: number; fn: () => void; ticks: number; start: number }> = [];

  run(callback: () => void): number {
    const id = this.nextId++;
    this.runQueue.push({ id, fn: callback });
    return id;
  }

  runTimeout(callback: () => void, tickDelay = 1): number {
    const id = this.nextId++;
    this.timeouts.push({ id, fn: callback, ticks: tickDelay, start: this.currentTick });
    return id;
  }

  runInterval(callback: () => void, tickInterval = 1): number {
    const id = this.nextId++;
    this.intervals.push({ id, fn: callback, ticks: tickInterval, start: this.currentTick });
    return id;
  }

  clearRun(runId: number): void {
    for (const list of [this.runQueue, this.intervals, this.timeouts] as Array<Array<{ id: number }>>) {
      const i = list.findIndex((e) => e.id === runId);
      if (i >= 0) list.splice(i, 1);
    }
  }

  /** Test helper: run queued system.run callbacks (including ones queued while flushing). */
  flushRuns(): void {
    let guard = 0;
    while (this.runQueue.length > 0) {
      if (++guard > 10_000) throw new Error("flushRuns: runaway system.run loop");
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

  /**
   * Test helper: simulate `ticks` game ticks. Per tick: flushRuns(); fire timeouts whose delay has
   * elapsed; fire intervals whose period divides the ticks elapsed since registration; currentTick++.
   */
  advance(ticks = 1): void {
    for (let t = 0; t < ticks; t++) {
      this.flushRuns();
      const now = this.currentTick + 1;
      for (const e of [...this.timeouts]) {
        if (now - e.start < Math.max(1, e.ticks)) continue;
        const i = this.timeouts.indexOf(e);
        if (i < 0) continue;
        this.timeouts.splice(i, 1);
        e.fn();
      }
      for (const e of [...this.intervals]) {
        if (!this.intervals.includes(e)) continue;
        const elapsed = now - e.start;
        if (elapsed > 0 && elapsed % Math.max(1, e.ticks) === 0) e.fn();
      }
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
  FakeItemStack.rejectRawLore = false;
  world._reset();
  system._reset();
  _setEnchantFixture(VANILLA_ENCHANT_MAX);
}
