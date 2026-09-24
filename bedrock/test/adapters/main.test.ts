import { beforeAll, describe, expect, it } from "vitest";
import { COMMAND_NAME } from "../../src/core/config";
import { FakeCustomCommandRegistry, resetFakes, system, world } from "../fakes/minecraft-server";

describe("main", () => {
  beforeAll(async () => {
    resetFakes();
    await import("../../src/main");
  });

  it("registers only the startup and worldLoad handlers at import time", () => {
    expect(system.beforeEvents.startup.count).toBe(1);
    expect(world.afterEvents.worldLoad.count).toBe(1);
    expect(world.afterEvents.playerBreakBlock.count).toBe(0);
    expect(system.intervals).toHaveLength(0);
  });

  it("startup registers the custom command", () => {
    const customCommandRegistry = new FakeCustomCommandRegistry();
    system.beforeEvents.startup.emit({ customCommandRegistry });
    expect(customCommandRegistry.commands.has(COMMAND_NAME)).toBe(true);
  });

  it("worldLoad wires the enchanter, the overcap effects and the custom effects", () => {
    world.afterEvents.worldLoad.emit({});
    // Enchanter + custom-effect break dispatch.
    expect(world.afterEvents.playerBreakBlock.count).toBe(2);
    // Overcap hurt dispatch + Moon Boots fall guard.
    expect(world.beforeEvents.entityHurt.count).toBe(2);
    // Power arrow tracking + Barrage/Kaboom projectile dispatch.
    expect(world.afterEvents.entitySpawn!.count).toBe(2);
    expect(world.afterEvents.entityRemove!.count).toBe(2);
    expect(world.afterEvents.entityHitEntity.count).toBe(1);
    expect(world.afterEvents.projectileHitBlock.count).toBe(1);
    expect(world.afterEvents.projectileHitEntity.count).toBe(1);
    expect(world.afterEvents.entityDie.count).toBe(1);
    // Efficiency (20), Magnet (10), Moon Boots (10), Hiccups (200); the vein loop starts lazily.
    expect(system.intervals.map((i) => i.ticks)).toEqual([20, 10, 10, 200]);
  });
});
