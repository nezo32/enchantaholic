/**
 * End-to-end: build the shipping bundle (same esbuild options as `npm run build`), load it against
 * the fake @minecraft/server with simulated execution privileges, and drive it the way the engine
 * would: early execution → startup → worldLoad → player events. Nothing from src/ is imported, so
 * this checks the artifact, not the modules.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { esbuildOptions } from "../../scripts/lib/esbuild-options.mjs";
import { ENTRY } from "../../scripts/lib/paths.mjs";
import {
  boots,
  chestplate,
  COMPAT,
  dirt,
  enchantedBook,
  helmet,
  leggings,
  makeBreakEvent,
  makeHurtEvent,
  makeItem,
  makePlayer,
  pickaxe,
  shield,
  spear,
  sword,
  zombie,
} from "../fakes/builders";
import {
  _execMode,
  _setExecMode,
  EquipmentSlot,
  FakeCustomCommandRegistry,
  GameMode,
  resetFakes,
  system,
  VANILLA_ENCHANT_MAX,
  world,
  FakeItemStack,
  type FakePlayer,
} from "../fakes/minecraft-server";

const PROP_LEVELS = "enchantaholic:levels";
const LORE_TAG = "§e§h§r";
const COMMAND = "enchantaholic:toggle";
const NOTIFY = "enchantaholic:notify";
const EQUIP = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];

let tmpDir: string;
let registry: FakeCustomCommandRegistry;
let warn: MockInstance;

// ───────────────────────────── independent oracle (does not use src/) ─────────────────────────────

interface SlotState {
  typeId: string;
  amount: number;
  nameTag: string | undefined;
  vanilla: Record<string, number>;
  /** True level per enchant: vanilla, or the stored level when vanilla is at max. */
  trueLevels: Record<string, number>;
  lore: string[];
  prop: string | undefined;
}

function storedLevels(item: FakeItemStack): Record<string, number> {
  const raw = item.isStackable ? undefined : item.props.get(PROP_LEVELS);
  return typeof raw === "string" ? (JSON.parse(raw) as Record<string, number>) : {};
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function roman(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i] as string] as number;
    const next = ROMAN[s[i + 1] as string] ?? 0;
    n += v < next ? -v : v;
  }
  return n;
}
const NAME_TO_ID: Record<string, string> = {
  Sharpness: "minecraft:sharpness",
  Unbreaking: "minecraft:unbreaking",
};
/** Stored true levels: managed lore lines (known names), overlaid by the dynprop. */
function storedWithLore(item: FakeItemStack): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of item.lore) {
    if (!line.startsWith(`${LORE_TAG}§d`)) continue;
    const body = line.slice(LORE_TAG.length + 2);
    const sp = body.lastIndexOf(" ");
    const id = NAME_TO_ID[body.slice(0, sp)];
    if (id) out[id] = roman(body.slice(sp + 1));
  }
  return { ...out, ...storedLevels(item) };
}

function state(item: FakeItemStack | undefined): SlotState | undefined {
  if (!item) return undefined;
  const vanilla: Record<string, number> = {};
  for (const [id, lvl] of item.enchantable?.levels ?? []) vanilla[id] = lvl;
  const stored = storedWithLore(item);
  const trueLevels: Record<string, number> = {};
  for (const [id, v] of Object.entries(vanilla)) {
    const max = VANILLA_ENCHANT_MAX[id] as number;
    trueLevels[id] = v >= max ? Math.max(v, stored[id] ?? 0) : v;
  }
  const prop = item.isStackable ? undefined : (item.props.get(PROP_LEVELS) as string | undefined);
  return { typeId: item.typeId, amount: item.amount, nameTag: item.nameTag, vanilla, trueLevels, lore: [...item.lore], prop };
}

function snapshot(p: FakePlayer): Map<string, SlotState | undefined> {
  const out = new Map<string, SlotState | undefined>();
  for (let i = 0; i < p.container.size; i++) out.set(`inv:${i}`, state(p.container.peek(i)));
  for (const s of EQUIP) out.set(`equip:${s}`, state(p.equippable.peek(s)));
  return out;
}

function changedSlots(a: Map<string, SlotState | undefined>, b: Map<string, SlotState | undefined>): string[] {
  return [...a.keys()].filter((k) => JSON.stringify(a.get(k)) !== JSON.stringify(b.get(k)));
}

