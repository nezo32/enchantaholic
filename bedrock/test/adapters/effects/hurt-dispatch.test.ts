import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as mc from "@minecraft/server";
import { computeDamage, registerHurtDispatch, type HurtModifier } from "../../../src/adapters/effects/hurt-dispatch";
import { cow, makeHurtEvent, makePlayer, zombie, type FakeHurtEvent } from "../../fakes/builders";
import { asReal, world } from "../../fakes/minecraft-server";
import { resetAll } from "../helpers";

const ev = (e: FakeHurtEvent) => asReal<mc.EntityHurtBeforeEvent>(e);
const mod = (name: string, fn: (d: number) => number, log?: string[]): HurtModifier => ({
  name,
  modify: (_ctx, d) => {
    log?.push(name);
    return fn(d);
  },
});

describe("hurt-dispatch", () => {
  beforeEach(() => void resetAll());

  it("takes the early exit for entity-vs-entity damage without players", () => {
    const m = mod("m", (d) => d + 1);
    const spy = vi.spyOn(m, "modify");
    expect(computeDamage(ev(makeHurtEvent({ victim: cow(), attacker: zombie(), damage: 3 })), [m])).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("runs modifiers in order and passes player attacker/victim context", () => {
    const log: string[] = [];
    const seen: unknown[] = [];
    const mods = [
      mod("a", (d) => d + 1, log),
      mod("b", (d) => d * 2, log),
      { name: "c", modify: (ctx: Parameters<HurtModifier["modify"]>[0], d: number) => (seen.push(ctx), d) },
    ];
    const p = makePlayer();
    const z = zombie();
    expect(computeDamage(ev(makeHurtEvent({ victim: z, attacker: p, damage: 3 })), mods)).toBe(8);
    expect(log).toEqual(["a", "b"]);
    expect(seen[0]).toMatchObject({ cause: "entityAttack", victim: z, attacker: p });
    // player victim hit by a mob: attacker undefined but still dispatched
    expect(computeDamage(ev(makeHurtEvent({ victim: p, attacker: z, damage: 3 })), mods)).toBe(8);
    expect(seen[1]).toMatchObject({ attacker: undefined, victim: p });
  });

  it("isolates a throwing modifier", () => {
    const mods = [
      mod("boom", () => {
        throw new Error("x");
      }),
      mod("ok", (d) => d + 2),
    ];
    expect(computeDamage(ev(makeHurtEvent({ victim: zombie(), attacker: makePlayer(), damage: 1 })), mods)).toBe(3);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("never writes NaN, Infinity or negative damage", () => {
    registerHurtDispatch([mod("nan", () => NaN), mod("neg", () => -5), mod("inf", () => Infinity)]);
    const e = makeHurtEvent({ victim: zombie(), attacker: makePlayer(), damage: 4 });
    world.beforeEvents.entityHurt.emit(e);
    expect(e.damage).toBe(4);
  });

  it("writes the modified damage through the single subscription", () => {
    registerHurtDispatch([mod("x", (d) => d + 1.5)]);
    expect(world.beforeEvents.entityHurt.count).toBe(1);
    const e = makeHurtEvent({ victim: zombie(), attacker: makePlayer(), damage: 4 });
    world.beforeEvents.entityHurt.emit(e);
    expect(e.damage).toBe(5.5);
  });
});
