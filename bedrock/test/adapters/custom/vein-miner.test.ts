import type * as mc from "@minecraft/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onCustomBreak, registerCustomBreak } from "../../../src/adapters/custom/break-dispatch";
import { _jobs, startVein } from "../../../src/adapters/custom/vein-miner";
import { COMPAT, makeBreakEvent, makePlayer } from "../../fakes/builders";
import {
  GameMode,
  system,
  world,
  type FakeDurability,
  type FakeItemStack,
  type FakePlayer,
} from "../../fakes/minecraft-server";
import { customOff, customOn, overworld, resetCustom, withCustoms } from "./fx";

const STONE = "minecraft:stone";
const ORIGIN = { x: 0, y: 64, z: 0 };

function fillCube(n: number, type = STONE): void {
  const dim = overworld();
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
    dim.setBlock({ x, y: 64 + y, z }, type);
  }
  dim.setBlock(ORIGIN, "minecraft:air"); // the player already broke it
}

function pick(level: number, durability = { max: 1561, damage: 0 }, extra: { unbreaking?: number } = {}): FakeItemStack {
  return withCustoms("minecraft:diamond_pickaxe", { vein_miner: level }, {
    enchantable: COMPAT.pickaxe,
    durability,
    ...(extra.unbreaking ? { levels: { unbreaking: extra.unbreaking } } : {}),
  });
}

/** Player holding `tool` in slot 0 and the matching break event (before = after = the tool). */
function setup(tool: FakeItemStack, gameMode = GameMode.Survival): { p: FakePlayer; ev: mc.PlayerBreakBlockAfterEvent } {
  const p = makePlayer({ inv: { 0: tool }, gameMode });
  const ev = makeBreakEvent(p, STONE, { location: ORIGIN, itemBefore: tool.clone(), itemAfter: tool.clone() });
  return { p, ev };
}

const destroys = (): string[] => overworld().commands.filter((c) => c.startsWith("setblock") && c.endsWith("destroy"));
const damageOf = (p: FakePlayer, slot = 0): number | undefined =>
  (p.container.peek(slot)?.getComponent("minecraft:durability") as FakeDurability | undefined)?.damage;

