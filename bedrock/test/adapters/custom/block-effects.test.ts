import { beforeEach, describe, expect, it } from "vitest";
import { onCustomBreak } from "../../../src/adapters/custom/break-dispatch";
import { fumble } from "../../../src/adapters/custom/butterfingers";
import { chickenRain } from "../../../src/adapters/custom/chicken-rain";
import { midasTouch } from "../../../src/adapters/custom/midas-touch";
import { onCustomHit } from "../../../src/adapters/custom/hit-dispatch";
import { FUMBLE_TAG } from "../../../src/core/custom/tuning";
import { COMPAT, makeBreakEvent, makeEntity, makeHitEvent, makePlayer, zombie } from "../../fakes/builders";
import {
  asReal,
  EntityComponentTypes,
  GameMode,
  type FakeItemEntityComponent,
  type FakeItemStack,
  type FakePlayer,
} from "../../fakes/minecraft-server";
import type * as mc from "@minecraft/server";
import { customOn, live, overworld, resetCustom, withCustoms } from "./fx";

const AT = { x: 4, y: 70, z: -3 };
const CENTER = { x: 4.5, y: 70.5, z: -2.5 };
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)] as number;
};

function breakWith(tool: FakeItemStack, gameMode = GameMode.Survival): { p: FakePlayer; ev: mc.PlayerBreakBlockAfterEvent } {
  const p = makePlayer({ inv: { 0: tool }, gameMode });
  return { p, ev: makeBreakEvent(p, "minecraft:dirt", { location: AT, itemBefore: tool.clone(), itemAfter: tool.clone() }) };
}

const itemEntities = () => live("minecraft:item");
const itemIn = (e: { getComponent(id: string): unknown }): FakeItemStack =>
  (e.getComponent(EntityComponentTypes.Item) as FakeItemEntityComponent).itemStack;

describe("chicken rain", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  it("OFF → no chicken", () => {
    resetCustom();
    const { ev } = breakWith(withCustoms("minecraft:stick", { chicken_rain: 20 }));
    chickenRain(ev, () => 0);
    onCustomBreak(ev);
    expect(live("minecraft:chicken")).toHaveLength(0);
  });

  it("a successful roll spawns one baby chicken at the block center", () => {
    const { ev } = breakWith(withCustoms("minecraft:stick", { chicken_rain: 1 }));
    chickenRain(ev, () => 0);
    const chickens = live("minecraft:chicken");
    expect(chickens).toHaveLength(1);
    expect(chickens[0]?.location).toEqual(CENTER);
    expect(chickens[0]?.spawnOptions).toEqual({ spawnEvent: "minecraft:entity_born" });
  });

  it("adult half the time; a miss spawns nothing", () => {
    const { ev } = breakWith(withCustoms("minecraft:stick", { chicken_rain: 1 }));
    chickenRain(ev, seq(0, 0.9));
    expect(live("minecraft:chicken")[0]?.spawnOptions).toBeUndefined();
    chickenRain(ev, () => 0.05); // 5 % needs rng*100 < 5
    expect(live("minecraft:chicken")).toHaveLength(1);
  });

  it("the local cap blocks spawns", () => {
    for (let i = 0; i < 32; i++) overworld().addEntity(makeEntity("minecraft:chicken"), { x: 4, y: 70, z: i % 8 });
    const { ev } = breakWith(withCustoms("minecraft:stick", { chicken_rain: 100 }));
    chickenRain(ev, () => 0);
    expect(live("minecraft:chicken")).toHaveLength(32);
  });

  it("reads the level from the item before the break", () => {
    const tool = withCustoms("minecraft:stick", { chicken_rain: 1 });
    const p = makePlayer({ inv: {} });
    chickenRain(makeBreakEvent(p, "minecraft:dirt", { location: AT, itemBefore: tool }), () => 0);
    expect(live("minecraft:chicken")).toHaveLength(1);
  });
});

