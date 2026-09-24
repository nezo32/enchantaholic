import { describe, expect, it } from "vitest";
import { CUSTOM_ENCHANTS } from "../../src/core/custom/roster";
import {
  buildEnchantMessage,
  CUSTOM_MODE_OFF_HINT,
  customChangedText,
  customStatusText,
  statusText,
} from "../../src/core/message";

const SHARP = { id: "minecraft:sharpness", maxLevel: 5 };
const BINDING = { id: "minecraft:binding", maxLevel: 1 };

describe("buildEnchantMessage", () => {
  it("uses translate when there is no nameTag", () => {
    expect(buildEnchantMessage({ localizationKey: "item.diamond_sword.name" }, SHARP, 1)).toEqual([
      { text: "§d✦ " },
      { translate: "item.diamond_sword.name" },
      { text: "§r§7 → " },
      { text: "§bSharpness I" },
    ]);
  });

  it("uses the nameTag as text when present", () => {
    const parts = buildEnchantMessage({ nameTag: "Excalibur", localizationKey: "item.diamond_sword.name" }, SHARP, 4);
    expect(parts[1]).toEqual({ text: "Excalibur" });
    expect(parts[3]).toEqual({ text: "§bSharpness IV" });
  });

  it("treats an empty nameTag as absent", () => {
    const parts = buildEnchantMessage({ nameTag: "", localizationKey: "k" }, SHARP, 1);
    expect(parts[1]).toEqual({ translate: "k" });
  });

  it("colors curses red and overcapped levels gold", () => {
    expect(buildEnchantMessage({ localizationKey: "k" }, BINDING, 1)[3]).toEqual({ text: "§cCurse of Binding I" });
    expect(buildEnchantMessage({ localizationKey: "k" }, BINDING, 3)[3]).toEqual({ text: "§cCurse of Binding §6III" });
    expect(buildEnchantMessage({ localizationKey: "k" }, SHARP, 5)[3]).toEqual({ text: "§bSharpness V" });
    expect(buildEnchantMessage({ localizationKey: "k" }, SHARP, 14)[3]).toEqual({ text: "§bSharpness §6XIV" });
    expect(buildEnchantMessage({ localizationKey: "k" }, SHARP, 5000)[3]).toEqual({ text: "§bSharpness §65000" });
  });
});

describe("statusText", () => {
  it("renders ON/OFF", () => {
    expect(statusText(true)).toBe("Enchantaholic Mode: §aON");
    expect(statusText(false)).toBe("Enchantaholic Mode: §cOFF");
  });
});

describe("custom enchantment texts", () => {
  it("status and change replies", () => {
    expect(customStatusText(true)).toBe("Custom Enchantments: §aON");
    expect(customStatusText(false)).toBe("Custom Enchantments: §cOFF");
    expect(customChangedText(true)).toBe("Custom Enchantments are now §aON§r for this world");
    expect(customChangedText(false)).toBe("Custom Enchantments are now §cOFF§r for this world");
    expect(CUSTOM_MODE_OFF_HINT).toContain("/enchantaholic:toggle on");
  });

  it("custom curses are red, customs aqua, levels above 5 gold", () => {
    const hiccups = CUSTOM_ENCHANTS.find((d) => d.key === "hiccups")!;
    const magnet = CUSTOM_ENCHANTS.find((d) => d.key === "magnet")!;
    expect(buildEnchantMessage({ localizationKey: "k" }, hiccups, 2)[3]).toEqual({ text: "§cCurse of Hiccups II" });
    expect(buildEnchantMessage({ localizationKey: "k" }, magnet, 7)[3]).toEqual({ text: "§bMagnet §6VII" });
  });
});

