/**
 * Client-side text rendering for tests: resolves RawMessages the way a Bedrock client would, using the
 * add-on's resource_pack/texts/<lang>.lang plus the vanilla enchantment names (vanilla-lang.ts). Independent of
 * src/ so integration tests keep an oracle for what players actually read.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VANILLA_ENCHANT_LANG } from "./vanilla-lang";

export type Lang = "en" | "ru";

export const RP_TEXTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "resource_pack", "texts");

/** Parses a Bedrock .lang file: `key=value` lines; `##` comments and blank lines skipped; a `\t#` starts a comment. */
export function parseLang(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of src.replace(/^﻿/, "").split(/\r?\n/)) {
    if (raw.trim() === "" || raw.startsWith("#")) continue;
    const eq = raw.indexOf("=");
    if (eq <= 0) throw new Error(`Bad lang line: ${JSON.stringify(raw)}`);
    const key = raw.slice(0, eq);
    const value = raw.slice(eq + 1).split("\t#")[0]!;
    if (out.has(key)) throw new Error(`Duplicate lang key ${key}`);
    out.set(key, value);
  }
  return out;
}

const cache = new Map<Lang, Map<string, string>>();

/** Add-on RP lang merged over the vanilla enchantment names. */
export function langTable(lang: Lang): Map<string, string> {
  let t = cache.get(lang);
  if (!t) {
    t = new Map(Object.entries(VANILLA_ENCHANT_LANG).map(([k, v]) => [k, v[lang]]));
    const file = lang === "en" ? "en_US.lang" : "ru_RU.lang";
    for (const [k, v] of parseLang(fs.readFileSync(path.join(RP_TEXTS_DIR, file), "utf8"))) t.set(k, v);
    cache.set(lang, t);
  }
  return t;
}

interface Raw {
  text?: string;
  translate?: string;
  with?: string[] | Raw;
  rawtext?: Raw[];
}

/** Renders a string, a RawMessage or an array of them (as Player.sendMessage takes). Unknown keys render as the key. */
export function renderRaw(msg: unknown, lang: Lang = "en"): string {
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map((m) => renderRaw(m, lang)).join("");
  if (typeof msg !== "object" || msg === null) return String(msg);
  const m = msg as Raw;
  let out = m.text ?? "";
  if (m.translate !== undefined) {
    const template = langTable(lang).get(m.translate) ?? m.translate;
    const w = m.with;
    const args = w === undefined ? [] : Array.isArray(w) ? w : (w.rawtext ?? [w]).map((a) => renderRaw(a, lang));
    let i = 0;
    out += template.replace(/%s/g, () => args[i++] ?? "");
  }
  for (const part of m.rawtext ?? []) out += renderRaw(part, lang);
  return out;
}
