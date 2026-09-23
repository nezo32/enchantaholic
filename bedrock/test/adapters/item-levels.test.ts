import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEnchantable,
  makeProbe,
  overcapById,
  overcapLevel,
  readExtras,
  trueLevelOf,
  writeExtras,
} from "../../src/adapters/item-levels";
import { getRegistry } from "../../src/adapters/registry";
import { PROP_LEVELS } from "../../src/core/config";
import { asItem, fakeEnchantable, makeItem } from "../fakes/builders";
import type { FakeItemStack } from "../fakes/minecraft-server";
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

  it("writeExtras does not call setLore when the lore is unchanged", () => {
    const item = overcapped("minecraft:diamond_sword", "minecraft:sharpness", 5, 7);
    const spy = vi.spyOn(item, "setLore");
    writeExtras(asItem(item), enchOf(item), new Map([["minecraft:sharpness", 7]]), getRegistry());
    expect(spy).not.toHaveBeenCalled();
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
    const prop = vi.spyOn(item, "getDynamicProperty");
    expect(overcapLevel(asItem(item), SHARP)).toBe(0);
    expect(lore).not.toHaveBeenCalled();
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

  it("makeProbe on a non-enchantable item", () => {
    const probe = makeProbe(asItem(makeItem("minecraft:dirt", { amount: 5 })), getRegistry());
    expect(probe.enchantable).toBe(false);
    expect(probe.trueLevel("minecraft:sharpness")).toBe(0);
    expect(probe.canAddFresh("minecraft:sharpness")).toBe(false);
  });
});
