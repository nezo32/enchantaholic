import { LORE_MAX_CHARS, LORE_MAX_LINES, LORE_TAG } from "./config";
import { displayName, idFromDisplayName } from "./enchant-names";
import { fromRoman, toRoman } from "./roman";

/** Prefix of every managed lore line: invisible tag + light-purple color. */
const PREFIX = `${LORE_TAG}§d`;

/** `${LORE_TAG}§d${displayName} ${toRoman(level)}`; the name is truncated if the line would exceed LORE_MAX_CHARS. */
export function encodeLoreLine(displayName: string, level: number): string {
  const suffix = ` ${toRoman(level)}`;
  const room = Math.max(0, LORE_MAX_CHARS - PREFIX.length - suffix.length);
  const name = displayName.length > room ? displayName.slice(0, room) : displayName;
  return `${PREFIX}${name}${suffix}`.slice(0, LORE_MAX_CHARS);
}

/** Parses managed (LORE_TAG) lines only; anything else → undefined. */
export function parseLoreLine(line: string): { name: string; level: number } | undefined {
  if (!line.startsWith(PREFIX)) return undefined;
  const body = line.slice(PREFIX.length);
  const sp = body.lastIndexOf(" ");
  if (sp <= 0) return undefined;
  const name = body.slice(0, sp);
  const level = fromRoman(body.slice(sp + 1));
  if (level === undefined || level < 1) return undefined;
  return { name, level };
}

/**
 * Splits lore into user lines (kept verbatim, in order) and managed levels keyed by enchant id.
 * Tagged lines with unknown names are dropped. Duplicates keep the highest level.
 */
export function splitLore(lines: readonly string[]): { user: string[]; managed: Map<string, number> } {
  const user: string[] = [];
  const managed = new Map<string, number>();
  for (const line of lines) {
    if (!line.startsWith(LORE_TAG)) {
      user.push(line);
      continue;
    }
    const parsed = parseLoreLine(line);
    if (!parsed) continue;
    const id = idFromDisplayName(parsed.name);
    if (id === undefined) continue;
    managed.set(id, Math.max(parsed.level, managed.get(id) ?? 0));
  }
  return { user, managed };
}

/**
 * User lines first (as is), then managed lines sorted by display name.
 * Total ≤ LORE_MAX_LINES: managed lines are truncated first; user lines are cut only if they alone exceed the limit.
 */
export function composeLore(user: readonly string[], managed: ReadonlyMap<string, number>): string[] {
  const keptUser = user.slice(0, LORE_MAX_LINES);
  const room = LORE_MAX_LINES - keptUser.length;
  const lines = [...managed.entries()]
    .map(([id, level]) => ({ name: displayName(id), level }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.level - b.level))
    .slice(0, room)
    .map(({ name, level }) => encodeLoreLine(name, level));
  return [...keptUser, ...lines];
}