describe("vein miner", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  it("does nothing while Custom Enchantments are OFF", () => {
    resetCustom();
    fillCube(3);
    const { ev } = setup(pick(100));
    onCustomBreak(ev);
    system.advance(20);
    expect(overworld().commands).toEqual([]);
    expect(_jobs()).toHaveLength(0);
  });

  it("L=100 on a 5x5x5 cube breaks the other 124 blocks, ≤ 32 per tick", () => {
    fillCube(5);
    const { p, ev } = setup(pick(100));
    startVein(ev);
    const perTick = [destroys().length];
    for (let t = 0; t < 10; t++) {
      const before = destroys().length;
      system.advance(1);
      perTick.push(destroys().length - before);
    }
    expect(destroys()).toHaveLength(124);
    for (const n of perTick) expect(n).toBeLessThanOrEqual(32);
    expect(perTick[0]).toBe(32);
    expect(_jobs()).toHaveLength(0);
    expect(system.intervals).toHaveLength(0); // loop stopped when idle
    // Every stone is gone and dropped as an item.
    expect(overworld().blocks.size).toBe(0);
    expect(overworld().getEntities({ type: "minecraft:item" })).toHaveLength(124);
    // One durability point per extra block (no Unbreaking).
    expect(damageOf(p)).toBe(124);
  });

  it("L=1 breaks exactly 8 extra blocks", () => {
    fillCube(5);
    const { ev } = setup(pick(1));
    startVein(ev);
    system.advance(5);
    expect(destroys()).toHaveLength(8);
  });

  it("only breaks the broken block's type and never denied blocks", () => {
    const dim = overworld();
    dim.setBlock({ x: 1, y: 64, z: 0 }, STONE);
    dim.setBlock({ x: 2, y: 64, z: 0 }, "minecraft:iron_ore");
    dim.setBlock({ x: 0, y: 65, z: 0 }, "minecraft:bedrock");
    dim.setBlock({ x: 0, y: 64, z: 1 }, "minecraft:cobblestone");
    const { ev } = setup(pick(10));
    startVein(ev);
    system.advance(3);
    expect(destroys()).toEqual(["setblock 1 64 0 air destroy"]);
    expect(dim.typeAt({ x: 2, y: 64, z: 0 })).toBe("minecraft:iron_ore");
    expect(dim.typeAt({ x: 0, y: 65, z: 0 })).toBe("minecraft:bedrock");
  });

  it("never starts on a denied block type", () => {
    const dim = overworld();
    dim.setBlock({ x: 1, y: 64, z: 0 }, "minecraft:bedrock");
    const p = makePlayer({ inv: { 0: pick(10) }, gameMode: GameMode.Creative });
    const tool = pick(10);
    startVein(makeBreakEvent(p, "minecraft:bedrock", { location: ORIGIN, itemBefore: tool, itemAfter: tool }));
    system.advance(3);
    expect(dim.commands).toEqual([]);
  });

  it("treats lit and unlit redstone ore as one vein", () => {
    const dim = overworld();
    dim.setBlock({ x: 1, y: 64, z: 0 }, "minecraft:lit_redstone_ore");
    dim.setBlock({ x: 2, y: 64, z: 0 }, "minecraft:redstone_ore");
    const tool = pick(10);
    const p = makePlayer({ inv: { 0: tool } });
    startVein(makeBreakEvent(p, "minecraft:redstone_ore", { location: ORIGIN, itemBefore: tool.clone(), itemAfter: tool.clone() }));
    expect(destroys()).toHaveLength(2);
  });

  it("the tool breaks at max durability and the job stops", () => {
    fillCube(5);
    const { p, ev } = setup(pick(100, { max: 10, damage: 0 }));
    startVein(ev);
    system.advance(10);
    expect(destroys()).toHaveLength(10);
    expect(p.container.peek(0)).toBeUndefined();
    expect(p.sounds.map((s) => s.soundId)).toContain("random.break");
    expect(_jobs()).toHaveLength(0);
  });

  it("Unbreaking skips some durability", () => {
    fillCube(5);
    const { p, ev } = setup(pick(100, { max: 1561, damage: 0 }, { unbreaking: 3 }));
    startVein(ev);
    system.advance(10);
    expect(destroys()).toHaveLength(124);
    const dmg = damageOf(p) ?? 0;
    expect(dmg).toBeGreaterThan(0);
    expect(dmg).toBeLessThan(124);
  });

  it("switching the hotbar slot aborts the job", () => {
    fillCube(5);
    const { p, ev } = setup(pick(100));
    startVein(ev);
    expect(destroys()).toHaveLength(32);
    p.selectedSlotIndex = 1;
    system.advance(5);
    expect(destroys()).toHaveLength(32);
    expect(_jobs()).toHaveLength(0);
  });

  it("a swapped or repaired tool in the same slot aborts the job (no dupes)", () => {
    fillCube(5);
    const { p, ev } = setup(pick(100));
    startVein(ev);
    p.container.slots[0] = pick(100); // fresh tool: damage 0 ≠ 32
    system.advance(5);
    expect(destroys()).toHaveLength(32);
  });

  it("turning the setting OFF mid-job stops it", () => {
    fillCube(5);
    const { ev } = setup(pick(100));
    startVein(ev);
    customOff();
    system.advance(5);
    expect(destroys()).toHaveLength(32);
  });

  it("creative breaks with replace: no drops, no durability", () => {
    fillCube(3);
    const { p, ev } = setup(pick(100), GameMode.Creative);
    startVein(ev);
    system.advance(3);
    const cmds = overworld().commands;
    expect(cmds).toHaveLength(26);
    expect(cmds.every((c) => c.endsWith("air replace"))).toBe(true);
    expect(overworld().getEntities({ type: "minecraft:item" })).toHaveLength(0);
    expect(damageOf(p)).toBe(0);
    expect(p.container.writes).toHaveLength(0);
  });

  it("spectators never vein-mine", () => {
    fillCube(3);
    const { ev } = setup(pick(100), GameMode.Spectator);
    startVein(ev);
    expect(overworld().commands).toEqual([]);
  });

  it("does nothing when the tool broke on the real break", () => {
    fillCube(3);
    const tool = pick(100);
    const p = makePlayer({ inv: {} });
    startVein(makeBreakEvent(p, STONE, { location: ORIGIN, itemBefore: tool }));
    expect(overworld().commands).toEqual([]);
  });

  it("vein breaks never emit playerBreakBlock (no Enchantaholic rolls, no recursion)", () => {
    fillCube(5);
    registerCustomBreak();
    const seen = vi.fn();
    world.afterEvents.playerBreakBlock.subscribe(seen);
    const { p, ev } = setup(pick(100));
    const other = withCustoms("minecraft:stick", { chicken_rain: 1 });
    p.container.slots[5] = other;
    world.afterEvents.playerBreakBlock.emit(ev);
    system.advance(10);
    expect(destroys()).toHaveLength(124);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(p.container.peek(5)?.getLore()).toEqual(other.getLore());
  });

  it("caps concurrent jobs at 8", () => {
    fillCube(5);
    for (let i = 0; i < 12; i++) {
      const tool = pick(100, { max: 100000, damage: 0 });
      const p = makePlayer({ inv: { 0: tool } });
      // Separate far-away veins so every job has work left after its first batch.
      const base = { x: 1000 * (i + 1), y: 64, z: 0 };
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) for (let z = 0; z < 5; z++) {
        overworld().setBlock({ x: base.x + x, y: 64 + y, z }, STONE);
      }
      startVein(makeBreakEvent(p, STONE, { location: base, itemBefore: tool.clone(), itemAfter: tool.clone() }));
    }
    expect(_jobs()).toHaveLength(8);
  });
});
