import { beforeEach, describe, expect, it } from "vitest";
import {
  _trackedShots,
  MAX_TRACKED_ARROWS,
  powerModifier,
  recordShot,
  registerPowerTracking,
} from "../../../src/adapters/effects/power";
import { arrow, asEntity, bow, dirt, makeEntity, makePlayer, trident } from "../../fakes/builders";
import { EntityComponentTypes, world, type FakeEntity, type FakePlayer } from "../../fakes/minecraft-server";
import { overcapped, resetAll } from "../helpers";
import { hurt } from "./fx-helpers";

const skeleton = () => makeEntity("minecraft:skeleton", ["skeleton", "undead", "monster", "mob"]);
const powerBow = (trueLevel: number) => overcapped("minecraft:bow", "minecraft:power", 5, trueLevel);

function shotBy(owner: FakeEntity | undefined): FakeEntity {
  const a = arrow();
  a.components.set(EntityComponentTypes.Projectile, { owner });
  return a;
}

const shoot = (p: FakePlayer, a: FakeEntity, damage = 10) =>
  hurt([powerModifier], { victim: skeleton(), attacker: p, projectile: a, damage, cause: "projectile" });

describe("power overcap", () => {
  beforeEach(() => void resetAll());

  it("Power true-VII bow in the main hand gives ×1.2 (impact-time fallback)", () => {
    const p = makePlayer({ selected: 0, inv: { 0: powerBow(7) } });
    expect(shoot(p, arrow())).toBeCloseTo(12);
  });

  it("uses an offhand bow when the main hand is not a bow", () => {
    const p = makePlayer({ selected: 0, inv: { 0: dirt() }, equip: { Offhand: powerBow(6) } });
    expect(shoot(p, arrow())).toBeCloseTo(11);
  });

  it("does not touch tridents, melee or non-player shooters", () => {
    const p = makePlayer({ selected: 0, inv: { 0: powerBow(7) } });
    const t = makeEntity("minecraft:thrown_trident");
    expect(shoot(p, t)).toBe(10);
    expect(hurt([powerModifier], { victim: skeleton(), attacker: p, damage: 10 })).toBe(10);
    expect(
      hurt([powerModifier], { victim: p, attacker: makeEntity("minecraft:skeleton"), projectile: arrow(), damage: 3, cause: "projectile" }),
    ).toBe(3);
    const p2 = makePlayer({ selected: 0, inv: { 0: trident() } });
    expect(shoot(p2, arrow())).toBe(10);
  });

  it("records the bow's overcap when the arrow spawns and uses it at impact", () => {
    registerPowerTracking();
    const p = makePlayer({ selected: 0, inv: { 0: powerBow(8) } });
    const a = shotBy(p);
    world.afterEvents.entitySpawn!.emit({ entity: a, cause: "Spawned" });
    expect(_trackedShots().get(a.id)).toBe(3);
    p.container.slots[0] = dirt(); // switched items mid-flight
    expect(shoot(p, a)).toBeCloseTo(13);
  });

  it("a plain-bow shot stays plain even if an overcapped bow is held at impact", () => {
    registerPowerTracking();
    const p = makePlayer({ selected: 0, inv: { 0: bow() } });
    const a = shotBy(p);
    world.afterEvents.entitySpawn!.emit({ entity: a, cause: "Spawned" });
    p.container.slots[0] = powerBow(9);
    expect(shoot(p, a)).toBe(10);
  });

  it("ignores non-arrows and arrows without a player owner, and forgets removed arrows", () => {
    registerPowerTracking();
    const p = makePlayer({ selected: 0, inv: { 0: powerBow(7) } });
    world.afterEvents.entitySpawn!.emit({ entity: makeEntity("minecraft:zombie") });
    world.afterEvents.entitySpawn!.emit({ entity: shotBy(makeEntity("minecraft:skeleton")) });
    world.afterEvents.entitySpawn!.emit({ entity: arrow() }); // no projectile component
    expect(_trackedShots().size).toBe(0);
    const a = shotBy(p);
    world.afterEvents.entitySpawn!.emit({ entity: a });
    expect(_trackedShots().has(a.id)).toBe(true);
    world.afterEvents.entityRemove!.emit({ removedEntityId: a.id, typeId: "minecraft:arrow" });
    expect(_trackedShots().size).toBe(0);
  });

  it("bounds the number of tracked arrows", () => {
    const p = makePlayer({ selected: 0, inv: { 0: powerBow(7) } });
    const first = shotBy(p);
    recordShot(asEntity(first));
    for (let i = 0; i < MAX_TRACKED_ARROWS + 10; i++) recordShot(asEntity(shotBy(p)));
    expect(_trackedShots().size).toBe(MAX_TRACKED_ARROWS);
    expect(_trackedShots().has(first.id)).toBe(false);
  });
});
