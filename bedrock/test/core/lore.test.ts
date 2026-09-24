import { MinecraftEnchantmentTypes } from "@minecraft/vanilla-data";
import { describe, expect, it } from "vitest";
import { LORE_MAX_CHARS, LORE_MAX_LINES, LORE_TAG } from "../../src/core/config";
import { displayName } from "../../src/core/enchant-names";
import {
  composeLore,
  encodeLoreLine,
  encodeRawLoreLine,
  isManagedLine,
  loreColor,
  loreKey,
  parseLoreLine,
  parseManagedLine,
  splitLore,
} from "../../src/core/lore";
import { renderRaw } from "../fakes/lang";

const VANILLA = Object.values(MinecraftEnchantmentTypes) as string[];

describe("lore line codec", () => {
  it("encodes the managed format", () => {
    expect(encodeLoreLine("Sharpness", 6)).toBe(`${LORE_TAG}§dSharpness VI`);
  });

  it("every vanilla name at level 3888 fits within the char limit and round-trips", () => {
    for (const id of VANILLA) {
      const line = encodeLoreLine(displayName(id), 3888);
      expect(line.length).toBeLessThanOrEqual(LORE_MAX_CHARS);
      expect(parseLoreLine(line)).toEqual({ name: displayName(id), level: 3888 });
    }
  });

  it("truncates overly long names and decimal levels", () => {
    const line = encodeLoreLine("A".repeat(80), 123456);
    expect(line.length).toBe(LORE_MAX_CHARS);
    expect(line.endsWith(" 123456")).toBe(true);
    expect(parseLoreLine(line)?.level).toBe(123456);
  });

  it("parse ignores non-tagged or malformed lines", () => {
    expect(parseLoreLine("Sharpness VI")).toBeUndefined();
    expect(parseLoreLine("§dSharpness VI")).toBeUndefined();
    expect(parseLoreLine(`${LORE_TAG}§dSharpness`)).toBeUndefined();
    expect(parseLoreLine(`${LORE_TAG}§dSharpness IIII`)).toBeUndefined();
    expect(parseLoreLine(`${LORE_TAG}§d VI`)).toBeUndefined();
    expect(parseLoreLine(`${LORE_TAG}§dSharpness 0`)).toBeUndefined();
    expect(parseLoreLine(`${LORE_TAG}§dBane of Arthropods VII`)).toEqual({ name: "Bane of Arthropods", level: 7 });
  });
});

describe("splitLore / composeLore", () => {
  const user = ["My sword", "§7forged in fire", ""];

  it("keeps user lines in order and extracts managed levels", () => {
    const lore = [user[0]!, encodeLoreLine("Sharpness", 7), user[1]!, encodeLoreLine("Curse of Binding", 3), user[2]!];
    const { user: u, managed } = splitLore(lore);
    expect(u).toEqual(user);
    expect(managed).toEqual(new Map([
      ["minecraft:sharpness", 7],
      ["minecraft:binding", 3],
    ]));
  });

  it("drops tagged lines with unknown names or garbage, keeps highest duplicate", () => {
    const { user: u, managed } = splitLore([
      encodeLoreLine("Nonsense", 7),
      `${LORE_TAG}garbage`,
      encodeLoreLine("Power", 6),
      encodeLoreLine("Power", 9),
      encodeLoreLine("Power", 8),
    ]);
    expect(u).toEqual([]);
    expect(managed).toEqual(new Map([["minecraft:power", 9]]));
  });

  it("composes user first then managed sorted by display name", () => {
    const managed = new Map([
      ["minecraft:unbreaking", 4],
      ["minecraft:efficiency", 6],
      ["minecraft:binding", 2],
    ]);
    expect(composeLore(user, managed, "text")).toEqual([
      ...user,
      encodeLoreLine("Curse of Binding", 2),
      encodeLoreLine("Efficiency", 6),
      encodeLoreLine("Unbreaking", 4),
    ]);
  });

  it("is idempotent through split/compose", () => {
    const managed = new Map([
      ["minecraft:sharpness", 9],
      ["minecraft:mending", 2],
    ]);
    const once = composeLore(user, managed);
    const s = splitLore(once);
    expect(composeLore(s.user, s.managed)).toEqual(once);
  });

  it("caps at 20 lines, truncating managed lines first", () => {
    const manyManaged = new Map(VANILLA.map((id) => [id, 99] as const));
    const out = composeLore(user, manyManaged);
    expect(out).toHaveLength(LORE_MAX_LINES);
    expect(out.slice(0, 3)).toEqual(user);
    expect(out.slice(3).every(isManagedLine)).toBe(true);
  });

  it("only cuts user lines when they alone exceed the limit", () => {
    const bigUser = Array.from({ length: 25 }, (_, i) => `line ${i}`);
    const out = composeLore(bigUser, new Map([["minecraft:sharpness", 6]]));
    expect(out).toEqual(bigUser.slice(0, 20));
    const exactly = Array.from({ length: 20 }, (_, i) => `l${i}`);
    expect(composeLore(exactly, new Map([["minecraft:sharpness", 6]]))).toEqual(exactly);
  });

  it("empty inputs compose to empty lore", () => {
    expect(composeLore([], new Map())).toEqual([]);
  });
});

