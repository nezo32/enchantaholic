/**
 * End-to-end for the custom enchantment effects: build the shipping bundle, load it against the fake
 * @minecraft/server (same harness as bundle-runtime.test.ts) and drive block breaks and projectiles.
 * Only the item fixtures use src/ (through the builders); the behaviour comes from the bundle.
 * Enchantaholic Mode is turned OFF so random rolls cannot touch the test items: custom effects do not
 * depend on the mode, only on the Custom Enchantments setting.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";
import { esbuildOptions } from "../../scripts/lib/esbuild-options.mjs";
import { ENTRY } from "../../scripts/lib/paths.mjs";
import { COMPAT, makeBreakEvent, makeItem, makePlayer, makeProjectileHit } from "../fakes/builders";
import {
  _setExecMode,
  EntityComponentTypes,
  FakeCustomCommandRegistry,
  FakeEntity,
  FakeProjectileComponent,
  resetFakes,
  system,
  world,
  type FakeDimension,
  type FakePlayer,
} from "../fakes/minecraft-server";

const COPY_TAG = "enchantaholic:copy";
const IRON = "minecraft:iron_ore";

let tmpDir: string;
let registry: FakeCustomCommandRegistry;
let warn: MockInstance;
let dim: FakeDimension;

function command(name: string, arg: string): void {
  registry.invoke(name, { sourceType: "Entity" }, arg);
  system.flushRuns();
}

function veinMiner(): FakePlayer {
  const tool = makeItem("minecraft:iron_pickaxe", {
    enchantable: COMPAT.pickaxe,
    durability: { max: 250 },
    customs: { "enchantaholic:vein_miner": 1 },
  });
  const p = makePlayer({ inv: { 0: tool } });
  world.players.push(p);
  return p;
}

function mineVein(p: FakePlayer): void {
  const origin = { x: 20, y: 30, z: 20 };
  for (const [dx, dy] of [
    [1, 0],
    [2, 0],
    [2, 1],
  ] as const) {
    dim.setBlock({ x: origin.x + dx, y: origin.y + dy, z: origin.z }, IRON);
  }
  const tool = p.container.getItem(0);
  world.afterEvents.playerBreakBlock.emit(
    makeBreakEvent(p, IRON, { location: origin, itemBefore: tool, itemAfter: tool?.clone() }),
  );
  system.advance(5);
}

function shoot(p: FakePlayer): FakeEntity {
  const arrow = new FakeEntity("minecraft:arrow");
  const proj = new FakeProjectileComponent(arrow);
  proj.owner = p;
  arrow.components.set(EntityComponentTypes.Projectile, proj);
  arrow.velocity = { x: 0, y: 0.2, z: 3 };
  dim.addEntity(arrow, { x: 0, y: 70, z: 0 });
  world.afterEvents.entitySpawn.emit({ entity: arrow, cause: "Spawned" });
  return arrow;
}

beforeAll(async () => {
  resetFakes();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "enchantaholic-custom-fx-"));
  const outfile = path.join(tmpDir, "main.js");
  await build({ ...esbuildOptions({ full: "9.9.9-fx" }, false), entryPoints: [ENTRY], outfile, logLevel: "silent" });
  warn = vi.spyOn(console, "warn");
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
  dim = world.getDimension("overworld");
  command("enchantaholic:toggle", "off");
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("bundled custom effects", () => {
  it("OFF by default: a vein-miner pickaxe and a barrage bow do nothing", () => {
    const p = veinMiner();
    mineVein(p);
    expect(dim.commands).toEqual([]);
    const archer = makePlayer({ inv: { 0: makeItem("minecraft:bow", { customs: { "enchantaholic:barrage": 1 } }) } });
    shoot(archer);
    expect(dim.entities.filter((e) => e.hasTag(COPY_TAG))).toHaveLength(0);
  });

  it("ON: vein miner breaks a 3-block ore vein with drops and durability", () => {
    command("enchantaholic:custom", "on");
    const p = veinMiner();
    mineVein(p);
    expect(dim.commands.filter((c) => c.endsWith("air destroy"))).toHaveLength(3);
    expect([...dim.blocks.values()].filter((t) => t === IRON)).toHaveLength(0);
    expect(dim.getEntities({ type: "minecraft:item" })).toHaveLength(3);
    const durability = p.container.peek(0)?.getComponent("minecraft:durability") as { damage: number } | undefined;
    expect(durability?.damage).toBe(3);
  });

  it("ON: barrage + kaboom arrows copy, explode without breaking blocks, and clean up", () => {
    const bow = makeItem("minecraft:bow", {
      enchantable: COMPAT.bow,
      customs: { "enchantaholic:barrage": 1, "enchantaholic:kaboom": 2 },
    });
    const p = makePlayer({ inv: { 0: bow } });
    const arrow = shoot(p);
    const copies = dim.entities.filter((e) => e.hasTag(COPY_TAG));
    expect(copies).toHaveLength(10);
    for (const e of [arrow, ...copies]) world.afterEvents.projectileHitBlock.emit(makeProjectileHit(e, "block"));
    expect(dim.explosions).toHaveLength(11);
    for (const ex of dim.explosions) expect(ex.options).toMatchObject({ breaksBlocks: false, causesFire: false });
    expect(copies.every((c) => !c.isValid)).toBe(true);
  });

  it("OFF again: nothing more happens and the lore stays", () => {
    command("enchantaholic:custom", "off");
    const commandsBefore = dim.commands.length;
    const explosionsBefore = dim.explosions.length;
    const p = veinMiner();
    const lore = p.container.peek(0)?.getLore();
    mineVein(p);
    const bow = makeItem("minecraft:bow", { customs: { "enchantaholic:barrage": 3, "enchantaholic:kaboom": 3 } });
    const arrow = shoot(makePlayer({ inv: { 0: bow } }));
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(arrow, "block"));
    system.advance(250);
    expect(dim.commands).toHaveLength(commandsBefore);
    expect(dim.explosions).toHaveLength(explosionsBefore);
    expect(dim.entities.filter((e) => e.hasTag(COPY_TAG) && e.isValid)).toHaveLength(0);
    expect(p.container.peek(0)?.getLore()).toEqual(lore);
  });

  it("no content-log warnings during the run", () => {
    expect(warn).not.toHaveBeenCalled();
  });
});
