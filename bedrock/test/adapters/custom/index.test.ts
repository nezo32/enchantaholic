import { beforeEach, describe, expect, it } from "vitest";
import { registerCustomEffects } from "../../../src/adapters/custom";
import {
  COMPAT,
  makeBreakEvent,
  makeDieEvent,
  makeHitEvent,
  makeHurtEvent,
  makePlayer,
  makeProjectileHit,
  zombie,
} from "../../fakes/builders";
import { EntityDamageCause, FakeEntity, system, world } from "../../fakes/minecraft-server";
import { launch, overworld, resetCustom, withCustoms } from "./fx";

describe("registerCustomEffects", () => {
  beforeEach(() => {
    resetCustom();
  });

  it("subscribes each signal once and starts the three loops", () => {
    registerCustomEffects();
    expect(world.afterEvents.playerBreakBlock.count).toBe(1);
    expect(world.afterEvents.entityHitEntity.count).toBe(1);
    expect(world.afterEvents.entitySpawn.count).toBe(1);
    expect(world.afterEvents.entityRemove.count).toBe(1);
    expect(world.afterEvents.projectileHitBlock.count).toBe(1);
    expect(world.afterEvents.projectileHitEntity.count).toBe(1);
    expect(world.afterEvents.entityDie.count).toBe(1);
    expect(world.afterEvents.itemStartUse.count).toBe(1);
    expect(world.afterEvents.itemUse.count).toBe(1);
    expect(world.afterEvents.itemReleaseUse.count).toBe(1);
    expect(world.afterEvents.itemStopUse.count).toBe(1);
    expect(world.beforeEvents.entityHurt.count).toBe(1);
    expect(system.intervals.map((i) => i.ticks)).toEqual([10, 10, 200]);
  });

  it("with the setting OFF (default), every effect is inert", () => {
    registerCustomEffects();
    const all = {
      vein_miner: 10,
      barrage: 10,
      yeet: 10,
      kaboom: 10,
      party_popper: 10,
      chicken_rain: 100,
      midas_touch: 100,
      magnet: 10,
      moon_boots: 10,
      butterfingers: 100,
      hiccups: 100,
    };
    const everything = () => withCustoms("minecraft:bow", all, { enchantable: COMPAT.bow });
    const p = overworld().addEntity(
      makePlayer({ inv: { 0: everything(), 5: everything() }, equip: { Feet: everything(), Offhand: everything() } }),
      { x: 0, y: 64, z: 0 },
    );
    world.players.push(p);
    const dim = overworld();
    dim.setBlock({ x: 1, y: 64, z: 0 }, "minecraft:stone");
    const item = dim.addEntity(new FakeEntity("minecraft:item"), { x: 3, y: 64, z: 0 });
    const z = dim.addEntity(zombie(), { x: 2, y: 64, z: 0 });
    const before = dim.entities.length;

    const tool = p.container.getItem(0);
    world.afterEvents.playerBreakBlock.emit(
      makeBreakEvent(p, "minecraft:stone", { location: { x: 0, y: 64, z: 0 }, itemBefore: tool, itemAfter: tool?.clone() }),
    );
    world.afterEvents.entityHitEntity.emit(makeHitEvent(p, z));
    const arrow = launch(p);
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(arrow, "block"));
    world.afterEvents.entityDie.emit(makeDieEvent(z, p));
    const fall = makeHurtEvent({ victim: p, damage: 10, cause: EntityDamageCause.fall });
    world.beforeEvents.entityHurt.emit(fall);
    system.advance(400);

    expect(dim.commands).toEqual([]);
    expect(dim.explosions).toEqual([]);
    expect(dim.particles).toEqual([]);
    expect(dim.sounds).toEqual([]);
    expect(dim.entities).toHaveLength(before + 1); // only the test's own arrow
    expect(z.knockbacks).toEqual([]);
    expect(z.impulses).toEqual([]);
    expect(item.impulses).toEqual([]);
    expect(p.knockbacks).toEqual([]);
    expect(p.addedEffects).toEqual([]);
    expect(p.sounds).toEqual([]);
    expect(p.container.peek(0)).toBeDefined();
    expect(p.container.writes).toEqual([]);
    expect(fall.cancel).toBe(false);
  });
});
