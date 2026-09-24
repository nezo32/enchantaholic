import fs from "node:fs";
import path from "node:path";
import { MinecraftEnchantmentTypes } from "@minecraft/vanilla-data";
import { describe, expect, it } from "vitest";
import { PACK_DIR, ROOT, RP_DIR } from "../../scripts/lib/paths.mjs";
import { CUSTOM_ENCHANTS } from "../../src/core/custom/roster";
import { displayName, idFromNameKey, nameKey } from "../../src/core/enchant-names";
import { EN, K } from "../../src/core/i18n";
import { parseLang } from "../fakes/lang";
import { VANILLA_ENCHANT_LANG } from "../fakes/vanilla-lang";

const LANGS = ["en_US", "ru_RU"] as const;
const DIRS = { BP: PACK_DIR, RP: RP_DIR } as const;

const rawFile = (dir: string, lang: string) => fs.readFileSync(path.join(dir, "texts", `${lang}.lang`));
const load = (dir: string, lang: string) => parseLang(rawFile(dir, lang).toString("utf8"));
const placeholders = (v: string) => (v.match(/%s/g) ?? []).length;

describe.each(Object.entries(DIRS))("%s texts", (_name, dir) => {
  it("languages.json lists exactly en_US and ru_RU, and both .lang files exist", () => {
    expect(JSON.parse(fs.readFileSync(path.join(dir, "texts", "languages.json"), "utf8"))).toEqual([...LANGS]);
    for (const l of LANGS) expect(fs.existsSync(path.join(dir, "texts", `${l}.lang`))).toBe(true);
  });

  it.each(LANGS)("%s.lang is clean UTF-8 (no BOM, LF, no trailing spaces, no empty values)", (lang) => {
    const buf = rawFile(dir, lang);
    expect([...buf.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    const text = buf.toString("utf8");
    expect(Buffer.from(text, "utf8").equals(buf)).toBe(true);
    expect(text).not.toContain("\r");
    expect(text.endsWith("\n")).toBe(true);
    for (const line of text.split("\n").filter((l) => l !== "")) {
      expect(line, line).toMatch(/^[a-z][A-Za-z0-9_.]*=\S(.*\S)?$/);
      expect(line, line).not.toContain("\t");
    }
  });

  it("ru_RU and en_US have identical key sets and matching %s counts", () => {
    const en = load(dir, "en_US");
    const ru = load(dir, "ru_RU");
    expect([...ru.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [k, v] of en) expect(placeholders(ru.get(k)!), k).toBe(placeholders(v));
    // § colour codes survive translation (same codes, same order).
    for (const [k, v] of en) expect(ru.get(k)!.match(/§./g) ?? [], k).toEqual(v.match(/§./g) ?? []);
  });

  it("names the pack Enchantaholic in both languages", () => {
    for (const l of LANGS) {
      expect(load(dir, l).get("pack.name")).toBe("Enchantaholic");
      expect(load(dir, l).get("pack.description")).toBeTruthy();
    }
  });
});

describe("resource pack keys vs scripts", () => {
  const en = load(RP_DIR, "en_US");
  const ru = load(RP_DIR, "ru_RU");

  it("en_US.lang is exactly EN (scripts' English fallback) plus pack.name/description", () => {
    const fromFile = Object.fromEntries([...en].filter(([k]) => !k.startsWith("pack.")));
    expect(fromFile).toEqual({ ...EN });
  });

  it("every translate key literal in src/ exists in en_US.lang or in the vanilla lang", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith(".ts")) files.push(p);
      }
    };
    walk(path.join(ROOT, "src"));
    const keys = new Set<string>();
    for (const f of files) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/["'`]((?:enchantaholic|enchantment)\.[A-Za-z0-9_.]+)["'`]/g)) {
        keys.add(m[1]!);
      }
    }
    expect(keys.size).toBeGreaterThan(40);
    for (const k of keys) expect(en.has(k) || k in VANILLA_ENCHANT_LANG, k).toBe(true);
    for (const k of Object.values(K)) expect(en.has(k), k).toBe(true);
  });

  it("every vanilla enchantment id maps to a verified vanilla key whose English name matches displayName", () => {
    const ids = Object.values(MinecraftEnchantmentTypes) as string[];
    expect(ids).toHaveLength(42);
    const used = new Set<string>();
    for (const id of ids) {
      const key = nameKey(id);
      expect(key, id).toBeDefined();
      expect(VANILLA_ENCHANT_LANG[key!]?.en, `${id} → ${key}`).toBe(displayName(id));
      expect(idFromNameKey(key!)).toBe(id);
      used.add(key!);
    }
    expect([...used].sort()).toEqual(Object.keys(VANILLA_ENCHANT_LANG).sort());
  });

  it("custom enchantments use enchantment.enchantaholic.<key> with the glossary's Russian names", () => {
    const glossary: Record<string, string> = {
      vein_miner: "Жилокоп",
      barrage: "Шквал",
      yeet: "Улёт",
      kaboom: "Бабах",
      party_popper: "Хлопушка",
      chicken_rain: "Куриный дождь",
      midas_touch: "Прикосновение Мидаса",
      magnet: "Магнит",
      moon_boots: "Лунные ботинки",
      butterfingers: "Проклятие дырявых рук",
      hiccups: "Проклятие икоты",
    };
    for (const d of CUSTOM_ENCHANTS) {
      const key = nameKey(d.id)!;
      expect(key).toBe(`enchantment.enchantaholic.${d.key}`);
      expect(en.get(key)).toBe(d.name);
      expect(ru.get(key)).toBe(glossary[d.key]);
      expect(idFromNameKey(key)).toBe(d.id);
    }
    expect(nameKey("addon:unknown")).toBeUndefined();
  });

  it("uses the glossary wording for the UI texts", () => {
    expect(ru.get(K.on)).toBe("§aВкл");
    expect(ru.get(K.off)).toBe("§cВыкл");
    expect(ru.get(K.modeStatus)).toBe("Режим Enchantaholic: %s");
    expect(ru.get(K.customStatus)).toBe("Особые зачарования: %s");
    expect(ru.get(K.notifySound)).toBe("Звук зачарования: %s");
    expect(ru.get(K.notifyMessage)).toBe("Сообщение о зачаровании: %s");
    // Command syntax stays untranslated (the command and its enum values are fixed).
    for (const k of [K.customUsage, K.notifyUsage, K.customModeOffHint]) {
      const cmd = en.get(k)!.match(/\/enchantaholic:\S+/)![0];
      expect(ru.get(k), k).toContain(cmd);
    }
  });
});