describe("custom lore lines", () => {
  it("encodes with a colour and parses §9 and §c lines", () => {
    expect(encodeLoreLine("Vein Miner", 3, "9")).toBe(`${LORE_TAG}§9Vein Miner III`);
    expect(parseLoreLine(`${LORE_TAG}§9Vein Miner III`)).toEqual({ name: "Vein Miner", level: 3 });
    expect(parseLoreLine(`${LORE_TAG}§cCurse of Hiccups II`)).toEqual({ name: "Curse of Hiccups", level: 2 });
    expect(parseLoreLine(`${LORE_TAG}§zVein Miner III`)).toBeUndefined();
    expect(parseLoreLine("§9Vein Miner III")).toBeUndefined();
  });

  it("loreColor: d for vanilla, 9 for custom, c for custom curses", () => {
    expect(loreColor("minecraft:sharpness")).toBe("d");
    expect(loreColor("minecraft:binding")).toBe("d");
    expect(loreColor("enchantaholic:magnet")).toBe("9");
    expect(loreColor("enchantaholic:butterfingers")).toBe("c");
  });

  it("composeLore colours each line and interleaves custom and vanilla by name", () => {
    const managed = new Map([
      ["minecraft:unbreaking", 4],
      ["enchantaholic:magnet", 2],
      ["enchantaholic:hiccups", 1],
      ["minecraft:efficiency", 6],
    ]);
    expect(composeLore(["mine"], managed).map((l) => renderRaw(l))).toEqual(composeLore(["mine"], managed, "text"));
    expect(composeLore(["mine"], managed, "text")).toEqual([
      "mine",
      encodeLoreLine("Curse of Hiccups", 1, "c"),
      encodeLoreLine("Efficiency", 6),
      encodeLoreLine("Magnet", 2, "9"),
      encodeLoreLine("Unbreaking", 4),
    ]);
  });

  it("a mixed vanilla + custom lore round-trips through splitLore", () => {
    const managed = new Map([
      ["minecraft:sharpness", 9],
      ["enchantaholic:vein_miner", 12],
      ["enchantaholic:butterfingers", 3],
    ]);
    const lore = composeLore(["§oMy pick"], managed);
    const s = splitLore(lore);
    expect(s.user).toEqual(["§oMy pick"]);
    expect(s.managed).toEqual(managed);
    expect(composeLore(s.user, s.managed)).toEqual(lore);
  });
});


