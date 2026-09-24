import type * as mc from "@minecraft/server";
import { beforeEach, describe, expect, it } from "vitest";
import { hiccupTick } from "../../../src/adapters/custom/hiccups";
import { magnetTick } from "../../../src/adapters/custom/magnet";
import { moonTick, registerMoonFallGuard, shouldCancelFall } from "../../../src/adapters/custom/moon-boots";
import { onEntityDie, registerPartyPopper } from "../../../src/adapters/custom/party-popper";
import { FUMBLE_TAG } from "../../../src/core/custom/tuning";
import { COMPAT, makeDieEvent, makeEntity, makeHurtEvent, makePlayer, zombie } from "../../fakes/builders";
import {
  asReal,
  EntityDamageCause,
  FakeEntity,
  GameMode,
  system,
  world,
  type FakePlayer,
} from "../../fakes/minecraft-server";
import { customOn, live, overworld, resetCustom, withCustoms } from "./fx";

const players = (...ps: FakePlayer[]): mc.Player[] => ps.map((p) => asReal<mc.Player>(p));
const hurt = (e: ReturnType<typeof makeHurtEvent>) => asReal<mc.EntityHurtBeforeEvent>(e);

describe("party popper", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  const popper = (level: number) =>
    makePlayer({ inv: { 0: withCustoms("minecraft:diamond_sword", { party_popper: level }, { enchantable: COMPAT.sword }) } });

  it("OFF → no rockets", () => {
    resetCustom();
    registerPartyPopper();
    world.afterEvents.entityDie.emit(makeDieEvent(overworld().addEntity(zombie()), popper(5)));
    system.advance(40);
    expect(live("minecraft:fireworks_rocket")).toHaveLength(0);
    expect(overworld().sounds).toHaveLength(0);
  });

  it("L=20 → 16 rockets over 32 ticks, one burst of particles and a sound", () => {
    registerPartyPopper();
    const z = overworld().addEntity(zombie(), { x: 10, y: 64, z: 10 });
    world.afterEvents.entityDie.emit(makeDieEvent(z, popper(20)));
    expect(live("minecraft:fireworks_rocket")).toHaveLength(1);
    system.advance(32);
    const rockets = live("minecraft:fireworks_rocket");
    expect(rockets).toHaveLength(16);
    expect(rockets[0]?.location).toEqual({ x: 10, y: 64.5, z: 10 });
    expect(overworld().sounds.map((s) => s.id)).toEqual(["firework.blast"]);
    expect(overworld().particles).toHaveLength(8);
  });

  it("L=3 → 3 rockets", () => {
    onEntityDie(makeDieEvent(overworld().addEntity(zombie()), popper(3)));
    system.advance(40);
    expect(live("minecraft:fireworks_rocket")).toHaveLength(3);
  });

  it("a kill by a non-player (or with no killer) does nothing", () => {
    onEntityDie(makeDieEvent(overworld().addEntity(zombie()), zombie()));
    onEntityDie(makeDieEvent(overworld().addEntity(zombie())));
    system.advance(40);
    expect(live("minecraft:fireworks_rocket")).toHaveLength(0);
  });
});

describe("magnet", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  const item = (at: { x: number; y: number; z: number }, type = "minecraft:item"): FakeEntity =>
    overworld().addEntity(new FakeEntity(type), at);
  const magnetPlayer = (level: number) =>
    overworld().addEntity(makePlayer({ inv: { 0: withCustoms("minecraft:stick", { magnet: level }) } }), { x: 0, y: 64, z: 0 });

  it("OFF → nothing moves", () => {
    resetCustom();
    const p = magnetPlayer(2);
    const e = item({ x: 4, y: 64, z: 0 });
    magnetTick(players(p));
    expect(e.impulses).toHaveLength(0);
  });

  it("pulls items and XP within 3 + L toward the player, not beyond, not when already close", () => {
    const p = magnetPlayer(2); // radius 5
    const inside = item({ x: 4, y: 64, z: 0 });
    const orb = item({ x: 0, y: 64, z: -4.5 }, "minecraft:xp_orb");
    const outside = item({ x: 6, y: 64, z: 0 });
    const close = item({ x: 1, y: 64, z: 0 });
    magnetTick(players(p));
    expect(inside.impulses).toHaveLength(1);
    expect(inside.impulses[0]?.x).toBeCloseTo(-0.6);
    expect(orb.impulses[0]?.z).toBeCloseTo(0.6);
    expect(outside.impulses).toHaveLength(0);
    expect(close.impulses).toHaveLength(0);
  });

  it("works worn or in the off hand", () => {
    const worn = overworld().addEntity(
      makePlayer({ equip: { Feet: withCustoms("minecraft:diamond_boots", { magnet: 1 }) } }),
      { x: 100, y: 64, z: 0 },
    );
    const off = overworld().addEntity(
      makePlayer({ equip: { Offhand: withCustoms("minecraft:stick", { magnet: 1 }) } }),
      { x: 200, y: 64, z: 0 },
    );
    const a = item({ x: 103, y: 64, z: 0 });
    const b = item({ x: 203, y: 64, z: 0 });
    magnetTick(players(worn, off));
    expect(a.impulses).toHaveLength(1);
    expect(b.impulses).toHaveLength(1);
  });

  it("skips fumbled items and handles at most 64 per player", () => {
    const p = magnetPlayer(5);
    const fumbled = item({ x: 3, y: 64, z: 0 });
    fumbled.tags.add(FUMBLE_TAG);
    const many = Array.from({ length: 100 }, (_, i) => item({ x: 3, y: 64, z: (i % 10) * 0.1 }));
    magnetTick(players(p));
    expect(fumbled.impulses).toHaveLength(0);
    expect(many.filter((e) => e.impulses.length > 0)).toHaveLength(64);
  });

  it("falls back to teleport when the impulse is rejected", () => {
    const p = magnetPlayer(2);
    const e = item({ x: 4, y: 64, z: 0 });
    e.applyImpulse = () => {
      throw new Error("unsupported");
    };
    magnetTick(players(p));
    expect(e.teleports).toEqual([{ x: 0, y: 64, z: 0 }]);
  });

  it("spectators do not pull", () => {
    const p = magnetPlayer(2);
    p.gameMode = GameMode.Spectator;
    const e = item({ x: 4, y: 64, z: 0 });
    magnetTick(players(p));
    expect(e.impulses).toHaveLength(0);
  });
});

