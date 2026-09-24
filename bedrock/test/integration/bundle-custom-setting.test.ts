/**
 * End-to-end for the Custom Enchantments setting: build the shipping bundle, load it against the fake
 * @minecraft/server (same harness as bundle-runtime.test.ts) and drive /enchantaholic:custom plus block
 * breaks. Nothing from src/ is imported: the lore format is checked by an independent oracle.
 * Players hold nothing in the main hand, so held-item custom effects stay out of the way; this file is
 * about rolling, not effects.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { esbuildOptions } from "../../scripts/lib/esbuild-options.mjs";
import { ENTRY } from "../../scripts/lib/paths.mjs";
import { boots, dirt, makeBreakEvent, makeItem, makePlayer, pickaxe, sword } from "../fakes/builders";
import {
  _setExecMode,
  FakeCustomCommandRegistry,
  resetFakes,
  system,
  world,
  type FakeItemStack,
  type FakePlayer,
} from "../fakes/minecraft-server";

const LORE_TAG = "§e§h§r";
const CUSTOM_CMD = "enchantaholic:custom";
const PROP_CUSTOM_ENABLED = "enchantaholic:custom";
const PROP_CUSTOM_LEVELS = "enchantaholic:custom_levels";
const CUSTOM_NAMES = new Set([
  "Vein Miner",
  "Barrage",
  "Yeet",
  "Kaboom",
  "Party Popper",
  "Chicken Rain",
  "Midas Touch",
  "Magnet",
  "Moon Boots",
  "Curse of Butterfingers",
  "Curse of Hiccups",
]);
const CUSTOM_CURSES = new Set(["Curse of Butterfingers", "Curse of Hiccups"]);

let tmpDir: string;
let registry: FakeCustomCommandRegistry;

// ───────────────────────────── independent oracle ─────────────────────────────

const ROMAN_RE = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/** Parses a managed line; throws (via expect) if a tagged line is malformed. */
function parseManaged(line: string): { color: string; name: string; level: string } {
  const m = /^§e§h§r§([0-9a-f])(.+) (\S+)$/.exec(line);
  expect(m, `tagged line parses: ${JSON.stringify(line)}`).not.toBeNull();
  const [, color, name, level] = m as unknown as [string, string, string, string];
  expect(/^\d+$/.test(level) || (level.length > 0 && ROMAN_RE.test(level)), `level ${level}`).toBe(true);
  if (CUSTOM_NAMES.has(name)) expect(color, name).toBe(CUSTOM_CURSES.has(name) ? "c" : "9");
  else expect(color, name).toBe("d");
  return { color, name, level };
}

function customLines(item: FakeItemStack | undefined): string[] {
  return (item?.lore ?? []).filter((l) => l.startsWith(LORE_TAG) && CUSTOM_NAMES.has(parseManaged(l).name));
}

function allItems(p: FakePlayer): FakeItemStack[] {
  const out: FakeItemStack[] = [];
  for (let i = 0; i < p.container.size; i++) {
    const it = p.container.peek(i);
    if (it) out.push(it);
  }
  for (const it of p.equippable.items.values()) if (it) out.push(it);
  return out;
}

function assertInvariants(p: FakePlayer): void {
  for (const item of allItems(p)) {
    expect(item.lore.length, item.typeId).toBeLessThanOrEqual(20);
    for (const line of item.lore) {
      expect(line.length, line).toBeLessThanOrEqual(50);
      if (line.startsWith(LORE_TAG)) parseManaged(line);
    }
    if (item.isStackable) expect(item.props.has(PROP_CUSTOM_LEVELS)).toBe(false);
  }
}

function breakMany(p: FakePlayer, n: number): void {
  for (let i = 0; i < n; i++) {
    world.afterEvents.playerBreakBlock.emit(makeBreakEvent(p, "minecraft:stone"));
    system.advance(1);
    assertInvariants(p);
  }
}

function custom(arg: string): { status: number; message?: string } {
  const r = registry.invoke(CUSTOM_CMD, { sourceType: "Entity" }, arg) as { status: number; message?: string };
  system.flushRuns();
  return r;
}

/** Selected slot 8 is empty: nothing is held, so no held-item custom effect can fire. */
function mixedPlayer(): FakePlayer {
  const p = makePlayer({
    selected: 8,
    inv: { 0: sword(), 1: pickaxe(), 2: dirt(64), 3: makeItem("minecraft:stick", { amount: 16 }) },
    equip: { Feet: boots() },
  });
  world.players.push(p);
  return p;
}

