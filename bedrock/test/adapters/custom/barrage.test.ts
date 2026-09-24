import { beforeEach, describe, expect, it } from "vitest";
import { _copies } from "../../../src/adapters/custom/copies";
import { _trackedKaboom } from "../../../src/adapters/custom/kaboom";
import { registerProjectiles } from "../../../src/adapters/custom/projectile-dispatch";
import { registerShotSnapshots, SNAPSHOT_TICKS } from "../../../src/adapters/custom/shots";
import { COPY_LIFETIME_TICKS, COPY_TAG, MAX_TRACKED_COPIES } from "../../../src/core/custom/tuning";
import { COMPAT, makeEntity, makePlayer, makeProjectileHit } from "../../fakes/builders";
import {
  EntityComponentTypes,
  EntityInitializationCause,
  FakeEntity,
  FakeProjectileComponent,
  system,
  world,
  type FakePlayer,
} from "../../fakes/minecraft-server";
import { customOff, customOn, launch, live, overworld, projectileOf, resetCustom, withCustoms } from "./fx";

const ARROW = "minecraft:arrow";
const bowWith = (levels: { barrage?: number; kaboom?: number }) =>
  withCustoms("minecraft:bow", levels, { enchantable: COMPAT.bow });

function archer(levels: { barrage?: number; kaboom?: number }, where: "main" | "off" = "main"): FakePlayer {
  const bow = bowWith(levels);
  return where === "main" ? makePlayer({ inv: { 0: bow } }) : makePlayer({ equip: { Offhand: bow } });
}

const copiesOf = (original: FakeEntity, type = ARROW): FakeEntity[] =>
  overworld().entities.filter((e) => e !== original && e.typeId === type);