describe("localized (RawMessage) lore lines", () => {
  it("encodes tag + colour, the name's translate key and the Roman level", () => {
    expect(encodeRawLoreLine("minecraft:sharpness", 6)).toEqual({
      rawtext: [{ text: `${LORE_TAG}§d` }, { translate: "enchantment.damage.all" }, { text: " VI" }],
    });
    expect(encodeRawLoreLine("enchantaholic:hiccups", 2)).toEqual({
      rawtext: [{ text: `${LORE_TAG}§c` }, { translate: "enchantment.enchantaholic.hiccups" }, { text: " II" }],
    });
    expect(renderRaw(encodeRawLoreLine("enchantaholic:vein_miner", 3))).toBe(`${LORE_TAG}§9Vein Miner III`);
    expect(renderRaw(encodeRawLoreLine("enchantaholic:vein_miner", 3), "ru")).toBe(`${LORE_TAG}§9Жилокоп III`);
    expect(renderRaw(encodeRawLoreLine("minecraft:silk_touch", 2), "ru")).toBe(`${LORE_TAG}§dШелковое касание II`);
  });

  it("every vanilla and custom id round-trips at any level; the English rendering equals the legacy line", () => {
    for (const id of [...VANILLA, "enchantaholic:magnet", "enchantaholic:butterfingers"]) {
      for (const level of [6, 255, 3888, 5000]) {
        const raw = encodeRawLoreLine(id, level);
        expect(isManagedLine(raw)).toBe(true);
        expect(parseManagedLine(raw), id).toEqual({ id, level });
        expect(renderRaw(raw)).toBe(encodeLoreLine(displayName(id), level, loreColor(id)));
      }
    }
  });

  it("still parses legacy English string lines (items written before v0.3.1)", () => {
    expect(parseManagedLine(`${LORE_TAG}§dSharpness VIII`)).toEqual({ id: "minecraft:sharpness", level: 8 });
    expect(parseManagedLine(`${LORE_TAG}§9Vein Miner XII`)).toEqual({ id: "enchantaholic:vein_miner", level: 12 });
    expect(parseManagedLine({ text: `${LORE_TAG}§cCurse of Hiccups II` })).toEqual({
      id: "enchantaholic:hiccups",
      level: 2,
    });
  });

  it("accepts nested/concatenated shapes the engine might hand back", () => {
    const nested = { rawtext: [{ rawtext: [{ text: LORE_TAG }, { text: "§d" }] }, { translate: "enchantment.durability" }, { text: " X" }] };
    expect(parseManagedLine(nested)).toEqual({ id: "minecraft:unbreaking", level: 10 });
  });

  it("drops unknown keys, garbage and non-tagged raw lines are user lines", () => {
    const unknownKey = { rawtext: [{ text: `${LORE_TAG}§d` }, { translate: "enchantment.nope" }, { text: " VI" }] };
    const twoKeys = { rawtext: [{ text: `${LORE_TAG}§d` }, { translate: "enchantment.durability" }, { translate: "enchantment.mending" }, { text: " VI" }] };
    const noLevel = { rawtext: [{ text: `${LORE_TAG}§d` }, { translate: "enchantment.durability" }] };
    for (const l of [unknownKey, twoKeys, noLevel]) expect(parseManagedLine(l)).toBeUndefined();
    const userRaw = { rawtext: [{ text: "§7Blessed by " }, { translate: "item.apple.name" }] };
    const { user, managed } = splitLore([userRaw, unknownKey, encodeRawLoreLine("minecraft:mending", 3)]);
    expect(user).toEqual([userRaw]);
    expect(managed).toEqual(new Map([["minecraft:mending", 3]]));
  });

  it("legacy and raw lines of the same enchant merge (highest level wins); compose migrates to raw", () => {
    const lore = ["mine", `${LORE_TAG}§dSharpness VII`, encodeRawLoreLine("minecraft:sharpness", 9)];
    const s = splitLore(lore);
    expect(s.managed).toEqual(new Map([["minecraft:sharpness", 9]]));
    expect(composeLore(s.user, s.managed)).toEqual(["mine", encodeRawLoreLine("minecraft:sharpness", 9)]);
  });

  it("loreKey treats `{ text }` and a plain string as equal, and raw vs legacy as different", () => {
    expect(loreKey(["a", { text: "b" }])).toBe(loreKey([{ text: "a" }, "b"]));
    const raw = encodeRawLoreLine("minecraft:sharpness", 6);
    expect(loreKey([raw])).toBe(loreKey([structuredClone(raw)]));
    expect(loreKey([raw])).not.toBe(loreKey([encodeLoreLine("Sharpness", 6)]));
  });
});