function dirtOnlyPlayer(): FakePlayer {
  const p = makePlayer({ selected: 8, inv: { 0: dirt(64), 1: dirt(12) } });
  world.players.push(p);
  return p;
}

// ───────────────────────────── lifecycle ─────────────────────────────

beforeAll(async () => {
  resetFakes();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchantaholic-custom-"));
  const outfile = path.join(tmpDir, "main.js");
  await build({ ...esbuildOptions({ full: "9.9.9-it" }, false), entryPoints: [ENTRY], outfile, logLevel: "silent" });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  _setExecMode("early");
  try {
    await import(/* @vite-ignore */ outfile);
  } finally {
    _setExecMode("normal");
  }
  registry = new FakeCustomCommandRegistry();
  system.beforeEvents.startup.emit({ customCommandRegistry: registry });
  world.afterEvents.worldLoad.emit({});
  expect(registry.commands.has(CUSTOM_CMD)).toBe(true);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

beforeEach(() => {
  world.players = [];
  // Deterministic rolls for the bundle (it uses Math.random).
  let a = 0x5eed;
  vi.spyOn(Math, "random").mockImplementation(() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
});

// ───────────────────────────── tests (in order: OFF → ON → OFF) ─────────────────────────────

describe("bundled main.js: Custom Enchantments setting", () => {
  it("defaults to OFF: status says so and 200 breaks never produce a custom lore line", () => {
    expect(world.props.has(PROP_CUSTOM_ENABLED)).toBe(false);
    expect(custom("status")).toEqual({ status: 0, message: "Custom Enchantments: §cOFF" });
    const p = mixedPlayer();
    breakMany(p, 200);
    for (const item of allItems(p)) expect(customLines(item), item.typeId).toEqual([]);
    expect(p.container.peek(2)?.lore).toEqual([]);
    expect(p.container.peek(3)?.lore).toEqual([]);
    const d = dirtOnlyPlayer();
    breakMany(d, 50);
    expect(d.container.writes).toHaveLength(0);
    expect(d.onScreenDisplay.actionBars).toHaveLength(0);
  });

  it("/enchantaholic:custom on (deferred) → rolls include customs; dirt-only players get enchanted", () => {
    const r = registry.invoke(CUSTOM_CMD, { sourceType: "Entity" }, "on") as { status: number; message?: string };
    expect(r).toEqual({ status: 0, message: "Custom Enchantments are now §aON§r for this world" });
    expect(world.props.has(PROP_CUSTOM_ENABLED)).toBe(false); // restricted: not yet
    system.flushRuns();
    expect(world.props.get(PROP_CUSTOM_ENABLED)).toBe(true);
    expect(world.messages).toContain("Custom Enchantments are now §aON§r for this world");
    expect(custom("status").message).toBe("Custom Enchantments: §aON");

    const d = dirtOnlyPlayer();
    breakMany(d, 40);
    expect(d.onScreenDisplay.actionBars).toHaveLength(40);
    const lines = [...customLines(d.container.peek(0)), ...customLines(d.container.peek(1))];
    expect(lines.length).toBeGreaterThan(0);
    expect(d.container.peek(0)?.amount).toBe(64);
    expect(d.container.peek(1)?.amount).toBe(12);

    const p = mixedPlayer();
    breakMany(p, 200);
    const withCustoms = allItems(p).filter((i) => customLines(i).length > 0);
    expect(withCustoms.length).toBeGreaterThanOrEqual(3);
    // The sword keeps its customs in the dynprop too (non-stackable source of truth).
    const s = p.container.peek(0) as FakeItemStack;
    if (customLines(s).length > 0) expect(typeof s.props.get(PROP_CUSTOM_LEVELS)).toBe("string");
  });

  it("/enchantaholic:custom off → no new customs; existing custom lines are kept", () => {
    const p = mixedPlayer();
    custom("on");
    breakMany(p, 150);
    const before = allItems(p).map((i) => [...customLines(i)].sort());
    expect(before.some((l) => l.length > 0)).toBe(true);

    expect(custom("off").message).toBe("Custom Enchantments are now §cOFF§r for this world");
    expect(world.props.get(PROP_CUSTOM_ENABLED)).toBe(false);
    breakMany(p, 150);
    const after = allItems(p).map((i) => [...customLines(i)].sort());
    expect(after).toEqual(before);

    const d = dirtOnlyPlayer();
    breakMany(d, 30);
    expect(d.container.writes).toHaveLength(0);
  });
});