describe("barrage", () => {
  let warn: ReturnType<typeof resetCustom>;
  beforeEach(() => {
    warn = resetCustom();
    registerProjectiles();
    registerShotSnapshots();
    customOn();
  });

  it("does nothing while Custom Enchantments are OFF", () => {
    resetCustom();
    registerProjectiles();
    const p = archer({ barrage: 5, kaboom: 5 });
    const a = launch(p);
    expect(copiesOf(a)).toHaveLength(0);
    expect(_trackedKaboom().size).toBe(0);
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(a, "block"));
    expect(overworld().explosions).toHaveLength(0);
  });

  it("L=2 fires 20 tagged copies owned by the player, each shot once at the same speed", () => {
    const p = archer({ barrage: 2 });
    const a = launch(p, ARROW, { x: 0, y: 0.5, z: 2 });
    const copies = copiesOf(a);
    // The fake emits entitySpawn synchronously for each copy: none of them made more copies.
    expect(copies).toHaveLength(20);
    const speed = Math.hypot(0, 0.5, 2);
    for (const c of copies) {
      expect(c.hasTag(COPY_TAG)).toBe(true);
      const proj = projectileOf(c);
      expect(proj.owner).toBe(p);
      expect(proj.shots).toHaveLength(1);
      const v = proj.shots[0]?.velocity ?? { x: 0, y: 0, z: 0 };
      expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(speed, 9);
    }
    expect(a.hasTag(COPY_TAG)).toBe(false);
  });

  it("caps at 64 copies (L=10)", () => {
    const a = launch(archer({ barrage: 10 }));
    expect(copiesOf(a)).toHaveLength(64);
  });

  it("works with the launcher in the off hand", () => {
    const a = launch(archer({ barrage: 1 }, "off"));
    expect(copiesOf(a)).toHaveLength(10);
  });

  it("copies are removed on impact", () => {
    const a = launch(archer({ barrage: 1 }));
    const [c1, c2] = copiesOf(a);
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(c1 as FakeEntity, "block"));
    world.afterEvents.projectileHitEntity.emit(makeProjectileHit(c2 as FakeEntity, "entity"));
    expect(c1?.isValid).toBe(false);
    expect(c2?.isValid).toBe(false);
    expect(a.isValid).toBe(true); // the real arrow is untouched
    expect(_copies().has((c1 as FakeEntity).id)).toBe(false);
  });

  it("copies that hit nothing are removed after 200 ticks", () => {
    const a = launch(archer({ barrage: 1 }));
    system.advance(199);
    expect(live(ARROW)).toHaveLength(11);
    system.advance(1);
    expect(live(ARROW)).toEqual([a]);
    expect(_copies().size).toBe(0);
  });

  it("a trident thrown from an empty hand uses the item-use snapshot (Kaboom; tridents are never copied)", () => {
    const trident = withCustoms("minecraft:trident", { barrage: 1, kaboom: 2 });
    const p = makePlayer({ inv: { 0: trident } });
    world.afterEvents.itemStartUse.emit({ source: p, itemStack: trident.clone(), useDuration: 72000 });
    world.afterEvents.itemReleaseUse.emit({ source: p, itemStack: trident.clone(), useDuration: 100 });
    p.container.slots[0] = undefined; // the trident left the hand
    const t = launch(p, "minecraft:thrown_trident");
    expect(_trackedKaboom().get(t.id)?.power).toBe(2);
    // thrown_trident is not summonable: no copy attempt, so no content-log warning either.
    expect(copiesOf(t, "minecraft:thrown_trident")).toHaveLength(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it("a stale snapshot is ignored", () => {
    const trident = withCustoms("minecraft:trident", { kaboom: 2 });
    const p = makePlayer({ inv: {} });
    world.afterEvents.itemReleaseUse.emit({ source: p, itemStack: trident, useDuration: 100 });
    system.advance(SNAPSHOT_TICKS + 1);
    const t = launch(p, "minecraft:thrown_trident");
    expect(_trackedKaboom().has(t.id)).toBe(false);
  });

  it("never more than MAX_TRACKED_COPIES live copies, however fast the player shoots", () => {
    const p = archer({ barrage: 10 });
    for (let i = 0; i < 20; i++) launch(p);
    expect(live(ARROW).filter((e) => e.hasTag(COPY_TAG))).toHaveLength(MAX_TRACKED_COPIES);
    expect(_copies().size).toBe(MAX_TRACKED_COPIES);
    system.advance(COPY_LIFETIME_TICKS); // they expire, the budget frees up
    launch(p);
    expect(live(ARROW).filter((e) => e.hasTag(COPY_TAG))).toHaveLength(64);
  });

  it("entities loaded from disk: never copied, and saved copies are removed (no pickup dupe)", () => {
    const p = archer({ barrage: 2, kaboom: 2 });
    // A player arrow stuck in the ground, loaded again while the player holds the bow.
    const stuck = new FakeEntity(ARROW);
    const proj = new FakeProjectileComponent(stuck);
    proj.owner = p;
    stuck.components.set(EntityComponentTypes.Projectile, proj);
    overworld().addEntity(stuck, { x: 3, y: 64, z: 3 });
    world.afterEvents.entitySpawn.emit({ entity: stuck, cause: EntityInitializationCause.Loaded });
    expect(copiesOf(stuck)).toHaveLength(0);
    expect(stuck.isValid).toBe(true);

    // A copy that was unloaded mid-flight (timeout could not reach it) comes back with its tag.
    for (const signal of ["spawn", "load"] as const) {
      const saved = overworld().addEntity(new FakeEntity(ARROW), { x: 9, y: 64, z: 9 });
      saved.addTag(COPY_TAG);
      if (signal === "spawn") world.afterEvents.entitySpawn.emit({ entity: saved, cause: EntityInitializationCause.Loaded });
      else world.afterEvents.entityLoad.emit({ entity: saved });
      expect(saved.isValid).toBe(false);
    }
    // Stale-copy cleanup does not depend on the setting.
    customOff();
    const saved = overworld().addEntity(new FakeEntity(ARROW), { x: 9, y: 64, z: 9 });
    saved.addTag(COPY_TAG);
    world.afterEvents.entityLoad.emit({ entity: saved });
    expect(saved.isValid).toBe(false);
  });

  it("snowballs and eggs: the thrown item's own levels count", () => {
    const p = makePlayer({ inv: { 0: withCustoms("minecraft:snowball", { barrage: 1 }, { amount: 16 }) } });
    const s = launch(p, "minecraft:snowball");
    expect(copiesOf(s, "minecraft:snowball")).toHaveLength(10);
  });

  it("ignores ender pearls, launchers of other projectiles, and non-player owners", () => {
    const p = archer({ barrage: 3 });
    const pearl = launch(p, "minecraft:ender_pearl");
    expect(copiesOf(pearl, "minecraft:ender_pearl")).toHaveLength(0);
    const snow = launch(p, "minecraft:snowball"); // held bow does not launch snowballs
    expect(copiesOf(snow, "minecraft:snowball")).toHaveLength(0);
    launch(makeEntity("minecraft:skeleton", ["skeleton", "mob"]));
    launch(undefined);
    expect(overworld().entities).toHaveLength(4);
    expect(overworld().entities.some((e) => e.hasTag(COPY_TAG))).toBe(false);
  });
});

describe("kaboom", () => {
  beforeEach(() => {
    resetCustom();
    registerProjectiles();
    customOn();
  });

  it("a tracked projectile explodes once, without block damage or fire, and is removed", () => {
    const p = archer({ kaboom: 4 });
    const a = launch(p);
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(a, "block", { x: 5, y: 64, z: 5 }));
    const ex = overworld().explosions;
    expect(ex).toHaveLength(1);
    expect(ex[0]?.radius).toBe(3);
    expect(ex[0]?.location).toEqual({ x: 5, y: 64, z: 5 });
    expect(ex[0]?.options).toMatchObject({ breaksBlocks: false, causesFire: false, allowUnderwater: false, source: p });
    expect(a.isValid).toBe(false);
  });

  it("power is capped at 8", () => {
    const a = launch(archer({ kaboom: 20 }));
    world.afterEvents.projectileHitEntity.emit(makeProjectileHit(a, "entity"));
    expect(overworld().explosions[0]?.radius).toBe(8);
  });

  it("an untracked projectile causes no explosion", () => {
    const a = launch(archer({}));
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(a, "block"));
    expect(overworld().explosions).toHaveLength(0);
    expect(a.isValid).toBe(true);
  });

  it("at most 16 explosions per tick", () => {
    const p = archer({ kaboom: 1 });
    const arrows = Array.from({ length: 17 }, () => launch(p));
    for (const a of arrows) world.afterEvents.projectileHitBlock.emit(makeProjectileHit(a, "block"));
    expect(overworld().explosions).toHaveLength(16);
    system.advance(1);
    const late = launch(p);
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(late, "block"));
    expect(overworld().explosions).toHaveLength(17);
  });

  it("barrage copies of a kaboom launcher explode too", () => {
    const a = launch(archer({ kaboom: 2, barrage: 1 }));
    for (const c of copiesOf(a)) world.afterEvents.projectileHitBlock.emit(makeProjectileHit(c, "block"));
    expect(overworld().explosions).toHaveLength(10);
    expect(copiesOf(a).every((c) => !c.isValid)).toBe(true);
  });

  it("a real trident explodes but is never deleted", () => {
    const p = makePlayer({ inv: { 0: withCustoms("minecraft:trident", { kaboom: 2 }) } });
    const t = launch(p, "minecraft:thrown_trident");
    world.afterEvents.projectileHitEntity.emit(makeProjectileHit(t, "entity"));
    expect(overworld().explosions).toHaveLength(1);
    expect(t.isValid).toBe(true);
  });

  it("turning the setting OFF stops explosions but copies are still cleaned up", () => {
    const a = launch(archer({ kaboom: 2, barrage: 1 }));
    const [c] = copiesOf(a);
    customOff();
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(c as FakeEntity, "block"));
    world.afterEvents.projectileHitBlock.emit(makeProjectileHit(a, "block"));
    expect(overworld().explosions).toHaveLength(0);
    expect(c?.isValid).toBe(false);
  });

  it("entityRemove forgets tracked ids", () => {
    const a = launch(archer({ kaboom: 2 }));
    expect(_trackedKaboom().has(a.id)).toBe(true);
    a.remove();
    expect(_trackedKaboom().has(a.id)).toBe(false);
  });
});
