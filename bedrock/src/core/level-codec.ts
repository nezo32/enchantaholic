/** Encode true levels as JSON with stable (sorted) key order; undefined if empty. */
export function encodeLevels(m: ReadonlyMap<string, number>): string | undefined {
  if (m.size === 0) return undefined;
  const obj: Record<string, number> = {};
  for (const key of [...m.keys()].sort()) obj[key] = m.get(key) as number;
  return JSON.stringify(obj);
}

/** Tolerant decode: never throws; skips anything that isn't a positive integer level. */
export function decodeLevels(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (typeof raw !== "string") return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 1) out.set(key, value);
  }
  return out;
}
