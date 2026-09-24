/** Random source returning a float in [0, 1). */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Deterministic PRNG (tests only). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** floor(rng()*length), clamped to [0, length-1]. Throws RangeError if length <= 0. */
export function pickIndex(length: number, rng: Rng): number {
  if (!(length > 0)) throw new RangeError(`pickIndex: length must be > 0 (got ${length})`);
  const i = Math.floor(rng() * length);
  if (!Number.isFinite(i) || i < 0) return 0;
  return Math.min(i, length - 1);
}

/** Fisher–Yates shuffle on a copy. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIndex(i + 1, rng);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
