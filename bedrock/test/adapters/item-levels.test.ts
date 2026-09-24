import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCustomLevel,
  getEnchantable,
  makeProbe,
  readCustoms,
  writeCustoms,
  overcapById,
  overcapLevel,
  readExtras,
  trueLevelOf,
  writeExtras,
} from "../../src/adapters/item-levels";
import { getRegistry } from "../../src/adapters/registry";
import { LORE_TAG, PROP_CUSTOM_LEVELS, PROP_LEVELS } from "../../src/core/config";
import { CUSTOM } from "../../src/core/custom/roster";
import { encodeLoreLine, encodeRawLoreLine } from "../../src/core/lore";
import { asItem, fakeEnchantable, makeItem } from "../fakes/builders";
import { FakeItemStack } from "../fakes/minecraft-server";
import { levelsProp, loreLine, overcapped, resetAll } from "./helpers";

const SHARP = { id: "minecraft:sharpness", maxLevel: 5 };

function enchOf(item: FakeItemStack) {
  const ench = getEnchantable(asItem(item));
  if (!ench) throw new Error("not enchantable");
  return ench;
}

describe("item-levels", () => {
  beforeEach(() => void resetAll());

  it("dynamic property wins over lore", () => {
    const item = makeItem("minecraft:diamond_sword", {
      enchantable: { compatible: "all" },
      levels: { sharpness: 5 },
      lore: [loreLine("minecraft:sharpness", 7)],
      props: levelsProp({ "minecraft:sharpness": 9 }),
    });
    expect(readExtras(asItem(item)).get("minecraft:sharpness")).toBe(9);
    expect(trueLevelOf(asItem(item), enchOf(item), SHARP)).toBe(9);
  });

  it("falls back to lore when the dynamic property is missing", () => {
    const item = makeItem("minecraft:diamond_sword", {
      enchantable: { compatible: "all" },
      levels: { sharpness: 5 },
      lore: ["user line", loreLine("minecraft:sharpness", 7)],
    });
    expect(trueLevelOf(asItem(item), enchOf(item), SHARP)).toBe(7);
  });

  it("uses lore for stackable items without touching dynamic properties", () => {
    const item = makeItem("minecraft:book", {
      amount: 3,
      enchantable: { compatible: "all" },
      levels: { sharpness: 5 },
      lore: [loreLine("minecraft:sharpness", 8)],
    });
    expect(item.isStackable).toBe(true);
    expect(trueLevelOf(asItem(item), enchOf(item), SHARP)).toBe(8);
  });

  it("ignores a stale overcap when vanilla is below max", () => {
    const item = makeItem("minecraft:diamond_sword", {
      enchantable: { compatible: "all" },
      levels: { sharpness: 3 },
      lore: [loreLine("minecraft:sharpness", 7)],
      props: levelsProp({ "minecraft:sharpness": 9 }),
    });
    expect(trueLevelOf(asItem(item), enchOf(item), SHARP)).toBe(3);
    expect(overcapLevel(asItem(item), SHARP)).toBe(0);
  });

  it("returns 0 for absent enchantments", () => {
    const item = makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" } });
    expect(trueLevelOf(asItem(item), enchOf(item), SHARP)).toBe(0);
  });

  it("writeExtras writes dynprop + lore, prunes stale entries and keeps user lore", () => {
    const item = makeItem("minecraft:diamond_sword", {
      enchantable: { compatible: "all" },
      levels: { sharpness: 5, unbreaking: 2 },
      lore: ["§oMy blade", loreLine("minecraft:unbreaking", 6)],
    });
    const extras = new Map([
      ["minecraft:sharpness", 6],
      ["minecraft:unbreaking", 6], // stale: vanilla 2 < max 3
      ["foo:bar", 9], // unknown id
    ]);
    writeExtras(asItem(item), enchOf(item), extras, getRegistry());
    expect(item.props.get(PROP_LEVELS)).toBe(JSON.stringify({ "minecraft:sharpness": 6 }));
    expect(item.lore).toEqual(["§oMy blade", loreLine("minecraft:sharpness", 6)]);
  });

  it("writeExtras removes the dynamic property and managed lore when nothing is left", () => {
    const item = overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 7);
    writeExtras(asItem(item), enchOf(item), new Map(), getRegistry());
    expect(item.props.has(PROP_LEVELS)).toBe(false);
    expect(item.lore).toEqual([]);
  });

  it("writeExtras skips the dynamic property on stackables without throwing", () => {
    const item = makeItem("minecraft:book", { amount: 2, enchantable: { compatible: "all" }, levels: { sharpness: 5 } });
    expect(() =>
      writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 6]]), getRegistry()),
    ).not.toThrow();
    expect(item.lore).toEqual([loreLine("minecraft:sharpness", 6)]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("writeExtras migrates a legacy English line to a localized one once, then does not call setLore", () => {
    const item = overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 7);
    expect(item.rawLore).toEqual([loreLine("minecraft:sharpness", 7)]);
    const spy = vi.spyOn(item, "setLore");
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 7]]), getRegistry());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(item.rawLore).toEqual([encodeRawLoreLine("minecraft:sharpness", 7)]);
    expect(item.lore).toEqual([loreLine("minecraft:sharpness", 7)]);
    expect(item.loreRu).toEqual([`${LORE_TAG}§dОстрота VII`]);
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 7]]), getRegistry());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falls back to English string lines for good when the engine rejects RawMessage lore", () => {
    FakeItemStack.rejectRawLore = true;
    const item = makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" }, levels: { sharpness: 5 } });
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 6]]), getRegistry());
    expect(item.rawLore).toEqual([loreLine("minecraft:sharpness", 6)]);
    expect(console.warn).toHaveBeenCalledTimes(1);
    const spy = vi.spyOn(item, "setLore");
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 6]]), getRegistry());
    expect(spy).not.toHaveBeenCalled(); // text mode sticks: no failed RawMessage attempt per write
    FakeItemStack.rejectRawLore = false;
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 7]]), getRegistry());
    expect(item.rawLore).toEqual([loreLine("minecraft:sharpness", 7)]);
  });

  it("reads lore through getRawLore and keeps foreign RawMessage user lines verbatim", () => {
    const foreign = { rawtext: [{ text: "§7Blessed: " }, { translate: "item.apple.name" }] };
    const item = overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 7, { lore: [] });
    item.rawLore = ["plain", foreign, encodeRawLoreLine("minecraft:sharpness", 7)];
    const getLore = vi.spyOn(item, "getLore");
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 8]]), getRegistry());
    expect(getLore).not.toHaveBeenCalled();
    expect(item.rawLore).toEqual(["plain", foreign, encodeRawLoreLine("minecraft:sharpness", 8)]);
  });

  it("writeExtras survives setLore throwing", () => {
    const item = makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" }, levels: { sharpness: 5 } });
    vi.spyOn(item, "setLore").mockImplementation(() => {
      throw new Error("limit");
    });
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 6]]), getRegistry());
    expect(item.props.get(PROP_LEVELS)).toBe(JSON.stringify({ "minecraft:sharpness": 6 }));
  });

  it("overcapLevel fast path reads no lore or dynprop below max", () => {
    const item = makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" }, levels: { sharpness: 4 } });
    const lore = vi.spyOn(item, "getLore");
    const rawLore = vi.spyOn(item, "getRawLore");
    const prop = vi.spyOn(item, "getDynamicProperty");
    expect(overcapLevel(asItem(item), SHARP)).toBe(0);
    expect(lore).not.toHaveBeenCalled();
    expect(rawLore).not.toHaveBeenCalled();
    expect(prop).not.toHaveBeenCalled();
  });

  it("overcapLevel / overcapById report levels above max", () => {
    const item = overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 7);
    expect(overcapLevel(asItem(item), SHARP)).toBe(2);
    expect(overcapById(asItem(item), "sharpness", getRegistry())).toBe(2);
    expect(overcapById(asItem(item), "foo:bar", getRegistry())).toBe(0);
    expect(overcapLevel(asItem(makeItem("minecraft:dirt")), SHARP)).toBe(0);
  });

  it("getEnchantable is undefined for plain items and when getComponent throws", () => {
    expect(getEnchantable(asItem(makeItem("minecraft:dirt")))).toBeUndefined();
    const item = makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" } });
    vi.spyOn(item, "getComponent").mockImplementation(() => {
      throw new Error("invalid");
    });
    expect(getEnchantable(asItem(item))).toBeUndefined();
  });

  it("makeProbe: lazy true levels, canAddFresh false on unknown ids or throws", () => {
    const item = makeItem("minecraft:diamond_sword", {
      enchantable: { compatible: ["sharpness", "unbreaking"] },
      levels: { sharpness: 5 },
      props: levelsProp({ "minecraft:sharpness": 8 }),
    });
    const probe = makeProbe(asItem(item), getRegistry());
    expect(probe.enchantable).toBe(true);
    expect(probe.typeId).toBe("minecraft:diamond_sword");
    expect(probe.trueLevel("minecraft:sharpness")).toBe(8);
    expect(probe.trueLevel("minecraft:unbreaking")).toBe(0);
    expect(probe.canAddFresh("minecraft:unbreaking")).toBe(true);
    expect(probe.canAddFresh("minecraft:power")).toBe(false);
    expect(probe.canAddFresh("foo:bar")).toBe(false);
    vi.spyOn(fakeEnchantable(item.enchantable)!, "canAddEnchantment").mockImplementation(() => {
      throw new Error("bounds");
    });
    expect(probe.canAddFresh("minecraft:unbreaking")).toBe(false);
  });

  it("makeProbe looks up the enchantable component only when the slot is visited, once", () => {
    const item = makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" } });
    const spy = vi.spyOn(item, "getComponent");
    const probe = makeProbe(asItem(item), getRegistry());
    expect(spy).not.toHaveBeenCalled();
    expect(probe.enchantable).toBe(true);
    probe.trueLevel("minecraft:sharpness");
    probe.canAddFresh("minecraft:sharpness");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("writeExtras does not write the dynamic property when its value is unchanged", () => {
    const plain = makeItem("minecraft:diamond_sword", { enchantable: { compatible: "all" }, levels: { sharpness: 3 } });
    const plainSpy = vi.spyOn(plain, "setDynamicProperty");
    writeExtras(asItem(plain), enchOf(plain), new Map(), getRegistry());
    expect(plainSpy).not.toHaveBeenCalled();

    const over = overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 7);
    const overSpy = vi.spyOn(over, "setDynamicProperty");
    writeExtras(asItem(over), enchOf(over), new Map([["minecraft:sharpness", 7]]), getRegistry());
    expect(overSpy).not.toHaveBeenCalled();
    writeExtras(asItem(over), enchOf(over), new Map([["minecraft:sharpness", 8]]), getRegistry());
    expect(overSpy).toHaveBeenCalledTimes(1);
    expect(over.props.get(PROP_LEVELS)).toBe(JSON.stringify({ "minecraft:sharpness": 8 }));
  });

  it("makeProbe on a non-enchantable item", () => {
    const probe = makeProbe(asItem(makeItem("minecraft:dirt", { amount: 5 })), getRegistry());
    expect(probe.enchantable).toBe(false);
    expect(probe.trueLevel("minecraft:sharpness")).toBe(0);
    expect(probe.canAddFresh("minecraft:sharpness")).toBe(false);
  });
});

