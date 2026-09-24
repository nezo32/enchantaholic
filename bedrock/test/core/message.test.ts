import { describe, expect, it } from "vitest";
import { CUSTOM_ENCHANTS } from "../../src/core/custom/roster";
import {
  buildEnchantMessage,
  CUSTOM_MODE_OFF_HINT,
  customChangedText,
  customStatusText,
  englishText,
  statusText,
  withHint,
} from "../../src/core/message";
import { renderRaw } from "../fakes/lang";

const SHARP = { id: "minecraft:sharpness", maxLevel: 5 };
const BINDING = { id: "minecraft:binding", maxLevel: 1 };
/** The enchantment part (after the arrow) as an English / Russian client renders it. */
const tail = (parts: unknown[], lang: "en" | "ru" = "en") => renderRaw(parts.slice(2), lang).replace("§r§7 → ", "");

describe("buildEnchantMessage", () => {
  it("uses translate keys for the item and the vanilla enchantment", () => {
    expect(buildEnchantMessage({ localizationKey: "item.diamond_sword.name" }, SHARP, 1)).toEqual([
      { text: "§d✦ " },
      { translate: "item.diamond_sword.name" },
      { text: "§r§7 → §b" },
      { translate: "enchantment.damage.all" },
      { text: " I" },
    ]);
  });

  it("renders per client language", () => {
    const parts = buildEnchantMessage({ localizationKey: "item.diamond_sword.name" }, SHARP, 7);
    expect(tail(parts)).toBe("§bSharpness §6VII");
    expect(tail(parts, "ru")).toBe("§bОстрота §6VII");
    expect(englishText(parts)).toBe("§d✦ item.diamond_sword.name§r§7 → §bSharpness §6VII");
  });

  it("uses the nameTag as text when present", () => {
    const parts = buildEnchantMessage({ nameTag: "Excalibur", localizationKey: "item.diamond_sword.name" }, SHARP, 4);
    expect(parts[1]).toEqual({ text: "Excalibur" });
    expect(tail(parts)).toBe("§bSharpness IV");
  });

  it("treats an empty nameTag as absent", () => {
    const parts = buildEnchantMessage({ nameTag: "", localizationKey: "k" }, SHARP, 1);
    expect(parts[1]).toEqual({ translate: "k" });
  });

  it("colors curses red and overcapped levels gold", () => {
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, BINDING, 1))).toBe("§cCurse of Binding I");
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, BINDING, 3))).toBe("§cCurse of Binding §6III");
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, SHARP, 5))).toBe("§bSharpness V");
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, SHARP, 14))).toBe("§bSharpness §6XIV");
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, SHARP, 5000))).toBe("§bSharpness §65000");
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, BINDING, 1), "ru")).toBe("§cПроклятие связи I");
  });

  it("unknown enchantments fall back to an English text name", () => {
    const parts = buildEnchantMessage({ localizationKey: "k" }, { id: "addon:super_speed", maxLevel: 3 }, 2);
    expect(parts[3]).toEqual({ text: "Super Speed" });
  });
});

describe("statusText", () => {
  it("renders ON/OFF in both languages", () => {
    expect(statusText(true)).toEqual({
      translate: "enchantaholic.mode.status",
      with: { rawtext: [{ translate: "enchantaholic.state.on" }] },
    });
    expect(renderRaw(statusText(true))).toBe("Enchantaholic Mode: §aON");
    expect(renderRaw(statusText(false))).toBe("Enchantaholic Mode: §cOFF");
    expect(renderRaw(statusText(true), "ru")).toBe("Режим Enchantaholic: §aВкл");
    expect(renderRaw(statusText(false), "ru")).toBe("Режим Enchantaholic: §cВыкл");
    expect(englishText(statusText(false))).toBe("Enchantaholic Mode: §cOFF");
  });
});

describe("custom enchantment texts", () => {
  it("status and change replies", () => {
    expect(renderRaw(customStatusText(true))).toBe("Custom Enchantments: §aON");
    expect(renderRaw(customStatusText(false))).toBe("Custom Enchantments: §cOFF");
    expect(renderRaw(customChangedText(true))).toBe("Custom Enchantments are now §aON§r for this world");
    expect(renderRaw(customChangedText(false))).toBe("Custom Enchantments are now §cOFF§r for this world");
    expect(renderRaw(customChangedText(true), "ru")).toBe("Особые зачарования теперь §aВкл§r в этом мире");
    expect(renderRaw(customStatusText(false), "ru")).toBe("Особые зачарования: §cВыкл");
    expect(renderRaw(CUSTOM_MODE_OFF_HINT)).toContain("/enchantaholic:toggle on");
    expect(renderRaw(CUSTOM_MODE_OFF_HINT, "ru")).toContain("/enchantaholic:toggle on");
    expect(englishText(withHint(customChangedText(true)))).toBe(
      `Custom Enchantments are now §aON§r for this world\n${renderRaw(CUSTOM_MODE_OFF_HINT)}`,
    );
  });

  it("custom curses are red, customs aqua, levels above 5 gold; names are translated", () => {
    const hiccups = CUSTOM_ENCHANTS.find((d) => d.key === "hiccups")!;
    const magnet = CUSTOM_ENCHANTS.find((d) => d.key === "magnet")!;
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, hiccups, 2))).toBe("§cCurse of Hiccups II");
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, magnet, 7))).toBe("§bMagnet §6VII");
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, hiccups, 2), "ru")).toBe("§cПроклятие икоты II");
    expect(tail(buildEnchantMessage({ localizationKey: "k" }, magnet, 7), "ru")).toBe("§bМагнит §6VII");
  });
});
