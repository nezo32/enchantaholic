import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enchantRandomItem,
  onPlayerBreakBlock,
  registerEnchanter,
} from "../../src/adapters/enchanter";
import { setEnabled } from "../../src/adapters/state";
import { MAX_APPLY_ATTEMPTS, PROP_LEVELS } from "../../src/core/config";
import { mulberry32 } from "../../src/core/rng";
import {
  asPlayer,
  booksStack,
  boots,
  COMPAT,
  dirt,
  enchantedBook,
  makeBreakEvent,
  makeItem,
  makePlayer,
  spear,
  sword,
} from "../fakes/builders";
import { EquipmentSlot, FakeEnchantable, GameMode, world, type FakePlayer } from "../fakes/minecraft-server";
import { levelsProp, loreLine, resetAll } from "./helpers";

const onlySharp = (levels: Record<string, number> = {}, extra: Parameters<typeof makeItem>[1] = {}) =>
  makeItem("minecraft:diamond_sword", { enchantable: { compatible: ["sharpness"] }, levels, ...extra });

function actionText(p: FakePlayer): string {
  const last = p.onScreenDisplay.actionBars.at(-1) as { rawtext: Array<{ text?: string; translate?: string }> };
  return last.rawtext.map((x) => x.text ?? `<${x.translate}>`).join("");
}

