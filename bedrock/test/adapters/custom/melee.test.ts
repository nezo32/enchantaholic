import { beforeEach, describe, expect, it } from "vitest";
import { onCustomHit } from "../../../src/adapters/custom/hit-dispatch";
import { yeet } from "../../../src/adapters/custom/yeet";
import { COMPAT, makeHitEvent, makePlayer, zombie } from "../../fakes/builders";
import { asReal, FakePlayer, GameMode, system } from "../../fakes/minecraft-server";
import type * as mc from "@minecraft/server";
import { customOn, overworld, resetCustom, withCustoms } from "./fx";

const yeetSword = (level: number) => withCustoms("minecraft:diamond_sword", { yeet: level }, { enchantable: COMPAT.sword });

describe("yeet", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  it("does nothing while Custom Enchantments are OFF", () => {
    resetCustom();
    const p = makePlayer({ inv: { 0: yeetSword(3) } });
    const z = overworld().addEntity(zombie(), { x: 3, y: 64, z: 4 });
    onCustomHit(makeHitEvent(p, z));
    system.advance(2);
    expect(z.knockbacks).toHaveLength(0);
    expect(z.impulses).toHaveLength(0);
  });

  it("knocks a mob up and away one tick after the hit", () => {
    const p = overworld().addEntity(makePlayer({ inv: { 0: yeetSword(2) } }), { x: 0, y: 64, z: 0 });
    const z = overworld().addEntity(zombie(), { x: 3, y: 64, z: 4 });
    onCustomHit(makeHitEvent(p, z));
    expect(z.knockbacks).toHaveLength(0);
    system.advance(1);
    expect(z.knockbacks).toHaveLength(1);
    const kb = z.knockbacks[0];
    expect(kb?.h.x).toBeCloseTo(0.6 * 1.6);
    expect(kb?.h.z).toBeCloseTo(0.8 * 1.6);
    expect(kb?.v).toBeCloseTo(1.1);
  });

  it("caps the force", () => {
    const p = makePlayer({ inv: { 0: yeetSword(1000) } });
    const z = overworld().addEntity(zombie(), { x: 0, y: 64, z: 5 });
    yeet(asReal<mc.Player>(p), asReal<mc.Entity>(z));
    system.advance(1);
    expect(z.knockbacks[0]).toEqual({ h: { x: 0, z: 4 }, v: 3 });
  });

  it("a player target gets knockback and never applyImpulse", () => {
    const p = makePlayer({ inv: { 0: yeetSword(2) } });
    const victim = overworld().addEntity(new FakePlayer("Alex"), { x: 2, y: 64, z: 0 });
    onCustomHit(makeHitEvent(p, victim));
    system.advance(1);
    expect(victim.knockbacks).toHaveLength(1);
    expect(victim.impulses).toHaveLength(0);
  });

  it("falls back to applyImpulse for a mob that rejects knockback", () => {
    const p = makePlayer({ inv: { 0: yeetSword(1) } });
    const z = overworld().addEntity(zombie(), { x: 1, y: 64, z: 0 });
    z.applyKnockback = () => {
      throw new Error("no knockback");
    };
    onCustomHit(makeHitEvent(p, z));
    system.advance(1);
    expect(z.impulses).toHaveLength(1);
    expect(z.impulses[0]?.y).toBeCloseTo(0.8);
  });

  it("only player attackers, never spectators", () => {
    const z1 = zombie();
    const z2 = overworld().addEntity(zombie());
    onCustomHit(makeHitEvent(z1, z2));
    const spec = makePlayer({ inv: { 0: yeetSword(2) }, gameMode: GameMode.Spectator });
    onCustomHit(makeHitEvent(spec, z2));
    system.advance(2);
    expect(z2.knockbacks).toHaveLength(0);
  });

  it("does nothing without the enchant", () => {
    const p = makePlayer({ inv: { 0: withCustoms("minecraft:diamond_sword", { magnet: 2 }) } });
    const z = overworld().addEntity(zombie());
    onCustomHit(makeHitEvent(p, z));
    system.advance(2);
    expect(z.knockbacks).toHaveLength(0);
  });
});