describe("midas touch", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  it("OFF → nothing", () => {
    resetCustom();
    const { ev } = breakWith(withCustoms("minecraft:stick", { midas_touch: 40 }));
    midasTouch(ev, () => 0);
    expect(itemEntities()).toHaveLength(0);
  });

  it("drops a nugget, or an ingot at high levels", () => {
    const low = breakWith(withCustoms("minecraft:stick", { midas_touch: 5 }));
    midasTouch(low.ev, () => 0);
    const high = breakWith(withCustoms("minecraft:stick", { midas_touch: 40 }));
    midasTouch(high.ev, () => 0);
    expect(itemEntities().map((e) => itemIn(e).typeId)).toEqual(["minecraft:gold_nugget", "minecraft:gold_ingot"]);
    expect(itemEntities()[0]?.location).toEqual(CENTER);
  });

  it("a miss drops nothing; creative drops nothing", () => {
    const { ev } = breakWith(withCustoms("minecraft:stick", { midas_touch: 5 }));
    midasTouch(ev, () => 0.99);
    const c = breakWith(withCustoms("minecraft:stick", { midas_touch: 100 }), GameMode.Creative);
    midasTouch(c.ev, () => 0);
    expect(itemEntities()).toHaveLength(0);
  });
});

describe("curse of butterfingers", () => {
  beforeEach(() => {
    resetCustom();
    customOn();
  });

  const cursed = () =>
    withCustoms("minecraft:diamond_sword", { butterfingers: 25 }, { enchantable: COMPAT.sword, lore: ["My sword"] });

  it("OFF → keeps the item", () => {
    resetCustom();
    const p = makePlayer({ inv: { 0: cursed() } });
    expect(fumble(asReal<mc.Player>(p), () => 0)).toBe(false);
    expect(p.container.peek(0)).toBeDefined();
  });

  it("drops the held item exactly once, lore and levels intact", () => {
    const sword = cursed();
    const p = makePlayer({ inv: { 0: sword } });
    p.viewDirection = { x: 1, y: 0, z: 0 };
    expect(fumble(asReal<mc.Player>(p), () => 0)).toBe(true);
    expect(p.container.peek(0)).toBeUndefined();
    const drops = itemEntities();
    expect(drops).toHaveLength(1);
    const dropped = itemIn(drops[0] as never);
    expect(dropped.typeId).toBe(sword.typeId);
    expect(dropped.getLore()).toEqual(sword.getLore());
    expect(drops[0]?.hasTag(FUMBLE_TAG)).toBe(true);
    expect(drops[0]?.impulses[0]).toEqual({ x: 0.3, y: 0, z: 0 });
    expect(p.sounds.map((s) => s.soundId)).toContain("random.pop");
  });

  it("restores the slot when the spawn fails", () => {
    const sword = cursed();
    const p = makePlayer({ inv: { 0: sword } });
    p.dimension.spawnItem = () => {
      throw new Error("chunk unloaded");
    };
    expect(fumble(asReal<mc.Player>(p), () => 0)).toBe(false);
    expect(p.container.peek(0)?.getLore()).toEqual(sword.getLore());
  });

  it("a failed roll, creative, or an empty hand keep everything", () => {
    const p = makePlayer({ inv: { 0: cursed() } });
    expect(fumble(asReal<mc.Player>(p), () => 0.5)).toBe(false); // 50 % needs rng*100 < 50
    const c = makePlayer({ inv: { 0: cursed() }, gameMode: GameMode.Creative });
    expect(fumble(asReal<mc.Player>(c), () => 0)).toBe(false);
    const e = makePlayer({ inv: { 1: cursed() } });
    expect(fumble(asReal<mc.Player>(e), () => 0)).toBe(false);
    expect(itemEntities()).toHaveLength(0);
  });

  it("triggers on block breaks and melee hits through the dispatchers (50 % cap)", () => {
    const p = makePlayer({ inv: {} });
    const z = overworld().addEntity(zombie());
    const until = (act: () => void): number => {
      for (let i = 1; i <= 200; i++) {
        p.container.slots[0] = withCustoms("minecraft:diamond_pickaxe", { butterfingers: 100000 });
        act();
        if (!p.container.peek(0)) return i;
      }
      return -1;
    };
    expect(until(() => onCustomHit(makeHitEvent(p, z)))).toBeGreaterThan(0);
    expect(until(() => onCustomBreak(makeBreakEvent(p, "minecraft:dirt", { location: AT })))).toBeGreaterThan(0);
    // Never more than one drop per event: drops = successful events.
    expect(itemEntities()).toHaveLength(2);
  });
});