/** Checks the per-item invariants that must hold after every event. */
function assertItemInvariants(slot: string, s: SlotState): void {
  for (const [id, v] of Object.entries(s.vanilla)) {
    expect(v, `${slot} ${id} vanilla`).toBeLessThanOrEqual(VANILLA_ENCHANT_MAX[id] as number);
    expect(v, `${slot} ${id} vanilla`).toBeGreaterThanOrEqual(1);
  }
  if (!/_spear$/.test(s.typeId)) expect(s.vanilla["minecraft:lunge"], `${slot} lunge`).toBeUndefined();
  expect(s.lore.length, `${slot} lore lines`).toBeLessThanOrEqual(20);
  for (const line of s.lore) expect(line.length, `${slot} lore line`).toBeLessThanOrEqual(50);
  // Managed lore lines appear only for overcapped enchants, and match the dynprop on non-stackables.
  const managed = s.lore.filter((l) => l.startsWith(LORE_TAG)).length;
  const over = Object.entries(s.trueLevels).filter(([id, t]) => t > (VANILLA_ENCHANT_MAX[id] as number)).length;
  const userLines = s.lore.length - managed;
  expect(managed, `${slot} managed lore`).toBe(Math.min(over, 20 - userLines));
  if (s.prop !== undefined) {
    for (const [id, lvl] of Object.entries(JSON.parse(s.prop) as Record<string, number>)) {
      expect(lvl, `${slot} ${id} stored`).toBeGreaterThan(VANILLA_ENCHANT_MAX[id] as number);
      expect(s.vanilla[id], `${slot} ${id} stored only at max`).toBe(VANILLA_ENCHANT_MAX[id]);
    }
  }
}

const breakBlock = (p: FakePlayer, block = "minecraft:stone") =>
  world.afterEvents.playerBreakBlock.emit(makeBreakEvent(p, block));

/** Breaks one block and returns the slots that changed (with invariants checked). */
function breakAndDiff(p: FakePlayer, block = "minecraft:stone"): string[] {
  const before = snapshot(p);
  const bars = p.onScreenDisplay.actionBars.length;
  breakBlock(p, block);
  const after = snapshot(p);
  const changed = changedSlots(before, after);
  for (const [slot, s] of after) if (s) assertItemInvariants(slot, s);
  if (changed.length === 1) {
    const slot = changed[0] as string;
    const a = before.get(slot) as SlotState;
    const b = after.get(slot) as SlotState;
    expect(b.typeId).toBe(a.typeId);
    expect(b.amount).toBe(a.amount);
    expect(b.nameTag).toBe(a.nameTag);
    // Exactly one enchant gained exactly one true level; nothing else moved.
    const ids = new Set([...Object.keys(a.trueLevels), ...Object.keys(b.trueLevels)]);
    const deltas = [...ids].map((id) => [id, (b.trueLevels[id] ?? 0) - (a.trueLevels[id] ?? 0)] as const).filter(([, d]) => d !== 0);
    expect(deltas, `${slot} deltas`).toHaveLength(1);
    expect(deltas[0]?.[1]).toBe(1);
    expect(p.onScreenDisplay.actionBars.length).toBe(bars + 1);
  } else {
    expect(p.onScreenDisplay.actionBars.length).toBe(bars);
  }
  return changed;
}

function fullInventoryPlayer(): FakePlayer {
  const p = makePlayer({
    inv: {
      0: sword(),
      1: pickaxe(),
      2: dirt(64),
      3: spear("iron"),
      4: enchantedBook(),
      5: makeItem("minecraft:book", { amount: 12 }), // plain book stack, no minecraft:enchantable
      17: dirt(32),
      35: makeItem("minecraft:bow", { enchantable: COMPAT.bow, nameTag: "Longshot" }),
    },
    equip: { Head: helmet(), Chest: chestplate(), Legs: leggings(), Feet: boots(), Offhand: shield() },
  });
  world.players.push(p);
  return p;
}

function runCommand(...args: unknown[]): { status: number; message?: string } {
  const r = registry.invoke(COMMAND, { sourceType: "Entity" }, ...args) as { status: number; message?: string };
  system.flushRuns();
  return r;
}

// ───────────────────────────── lifecycle ─────────────────────────────