describe("item-levels: custom enchantments", () => {
  beforeEach(() => void resetAll());

  const magnetLine = (lvl: number) => encodeLoreLine("Magnet", lvl, "9");
  const hiccupsLine = (lvl: number) => encodeLoreLine("Curse of Hiccups", lvl, "c");

  it("getCustomLevel / readCustoms on a non-stackable item (dynprop wins over lore)", () => {
    const item = makeItem("minecraft:diamond_pickaxe", { customs: { [CUSTOM.vein_miner]: 4, [CUSTOM.hiccups]: 2 } });
    expect(item.props.get(PROP_CUSTOM_LEVELS)).toBe(JSON.stringify({ "enchantaholic:hiccups": 2, "enchantaholic:vein_miner": 4 }));
    expect(getCustomLevel(asItem(item), CUSTOM.vein_miner)).toBe(4);
    expect(getCustomLevel(asItem(item), CUSTOM.magnet)).toBe(0);
    item.props.set(PROP_CUSTOM_LEVELS, JSON.stringify({ "enchantaholic:vein_miner": 9 }));
    expect(readCustoms(asItem(item))).toEqual(
      new Map([
        [CUSTOM.vein_miner, 9],
        [CUSTOM.hiccups, 2],
      ]),
    );
  });

  it("getCustomLevel / readCustoms on a stackable item (lore only, no dynprop access)", () => {
    const item = makeItem("minecraft:dirt", { amount: 10, customs: { [CUSTOM.chicken_rain]: 3 } });
    expect(item.lore).toEqual([encodeLoreLine("Chicken Rain", 3, "9")]);
    const prop = vi.spyOn(item, "getDynamicProperty");
    expect(getCustomLevel(asItem(item), CUSTOM.chicken_rain)).toBe(3);
    expect(prop).not.toHaveBeenCalled();
  });

  it("getCustomLevel is 0 for undefined items and never throws", () => {
    expect(getCustomLevel(undefined, CUSTOM.magnet)).toBe(0);
    const item = makeItem("minecraft:diamond_sword", { customs: { [CUSTOM.magnet]: 2 } });
    vi.spyOn(item, "getLore").mockImplementation(() => {
      throw new Error("invalid");
    });
    vi.spyOn(item, "getRawLore").mockImplementation(() => {
      throw new Error("invalid");
    });
    vi.spyOn(item, "getDynamicProperty").mockImplementation(() => {
      throw new Error("invalid");
    });
    expect(getCustomLevel(asItem(item), CUSTOM.magnet)).toBe(0);
  });

  it("readExtras never returns custom levels", () => {
    const item = makeItem("minecraft:diamond_sword", {
      enchantable: { compatible: "all" },
      levels: { sharpness: 5 },
      lore: [loreLine("minecraft:sharpness", 7), magnetLine(3)],
      props: { [PROP_LEVELS]: JSON.stringify({ "minecraft:sharpness": 7, "enchantaholic:magnet": 5 }) },
    });
    expect(readExtras(asItem(item))).toEqual(new Map([["minecraft:sharpness", 7]]));
  });

  it("writeCustoms writes dynprop + lore and keeps vanilla-overcap and user lines", () => {
    const item = overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 7, { lore: [] });
    item.lore = ["§oMy blade", loreLine("minecraft:sharpness", 7)];
    writeCustoms(
      asItem(item),
      new Map([
        [CUSTOM.magnet, 2],
        [CUSTOM.hiccups, 1],
      ]),
    );
    expect(item.props.get(PROP_CUSTOM_LEVELS)).toBe(JSON.stringify({ "enchantaholic:hiccups": 1, "enchantaholic:magnet": 2 }));
    expect(item.props.get(PROP_LEVELS)).toBe(JSON.stringify({ "minecraft:sharpness": 7 }));
    expect(item.lore).toEqual(["§oMy blade", hiccupsLine(1), magnetLine(2), loreLine("minecraft:sharpness", 7)]);
  });

  it("writeCustoms on a stackable writes lore only", () => {
    const item = makeItem("minecraft:stick", { amount: 3 });
    writeCustoms(asItem(item), new Map([[CUSTOM.barrage, 5]]));
    expect(item.lore).toEqual([encodeLoreLine("Barrage", 5, "9")]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("writeExtras keeps custom lore (regression: custom lines were pruned as unknown ids)", () => {
    const item = makeItem("minecraft:diamond_sword", {
      enchantable: { compatible: "all" },
      levels: { sharpness: 5 },
      customs: { [CUSTOM.yeet]: 4 },
    });
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 6]]), getRegistry());
    expect(item.lore).toEqual([loreLine("minecraft:sharpness", 6), encodeLoreLine("Yeet", 4, "9")]);
    expect(getCustomLevel(asItem(item), CUSTOM.yeet)).toBe(4);
    // Even a lore-only custom (no dynprop) survives, and extras passed in with a custom id are ignored.
    const stack = makeItem("minecraft:book", { amount: 2, enchantable: { compatible: "all" }, levels: { sharpness: 5 }, customs: { [CUSTOM.kaboom]: 2 } });
    writeExtras(asItem(stack), enchOf(stack), new Map([["enchantaholic:kaboom", 99]]), getRegistry());
    expect(stack.lore).toEqual([encodeLoreLine("Kaboom", 2, "9")]);
  });

  it("writeCustoms skips the dynprop write when unchanged", () => {
    const item = makeItem("minecraft:diamond_sword", { customs: { [CUSTOM.magnet]: 2 } });
    const spy = vi.spyOn(item, "setDynamicProperty");
    const lore = vi.spyOn(item, "setLore");
    writeCustoms(asItem(item), new Map([[CUSTOM.magnet, 2]]));
    expect(spy).not.toHaveBeenCalled();
    expect(lore).not.toHaveBeenCalled();
    writeCustoms(asItem(item), new Map([[CUSTOM.magnet, 3]]));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("makeProbe.customLevel delegates to the stored custom levels", () => {
    const probe = makeProbe(asItem(makeItem("minecraft:dirt", { customs: { [CUSTOM.midas_touch]: 6 } })), getRegistry());
    expect(probe.customLevel?.(CUSTOM.midas_touch)).toBe(6);
    expect(probe.customLevel?.(CUSTOM.magnet)).toBe(0);
  });
});