describe("enchanter gates", () => {
  beforeEach(() => void resetAll());

  const run = (p: FakePlayer, block = "minecraft:stone") => onPlayerBreakBlock(makeBreakEvent(p, block));

  it("does nothing when disabled", () => {
    setEnabled(false);
    const p = makePlayer({ inv: { 0: sword() } });
    run(p);
    expect(p.container.writes).toHaveLength(0);
    expect(p.onScreenDisplay.actionBars).toHaveLength(0);
  });

  it.each([GameMode.Creative, GameMode.Spectator])("skips %s", (mode) => {
    const p = makePlayer({ gameMode: mode, inv: { 0: sword() } });
    run(p);
    expect(p.container.writes).toHaveLength(0);
    expect(p.onScreenDisplay.actionBars).toHaveLength(0);
  });

  it.each(["minecraft:short_grass", "minecraft:torch", "minecraft:tnt", "minecraft:element_0"])(
    "skips instabreak block %s",
    (block) => {
      const p = makePlayer({ inv: { 0: sword() } });
      run(p, block);
      expect(p.container.writes).toHaveLength(0);
      expect(p.onScreenDisplay.actionBars).toHaveLength(0);
    },
  );

  it.each([GameMode.Survival, GameMode.Adventure])("enchants in %s", (mode) => {
    const p = makePlayer({ gameMode: mode, inv: { 0: sword() } });
    run(p);
    expect(p.container.writes).toHaveLength(1);
    expect(p.onScreenDisplay.actionBars).toHaveLength(1);
    expect(p.sounds[0]?.soundId).toBe("random.orb");
  });

  it("registerEnchanter subscribes a handler that never throws", () => {
    registerEnchanter();
    const p = makePlayer({ inv: { 0: sword() } });
    vi.spyOn(p, "getGameMode").mockImplementation(() => {
      throw new Error("invalid player");
    });
    expect(() => world.afterEvents.playerBreakBlock.emit(makeBreakEvent(p, "minecraft:stone"))).not.toThrow();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe("enchantRandomItem", () => {
  beforeEach(() => void resetAll());

  it("applies a fresh level I enchant, writes back and shows the translated item name", () => {
    const p = makePlayer({ inv: { 4: sword() } });
    onPlayerBreakBlock(makeBreakEvent(p, "minecraft:stone"));
    const stored = p.container.peek(4)!;
    expect(stored.enchantable!.levels.size).toBe(1);
    expect([...stored.enchantable!.levels.values()]).toEqual([1]);
    expect(p.container.writes.map((w) => w.slot)).toEqual([4]);
    const bar = p.onScreenDisplay.actionBars[0] as { rawtext: unknown[] };
    expect(bar.rawtext).toContainEqual({ translate: "item.diamond_sword.name" });
  });

  it("uses the custom name when the item has a nameTag", () => {
    const p = makePlayer({ inv: { 0: onlySharp({}, { nameTag: "Excalibur" }) } });
    onPlayerBreakBlock(makeBreakEvent(p, "minecraft:stone"));
    expect(actionText(p)).toContain("Excalibur");
  });

  it("stacks below max: Sharpness III → IV with no lore", () => {
    const p = makePlayer({ inv: { 0: onlySharp({ sharpness: 3 }) } });
    const r = enchantRandomItem(asPlayer(p));
    expect(r?.level).toBe(4);
    const stored = p.container.peek(0)!;
    expect(stored.enchantable!.levels.get("minecraft:sharpness")).toBe(4);
    expect(stored.lore).toEqual([]);
    expect(stored.props.has(PROP_LEVELS)).toBe(false);
  });

  it("overcaps: Sharpness V → true VI (vanilla stays V)", () => {
    const p = makePlayer({ inv: { 0: onlySharp({ sharpness: 5 }) } });
    onPlayerBreakBlock(makeBreakEvent(p, "minecraft:stone"));
    const stored = p.container.peek(0)!;
    expect(stored.enchantable!.levels.get("minecraft:sharpness")).toBe(5);
    expect(stored.props.get(PROP_LEVELS)).toBe(JSON.stringify({ "minecraft:sharpness": 6 }));
    expect(stored.lore).toEqual([loreLine("minecraft:sharpness", 6)]);
    expect(actionText(p)).toContain("Sharpness §6VI");
  });

  it("overcap chain V→VI→VII→VIII survives losing the dynamic property (lore fallback)", () => {
    const p = makePlayer({ inv: { 0: onlySharp({ sharpness: 5 }) } });
    const levels: number[] = [];
    for (let i = 0; i < 3; i++) {
      if (i > 0) p.container.peek(0)!.props.delete(PROP_LEVELS);
      levels.push(enchantRandomItem(asPlayer(p))!.level);
    }
    expect(levels).toEqual([6, 7, 8]);
    const stored = p.container.peek(0)!;
    expect(stored.lore).toEqual([loreLine("minecraft:sharpness", 8)]);
    expect(stored.props.get(PROP_LEVELS)).toBe(JSON.stringify({ "minecraft:sharpness": 8 }));
  });

  it("stale lore (VII) with vanilla III reads as III, becomes IV and the stale line is removed", () => {
    const item = onlySharp({ sharpness: 3 }, {
      lore: ["keep me", loreLine("minecraft:sharpness", 7)],
      props: levelsProp({ "minecraft:sharpness": 7 }),
    });
    const p = makePlayer({ inv: { 0: item } });
    expect(enchantRandomItem(asPlayer(p))?.level).toBe(4);
    const stored = p.container.peek(0)!;
    expect(stored.enchantable!.levels.get("minecraft:sharpness")).toBe(4);
    expect(stored.lore).toEqual(["keep me"]);
    expect(stored.props.has(PROP_LEVELS)).toBe(false);
  });

  it("rerolls incompatible enchants: boots only receive boot enchantments", () => {
    const allowed = new Set(COMPAT.boots.compatible.map((id) => `minecraft:${id}`));
    for (let seed = 1; seed <= 150; seed++) {
      resetAll();
      const p = makePlayer({ equip: { Feet: boots() } });
      const r = enchantRandomItem(asPlayer(p), mulberry32(seed));
      expect(r).toBeDefined();
      expect(allowed.has(r!.enchant.id)).toBe(true);
      expect(p.equippable.writes.map((w) => w.slot)).toEqual([EquipmentSlot.Feet]);
    }
  });

  it("repeated breaks keep stacking on a single item and respect conflicts", () => {
    const p = makePlayer({ inv: { 0: sword() } });
    const rng = mulberry32(42);
    for (let i = 0; i < 200; i++) expect(enchantRandomItem(asPlayer(p), rng)).toBeDefined();
    const levels = p.container.peek(0)!.enchantable!.levels;
    const damage = ["minecraft:sharpness", "minecraft:smite", "minecraft:bane_of_arthropods"].filter((id) => levels.has(id));
    expect(damage.length).toBe(1);
  });

  it("tries the next plan and restores the old level when addEnchantment throws despite canAdd", () => {
    const original = FakeEnchantable.prototype.addEnchantment;
    vi.spyOn(FakeEnchantable.prototype, "addEnchantment").mockImplementation(function (
      this: FakeEnchantable,
      e,
    ) {
      if (e.type.id === "minecraft:sharpness" && e.level === 3) throw new Error("engine refused");
      return original.call(this, e);
    });
    for (let seed = 1; seed <= 20; seed++) {
      resetAll();
      const item = makeItem("minecraft:diamond_sword", {
        enchantable: { compatible: ["sharpness", "unbreaking"] },
        levels: { sharpness: 2 },
      });
      const p = makePlayer({ inv: { 0: item } });
      const r = enchantRandomItem(asPlayer(p), mulberry32(seed));
      expect(r?.enchant.id).toBe("minecraft:unbreaking");
      const levels = p.container.peek(0)!.enchantable!.levels;
      expect(levels.get("minecraft:sharpness")).toBe(2);
      expect(levels.get("minecraft:unbreaking")).toBe(1);
    }
  });

  it("is a silent no-op with only non-enchantable items", () => {
    const p = makePlayer({ inv: { 0: dirt(), 5: dirt(12), 35: booksStack(5) } });
    onPlayerBreakBlock(makeBreakEvent(p, "minecraft:stone"));
    expect(p.container.writes).toHaveLength(0);
    expect(p.onScreenDisplay.actionBars).toHaveLength(0);
    expect(p.sounds).toHaveLength(0);
  });

  it("is a silent no-op with an empty inventory", () => {
    const p = makePlayer();
    expect(enchantRandomItem(asPlayer(p))).toBeUndefined();
  });

  it("dirt + boots always enchants the boots", () => {
    for (let seed = 1; seed <= 50; seed++) {
      resetAll();
      const inv: Record<number, ReturnType<typeof dirt>> = {};
      for (let i = 0; i < 36; i++) inv[i] = dirt();
      const p = makePlayer({ inv, equip: { Feet: boots() } });
      const r = enchantRandomItem(asPlayer(p), mulberry32(seed));
      expect(r?.item.typeId).toBe("minecraft:diamond_boots");
      expect(p.container.writes).toHaveLength(0);
    }
  });

  it("enchants an enchanted book that exposes minecraft:enchantable", () => {
    const p = makePlayer({ inv: { 0: enchantedBook({ levels: { mending: 1 } }) } });
    const r = enchantRandomItem(asPlayer(p), mulberry32(7));
    expect(r?.item.typeId).toBe("minecraft:enchanted_book");
  });

  it("puts lunge on spears only", () => {
    let spearLunge = 0;
    for (let seed = 1; seed <= 300; seed++) {
      resetAll();
      const any = makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" } });
      const p = makePlayer({ inv: { 0: any } });
      expect(enchantRandomItem(asPlayer(p), mulberry32(seed))?.enchant.id).not.toBe("minecraft:lunge");
      const p2 = makePlayer({ inv: { 0: spear() } });
      if (enchantRandomItem(asPlayer(p2), mulberry32(seed))?.enchant.id === "minecraft:lunge") spearLunge++;
    }
    expect(spearLunge).toBeGreaterThan(0);
  });

  it("picks the equipment and inventory slots roughly uniformly (not Mainhand twice)", () => {
    const counts = new Map<string, number>();
    const rng = mulberry32(99);
    for (let i = 0; i < 3000; i++) {
      resetAll();
      const p = makePlayer({ selected: 0, inv: { 0: onlySharp() }, equip: { Offhand: onlySharp() } });
      const r = enchantRandomItem(asPlayer(p), rng);
      const where = p.container.writes.length ? "inv" : "offhand";
      counts.set(where, (counts.get(where) ?? 0) + 1);
      expect(r).toBeDefined();
    }
    expect(counts.get("inv")! / 3000).toBeGreaterThan(0.45);
    expect(counts.get("inv")! / 3000).toBeLessThan(0.55);
  });

  it("respects MAX_APPLY_ATTEMPTS when every add throws", () => {
    const add = vi.spyOn(FakeEnchantable.prototype, "addEnchantment").mockImplementation(() => {
      throw new Error("nope");
    });
    const inv: Record<number, ReturnType<typeof enchantedBook>> = {};
    for (let i = 0; i < 36; i++) inv[i] = enchantedBook();
    const p = makePlayer({ inv });
    expect(enchantRandomItem(asPlayer(p), mulberry32(1))).toBeUndefined();
    expect(add.mock.calls.length).toBe(MAX_APPLY_ATTEMPTS);
    expect(p.container.writes).toHaveLength(0);
  });

  it("reports nothing when the equipment write is rejected", () => {
    const p = makePlayer({ equip: { Feet: boots() } });
    p.equippable.rejectWrites = true;
    onPlayerBreakBlock(makeBreakEvent(p, "minecraft:stone"));
    expect(p.onScreenDisplay.actionBars).toHaveLength(0);
  });
});