beforeAll(async () => {
  resetFakes();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchantaholic-bundle-"));
  const outfile = path.join(tmpDir, "main.js");
  await build({ ...esbuildOptions({ full: "9.9.9-it" }, false), entryPoints: [ENTRY], outfile, logLevel: "silent" });

  warn = vi.spyOn(console, "warn");
  const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

  // Top-level evaluation runs in early execution.
  _setExecMode("early");
  try {
    await import(/* @vite-ignore */ outfile);
  } finally {
    _setExecMode("normal");
  }
  expect(system.beforeEvents.startup.count).toBe(1);
  expect(world.afterEvents.worldLoad.count).toBe(1);
  expect(world.afterEvents.playerBreakBlock.count).toBe(0);

  registry = new FakeCustomCommandRegistry();
  system.beforeEvents.startup.emit({ customCommandRegistry: registry }); // emitted with "early" privilege
  expect(registry.commands.has(COMMAND)).toBe(true);
  world.afterEvents.worldLoad.emit({});
  expect(info).toHaveBeenCalledWith("[Enchantaholic] v9.9.9-it loaded");
  expect(_execMode()).toBe("normal");
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

beforeEach(() => {
  world.players = [];
  warn.mockClear();
});

// ───────────────────────────── tests ─────────────────────────────

describe("bundled main.js in a simulated runtime", () => {
  it("registered the expected handlers and intervals at worldLoad", () => {
    // One for the enchanter / overcap effects, one for the custom effects (v0.3.0).
    expect(world.afterEvents.playerBreakBlock.count).toBe(2);
    expect(world.beforeEvents.entityHurt.count).toBe(2); // overcap damage + Moon Boots fall guard
    expect(world.afterEvents.entitySpawn.count).toBe(2); // Power tracking + Barrage/Kaboom
    expect(world.afterEvents.entityRemove.count).toBe(2);
    expect(world.afterEvents.entityHitEntity.count).toBe(1);
    expect(world.afterEvents.entityDie.count).toBe(1);
    expect(world.afterEvents.playerLeave.count).toBe(1); // notify-prefs cache cleanup
    // Efficiency (20), Magnet (10), Moon Boots (10), Hiccups (200).
    expect(system.intervals.map((i) => i.ticks)).toEqual([20, 10, 10, 200]);
    const cmd = registry.commands.get(COMMAND)?.command;
    expect(cmd?.cheatsRequired).toBe(false);
    expect(cmd?.permissionLevel).toBe(1); // GameDirectors
    expect(cmd?.optionalParameters?.[0]?.name).toBe([...registry.enums.keys()][0]);
  });

  it("survival: 100 stone breaks with a full diverse inventory change exactly one slot by +1 each", () => {
    const p = fullInventoryPlayer();
    const hits = new Map<string, number>();
    for (let i = 0; i < 100; i++) {
      const changed = breakAndDiff(p);
      expect(changed, `break ${i}`).toHaveLength(1);
      hits.set(changed[0] as string, (hits.get(changed[0] as string) ?? 0) + 1);
    }
    // Non-enchantable stacks never change; enchantables are spread over (uniform slot choice).
    for (const s of ["inv:2", "inv:5", "inv:17"]) expect(hits.has(s), s).toBe(false);
    expect(hits.size).toBeGreaterThanOrEqual(8);
    expect(p.container.peek(2)?.amount).toBe(64);
    expect(p.container.peek(5)?.amount).toBe(12);
    expect(p.container.peek(35)?.nameTag).toBe("Longshot");
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(["minecraft:short_grass", "minecraft:poppy", "minecraft:torch", "minecraft:tnt", "minecraft:slime"])(
    "breaking %s changes nothing",
    (block) => {
      const p = fullInventoryPlayer();
      for (let i = 0; i < 10; i++) expect(breakAndDiff(p, block)).toEqual([]);
      expect(p.onScreenDisplay.actionBars).toHaveLength(0);
      expect(p.sounds).toHaveLength(0);
    },
  );

  it.each([GameMode.Creative, GameMode.Spectator])("%s: nothing changes", (mode) => {
    const p = fullInventoryPlayer();
    p.gameMode = mode;
    for (let i = 0; i < 10; i++) expect(breakAndDiff(p)).toEqual([]);
  });

  it("adventure mode enchants like survival", () => {
    const p = fullInventoryPlayer();
    p.gameMode = GameMode.Adventure;
    expect(breakAndDiff(p)).toHaveLength(1);
  });

  it("a single sword: 600 breaks → levels monotonic +1, true levels beyond max tracked, vanilla capped", () => {
    const p = makePlayer({ inv: { 4: sword() } });
    for (let i = 0; i < 600; i++) expect(breakAndDiff(p)).toEqual(["inv:4"]);
    const s = state(p.container.peek(4)) as SlotState;
    const total = Object.values(s.trueLevels).reduce((a, b) => a + b, 0);
    expect(total).toBe(600);
    expect(Object.values(s.trueLevels).some((t) => t > 5)).toBe(true);
    // Only one of sharpness/smite/bane (vanilla conflicts) ever got onto the sword.
    const dmg = ["minecraft:sharpness", "minecraft:smite", "minecraft:bane_of_arthropods"].filter((id) => s.vanilla[id]);
    expect(dmg).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("stored levels survive a lost dynamic property (lore fallback) and user lore is preserved", () => {
    const p = makePlayer({ inv: { 0: makeItem("minecraft:diamond_sword", { enchantable: { compatible: ["sharpness"] }, lore: ["§7Heirloom"] }) } });
    for (let i = 0; i < 8; i++) breakAndDiff(p); // Sharpness true VIII
    const item = p.container.peek(0) as FakeItemStack;
    expect(storedLevels(item)).toEqual({ "minecraft:sharpness": 8 });
    item.props.delete(PROP_LEVELS);
    breakAndDiff(p);
    expect(storedLevels(p.container.peek(0) as FakeItemStack)).toEqual({ "minecraft:sharpness": 9 });
    expect(p.container.peek(0)?.lore[0]).toBe("§7Heirloom");
    expect(p.container.peek(0)?.lore[1]).toBe(`${LORE_TAG}§dSharpness IX`);
  });

  it("an item with 20 user lore lines still stacks (dynprop only) without warnings", () => {
    const lore = Array.from({ length: 20 }, (_, i) => `line ${i}`);
    const p = makePlayer({ inv: { 0: makeItem("minecraft:diamond_sword", { enchantable: { compatible: ["sharpness"] }, lore }) } });
    for (let i = 0; i < 7; i++) breakAndDiff(p);
    expect(storedLevels(p.container.peek(0) as FakeItemStack)).toEqual({ "minecraft:sharpness": 7 });
    expect(p.container.peek(0)?.lore).toEqual(lore);
    expect(warn).not.toHaveBeenCalled();
  });

  it("a stackable enchantable stack (book-like) is tracked through lore only and keeps its amount", () => {
    const p = makePlayer({ inv: { 0: makeItem("minecraft:book", { amount: 5, enchantable: { compatible: ["unbreaking"] } }) } });
    for (let i = 0; i < 5; i++) breakAndDiff(p);
    const item = p.container.peek(0) as FakeItemStack;
    expect(item.amount).toBe(5);
    expect(item.props.size).toBe(0);
    expect(item.lore).toEqual([`${LORE_TAG}§dUnbreaking V`]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("managed lore is a translatable RawMessage (Russian client) and legacy English lines keep working", () => {
    const legacy = `${LORE_TAG}§dUnbreaking VI`; // as written by v0.3.0
    const p = makePlayer({
      inv: { 0: makeItem("minecraft:book", { amount: 2, enchantable: { compatible: ["unbreaking"] }, levels: { unbreaking: 3 }, lore: ["§7Old", legacy] }) },
    });
    breakAndDiff(p); // stackable: the legacy lore line is the only store → VII
    const item = p.container.peek(0) as FakeItemStack;
    expect(item.lore).toEqual(["§7Old", `${LORE_TAG}§dUnbreaking VII`]);
    expect(item.loreRu).toEqual(["§7Old", `${LORE_TAG}§dНеразрушимость VII`]);
    expect(item.rawLore[0]).toBe("§7Old");
    expect(item.rawLore[1]).toMatchObject({ rawtext: [{ text: `${LORE_TAG}§d` }, { translate: "enchantment.durability" }, { text: " VII" }] });
    expect(warn).not.toHaveBeenCalled();
  });

  it("lunge only ever lands on spears (500 breaks, 'all'-compatible book + sword + spear)", () => {
    const p = makePlayer({ inv: { 0: sword(), 1: spear("diamond"), 2: enchantedBook() } });
    for (let i = 0; i < 500; i++) breakAndDiff(p);
    expect(p.container.peek(0)?.enchantable?.levels.has("minecraft:lunge")).toBe(false);
    expect(p.container.peek(2)?.enchantable?.levels.has("minecraft:lunge")).toBe(false);
  });

  it("the toggle command turns the mode off/on; off → nothing changes", () => {
    const p = fullInventoryPlayer();
    expect(runCommand("status").message).toContain("ON");
    runCommand("off");
    expect(world.getDynamicProperty("enchantaholic:enabled")).toBe(false);
    expect(world.texts.at(-1)).toContain("OFF");
    for (let i = 0; i < 20; i++) expect(breakAndDiff(p)).toEqual([]);
    runCommand("off"); // idempotent
    expect(world.getDynamicProperty("enchantaholic:enabled")).toBe(false);
    runCommand(); // no argument flips
    expect(world.getDynamicProperty("enchantaholic:enabled")).toBe(true);
    expect(breakAndDiff(p)).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("/enchantaholic:notify is open to any player, and message off hides the actionbar but keeps enchanting", () => {
    const cmd = registry.commands.get(NOTIFY)?.command;
    expect(cmd?.permissionLevel).toBe(0); // Any
    expect(cmd?.cheatsRequired).toBe(false);
    const p = makePlayer({ inv: { 0: sword() } });
    world.players.push(p);
    const r = registry.invoke(NOTIFY, { sourceEntity: p }, "message", "off") as { status: number; message?: string };
    expect(r).toEqual({ status: 0 }); // players get the reply as a translatable chat message
    expect(p.texts).toEqual(["Enchant message: §cOFF"]);
    system.flushRuns();
    expect(p.getDynamicProperty(NOTIFY)).toBe('{"sound":true,"message":false}');
    const before = state(p.container.peek(0));
    breakBlock(p);
    expect(JSON.stringify(state(p.container.peek(0)))).not.toBe(JSON.stringify(before));
    expect(p.onScreenDisplay.actionBars).toHaveLength(0);
    expect(p.sounds).toHaveLength(1);
    registry.invoke(NOTIFY, { sourceEntity: p }, "status");
    expect(p.texts.at(-1)).toBe("Enchant sound: §aON§r, enchant message: §cOFF");
    expect(p.messages.every((m) => typeof m === "object")).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("entityHurt (restricted execution): overcapped sharpness adds damage without privileged calls", () => {
    const p = makePlayer({ inv: { 0: sword() } });
    p.container.slots[0] = makeItem("minecraft:diamond_sword", {
      enchantable: { compatible: "all" },
      levels: { "minecraft:sharpness": 5 },
      props: { [PROP_LEVELS]: JSON.stringify({ "minecraft:sharpness": 7 }) },
    });
    const ev = makeHurtEvent({ victim: zombie(), attacker: p, damage: 10 });
    world.beforeEvents.entityHurt.emit(ev);
    expect(ev.damage).toBeCloseTo(12.5);
    expect(warn).not.toHaveBeenCalled();
  });

  it("entityHurt: overcapped feather falling reduces fall damage for the wearer", () => {
    const p = makePlayer({
      equip: {
        Feet: makeItem("minecraft:diamond_boots", {
          enchantable: { compatible: "all" },
          levels: { "minecraft:feather_falling": 4 },
          props: { [PROP_LEVELS]: JSON.stringify({ "minecraft:feather_falling": 5 }) },
        }),
      },
    });
    const ev = makeHurtEvent({ victim: p, damage: 10, cause: "fall" });
    world.beforeEvents.entityHurt.emit(ev);
    expect(ev.damage).toBeCloseTo(10 / 1.12);
    expect(warn).not.toHaveBeenCalled();
  });

  it("efficiency interval gives Haste for an overcapped pickaxe in hand", () => {
    const p = makePlayer({
      inv: {
        0: makeItem("minecraft:diamond_pickaxe", {
          enchantable: { compatible: "all" },
          levels: { "minecraft:efficiency": 5 },
          props: { [PROP_LEVELS]: JSON.stringify({ "minecraft:efficiency": 7 }) },
        }),
      },
    });
    world.players.push(p);
    system.tickIntervals(1);
    expect(p.effects.get("minecraft:haste")?.amplifier).toBe(1);
    expect(p.effects.get("minecraft:haste")?.showParticles).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  // Must stay last: the bundle keeps the text-lore fallback for the rest of its (module) lifetime.
  it("falls back to English string lore when the engine rejects RawMessage lore", () => {
    FakeItemStack.rejectRawLore = true;
    const p = makePlayer({ inv: { 0: makeItem("minecraft:book", { amount: 2, enchantable: { compatible: ["unbreaking"] } }) } });
    for (let i = 0; i < 5; i++) breakAndDiff(p);
    expect((p.container.peek(0) as FakeItemStack).rawLore).toEqual([`${LORE_TAG}§dUnbreaking V`]);
    FakeItemStack.rejectRawLore = false;
  });
});
