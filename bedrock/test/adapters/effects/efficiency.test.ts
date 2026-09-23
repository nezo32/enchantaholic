import { beforeEach, describe, expect, it } from "vitest";
import { efficiencyTick, startEfficiencyLoop } from "../../../src/adapters/effects/efficiency";
import { asPlayer, makePlayer } from "../../fakes/builders";
import { GameMode, system, world, type FakePlayer } from "../../fakes/minecraft-server";
import { overcapped, resetAll } from "../helpers";

const pick = (trueLevel: number) => overcapped("minecraft:diamond_pickaxe", "minecraft:efficiency", 5, trueLevel);
const tick = (...ps: FakePlayer[]) => efficiencyTick(ps.map(asPlayer));

describe("efficiency overcap", () => {
  beforeEach(() => void resetAll());

  it("Efficiency true-VII in the main hand gives Haste amp 1 for 60 ticks without particles", () => {
    const p = makePlayer({ selected: 1, inv: { 1: pick(7) } });
    tick(p);
    expect(p.addedEffects).toEqual([
      { id: "minecraft:haste", duration: 60, options: { amplifier: 1, showParticles: false } },
    ]);
  });

  it("does not downgrade a stronger existing Haste (beacon)", () => {
    const p = makePlayer({ selected: 0, inv: { 0: pick(6) } });
    p.addEffect("minecraft:haste", 200, { amplifier: 1 });
    p.addedEffects.length = 0;
    tick(p);
    expect(p.addedEffects).toHaveLength(0);
  });

  it("refreshes its own effect once it runs low", () => {
    const p = makePlayer({ selected: 0, inv: { 0: pick(6) } });
    p.addEffect("minecraft:haste", 40, { amplifier: 0 });
    p.addedEffects.length = 0;
    tick(p);
    expect(p.addedEffects).toHaveLength(1);
  });

  it("skips spectators, empty hands and items without overcap", () => {
    const spectator = makePlayer({ gameMode: GameMode.Spectator, inv: { 0: pick(9) } });
    const empty = makePlayer();
    const plain = makePlayer({ inv: { 0: pick(5) } });
    plain.container.slots[0]!.props.clear();
    plain.container.slots[0]!.lore = [];
    tick(spectator, empty, plain);
    expect([spectator, empty, plain].flatMap((p) => p.addedEffects)).toEqual([]);
  });

  it("the loop runs every 20 ticks over all players", () => {
    const p = makePlayer({ inv: { 0: pick(8) } });
    world.players = [p];
    startEfficiencyLoop();
    expect(system.intervals[0]?.ticks).toBe(20);
    system.tickIntervals(1);
    expect(p.addedEffects[0]?.options).toEqual({ amplifier: 2, showParticles: false });
  });
});