describe("moon boots", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  const moon = (level: number) =>
    makePlayer({ equip: { Feet: withCustoms("minecraft:diamond_boots", { moon_boots: level }, { enchantable: COMPAT.boots }) } });

  it("OFF → no Jump Boost and fall damage is not cancelled", () => {
    resetCustom();
    const p = moon(5);
    moonTick(players(p));
    expect(p.addedEffects).toHaveLength(0);
    expect(shouldCancelFall(hurt(makeHurtEvent({ victim: p, damage: 10, cause: EntityDamageCause.fall })))).toBe(false);
  });

  it("gives Jump Boost min(L-1, 10)", () => {
    const a = moon(5);
    const b = moon(50);
    moonTick(players(a, b));
    expect(a.getEffect("minecraft:jump_boost")?.amplifier).toBe(4);
    expect(b.getEffect("minecraft:jump_boost")?.amplifier).toBe(10);
    expect(a.addedEffects[0]).toMatchObject({ duration: 30, options: { amplifier: 4, showParticles: false } });
  });

  it("never downgrades a stronger Jump Boost (beacon/potion)", () => {
    const p = moon(3);
    p.addEffect("minecraft:jump_boost", 600, { amplifier: 5 });
    p.addedEffects.length = 0;
    moonTick(players(p));
    expect(p.addedEffects).toHaveLength(0);
    expect(p.getEffect("minecraft:jump_boost")?.amplifier).toBe(5);
  });

  it("cancels fall damage only with the boots worn and the setting ON", () => {
    registerMoonFallGuard();
    const worn = makeHurtEvent({ victim: moon(1), damage: 20, cause: EntityDamageCause.fall });
    world.beforeEvents.entityHurt.emit(worn); // restricted execution, like the engine
    expect(worn.cancel).toBe(true);

    const bare = makeHurtEvent({ victim: makePlayer(), damage: 20, cause: EntityDamageCause.fall });
    world.beforeEvents.entityHurt.emit(bare);
    expect(bare.cancel).toBe(false);

    const held = makeHurtEvent({
      victim: makePlayer({ inv: { 0: withCustoms("minecraft:diamond_boots", { moon_boots: 3 }) } }),
      damage: 20,
      cause: EntityDamageCause.fall,
    });
    world.beforeEvents.entityHurt.emit(held);
    expect(held.cancel).toBe(false);

    const other = makeHurtEvent({ victim: moon(1), damage: 5, cause: EntityDamageCause.entityAttack });
    world.beforeEvents.entityHurt.emit(other);
    expect(other.cancel).toBe(false);

    const mob = makeHurtEvent({ victim: makeEntity("minecraft:zombie"), damage: 5, cause: EntityDamageCause.fall });
    expect(shouldCancelFall(hurt(mob))).toBe(false);
  });
});

describe("curse of hiccups", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  const hiccupy = () => makePlayer({ inv: { 7: withCustoms("minecraft:dirt", { hiccups: 20 }, { amount: 64 }) } });

  it("OFF → no hop", () => {
    resetCustom();
    const p = hiccupy();
    hiccupTick(players(p), () => 0);
    expect(p.knockbacks).toHaveLength(0);
  });

  it("anywhere in the inventory: a hop with knockback (never applyImpulse), a burp and particles", () => {
    const p = hiccupy();
    hiccupTick(players(p), () => 0);
    expect(p.knockbacks).toEqual([{ h: { x: 0, z: 0 }, v: 0.35 }]);
    expect(p.impulses).toHaveLength(0);
    expect(p.sounds).toEqual([{ soundId: "random.burp", options: { pitch: 1.6 } }]);
    expect(overworld().particles.map((x) => x.id)).toEqual(["minecraft:villager_angry"]);
  });

  it("a failed roll does nothing; the chance caps at 60 %", () => {
    const p = hiccupy();
    hiccupTick(players(p), () => 0.6); // L=20 → 60 %
    const q = makePlayer({ inv: { 0: withCustoms("minecraft:stick", { hiccups: 1000 }) } });
    hiccupTick(players(q), () => 0.6);
    expect(p.knockbacks).toHaveLength(0);
    expect(q.knockbacks).toHaveLength(0);
  });

  it("falls back to Levitation when knockback is rejected", () => {
    const p = hiccupy();
    p.applyKnockback = () => {
      throw new Error("nope");
    };
    hiccupTick(players(p), () => 0);
    expect(p.getEffect("minecraft:levitation")?.duration).toBe(4);
  });
});
