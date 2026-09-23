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

  it("worldLoad wires the enchanter, the hurt dispatcher, arrow tracking and one interval", () => {
    world.afterEvents.worldLoad.emit({});
    expect(world.afterEvents.playerBreakBlock.count).toBe(1);
    expect(world.beforeEvents.entityHurt.count).toBe(1);
    expect(world.afterEvents.entitySpawn!.count).toBe(1);
    expect(world.afterEvents.entityRemove!.count).toBe(1);
    expect(system.intervals).toHaveLength(1);
    expect(system.intervals[0]?.ticks).toBe(20);
  });
});
