import { LORE_MAX_CHARS, LORE_MAX_LINES, LORE_TAG } from "./config";
import { customDef } from "./custom/roster";
import { displayName, idFromDisplayName, idFromNameKey, nameMsg } from "./enchant-names";
import type { Msg } from "./i18n";
import { fromRoman, toRoman } from "./roman";

/**
 * A lore line as ItemStack.setLore takes it: a plain string or a RawMessage.
 *
 * Managed lines (true levels above max and custom enchantments) are written as RawMessages,
 * `{ rawtext: [{ text: LORE_TAG + "§<color>" }, { translate: <enchantment name key> }, { text: " <Roman>" }] }`,
 * so the tooltip shows the name in the viewer's language while the translate key keeps the line
 * machine-readable. The legacy English string form (`${LORE_TAG}§<color><English name> <Roman>`, written
 * before v0.3.1 and used as a fallback when the engine rejects RawMessage lore) is still parsed.
 */
export type LoreLine = string | Msg;
export type LoreFormat = "raw" | "text";

/** Invisible tag + one colour code: §d vanilla overcap, §9 custom enchantment, §c custom curse. */
const PREFIX_RE = new RegExp(`^${LORE_TAG}§[0-9a-f]`);
const PREFIX_LEN = LORE_TAG.length + 2;

/** Colour code of an enchantment's managed lore line: "d" (vanilla overcap), "9" (custom) or "c" (custom curse). */
export function loreColor(id: string): string {
  const def = customDef(id);
  if (!def) return "d";
  return def.curse ? "c" : "9";
}

/** Legacy/fallback string line: `${LORE_TAG}§<color>${displayName} ${toRoman(level)}`, name truncated to fit LORE_MAX_CHARS. */
export function encodeLoreLine(displayName: string, level: number, color = "d"): string {
  const prefix = `${LORE_TAG}§${color}`;
  const suffix = ` ${toRoman(level)}`;
  const room = Math.max(0, LORE_MAX_CHARS - prefix.length - suffix.length);
  const name = displayName.length > room ? displayName.slice(0, room) : displayName;
  return `${prefix}${name}${suffix}`.slice(0, LORE_MAX_CHARS);
}

/** Localized managed line (see LoreLine). */
export function encodeRawLoreLine(id: string, level: number, color = loreColor(id)): Msg {
  return { rawtext: [{ text: `${LORE_TAG}§${color}` }, nameMsg(id), { text: ` ${toRoman(level)}` }] };
}

/** Parses legacy string managed lines (LORE_TAG + one colour code) only; anything else → undefined. */
export function parseLoreLine(line: string): { name: string; level: number } | undefined {
  if (!PREFIX_RE.test(line)) return undefined;
  const body = line.slice(PREFIX_LEN);
  const sp = body.lastIndexOf(" ");
  if (sp <= 0) return undefined;
  const name = body.slice(0, sp);
  const level = fromRoman(body.slice(sp + 1));
  if (level === undefined || level < 1) return undefined;
  return { name, level };
}

/** Marks a known name key inside the flattened text; cannot occur in real lore text. */
const KEY_MARK = "\u0000";

/**
 * Flattens a line to one string: text parts as is, translate parts as KEY_MARK + key + KEY_MARK
 * (their `with` arguments are ignored). Plain strings are returned unchanged.
 */
function flatten(line: LoreLine): string {
  if (typeof line === "string") return line;
  if (typeof line !== "object" || line === null) return "";
  let out = typeof line.text === "string" ? line.text : "";
  if (typeof line.translate === "string") out += `${KEY_MARK}${line.translate}${KEY_MARK}`;
  if (Array.isArray(line.rawtext)) for (const part of line.rawtext) out += flatten(part);
  return out;
}

/** True when the line carries the managed-line tag (string or RawMessage form). */
export function isManagedLine(line: LoreLine): boolean {
  return flatten(line).startsWith(LORE_TAG);
}

/** Enchant id and level of a managed line in either form; undefined for other lines and unknown names. */
export function parseManagedLine(line: LoreLine): { id: string; level: number } | undefined {
  const flat = flatten(line);
  const keyed = /^([^\0]*)\0([^\0]+)\0([^\0]*)$/.exec(flat);
  if (keyed) {
    const id = idFromNameKey(keyed[2]!);
    if (id === undefined) return undefined;
    const parsed = parseLoreLine(`${keyed[1]}${displayName(id)}${keyed[3]}`);
    return parsed ? { id, level: parsed.level } : undefined;
  }
  if (flat.includes(KEY_MARK)) return undefined;
  const parsed = parseLoreLine(flat);
  if (!parsed) return undefined;
  const id = idFromDisplayName(parsed.name);
  return id === undefined ? undefined : { id, level: parsed.level };
}

/**
 * Splits lore into user lines (kept verbatim, in order) and managed levels keyed by enchant id.
 * Tagged lines with unknown names are dropped. Duplicates keep the highest level.
 */
export function splitLore(lines: readonly LoreLine[]): { user: LoreLine[]; managed: Map<string, number> } {
  const user: LoreLine[] = [];
  const managed = new Map<string, number>();
  for (const line of lines) {
    if (!isManagedLine(line)) {
      user.push(line);
      continue;
    }
    const parsed = parseManagedLine(line);
    if (!parsed) continue;
    managed.set(parsed.id, Math.max(parsed.level, managed.get(parsed.id) ?? 0));
  }
  return { user, managed };
}

/**
 * User lines first (as is), then managed lines sorted by English display name (the same order in every
 * language). Total ≤ LORE_MAX_LINES: managed lines are truncated first; user lines are cut only if they
 * alone exceed the limit. `format` "raw" (default) writes localized RawMessage lines, "text" the legacy strings.
 */
export function composeLore(
  user: readonly LoreLine[],
  managed: ReadonlyMap<string, number>,
  format: LoreFormat = "raw",
): LoreLine[] {
  const keptUser = user.slice(0, LORE_MAX_LINES);
  const room = LORE_MAX_LINES - keptUser.length;
  const lines = [...managed.entries()]
    .map(([id, level]) => ({ id, name: displayName(id), level, color: loreColor(id) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.level - b.level))
    .slice(0, room)
    .map(({ id, name, level, color }) =>
      format === "raw" ? encodeRawLoreLine(id, level, color) : encodeLoreLine(name, level, color),
    );
  return [...keptUser, ...lines];
}

/** Canonical form for comparing lore read back from the engine with lore about to be written. */
export function loreKey(lines: readonly LoreLine[]): string {
  return JSON.stringify(lines.map(flatten));
}
