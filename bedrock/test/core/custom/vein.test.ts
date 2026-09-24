import { describe, expect, it } from "vitest";
import { sameVeinType, VEIN_DENY, VeinWalker, type Pos } from "../../../src/core/custom/vein";

const k = (p: Pos): string => `${p.x},${p.y},${p.z}`;
const setOf = (ps: Pos[]): Set<string> => new Set(ps.map(k));
const inSet = (s: Set<string>) => (p: Pos) => s.has(k(p));

function cube(n: number): Set<string> {
  const s = new Set<string>();
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) s.add(`${x},${y},${z}`);
  return s;
}

describe("VeinWalker", () => {
  it("never yields the origin and walks in BFS order", () => {
    const line = new Set(["0,0,0", "1,0,0", "2,0,0", "3,0,0"]);
    const w = new VeinWalker({ x: 0, y: 0, z: 0 }, 100);
    const out = w.next(100, inSet(line));
    expect(out.map(k)).toEqual(["1,0,0", "2,0,0", "3,0,0"]);
    expect(w.done).toBe(true);
    expect(w.yielded).toBe(3);
  });

  it("finds blocks connected only diagonally (26-neighbourhood)", () => {
    const diag = new Set(["0,0,0", "1,1,1", "2,2,2", "4,0,0"]);
    const w = new VeinWalker({ x: 0, y: 0, z: 0 }, 100);
    const out = w.next(100, inSet(diag));
    expect(setOf(out)).toEqual(new Set(["1,1,1", "2,2,2"]));
  });

  it("yields nearer blocks before farther ones", () => {
    const w = new VeinWalker({ x: 0, y: 0, z: 0 }, 1000);
    const c = new Set([...cube(5)].map((s) => s));
    const out = w.next(1000, inSet(c));
    const cheb = out.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)));
    for (let i = 1; i < cheb.length; i++) expect(cheb[i]).toBeGreaterThanOrEqual(cheb[i - 1] as number);
    expect(out).toHaveLength(124);
  });

  it("respects the limit and the per-call budget", () => {
    const w = new VeinWalker({ x: 0, y: 0, z: 0 }, 50);
    const m = inSet(cube(5));
    const a = w.next(32, m);
    expect(a).toHaveLength(32);
    expect(w.done).toBe(false);
    const b = w.next(32, m);
    expect(b).toHaveLength(18);
    expect(w.done).toBe(true);
    expect(w.yielded).toBe(50);
    expect(w.next(32, m)).toEqual([]);
    expect(setOf([...a, ...b]).size).toBe(50);
    expect(setOf([...a, ...b]).has("0,0,0")).toBe(false);
  });

  it("limit 0 is done at once; an isolated origin is done after one call", () => {
    expect(new VeinWalker({ x: 0, y: 0, z: 0 }, 0).done).toBe(true);
    const w = new VeinWalker({ x: 0, y: 0, z: 0 }, 8);
    expect(w.next(32, () => false)).toEqual([]);
    expect(w.done).toBe(true);
  });

  it("checks candidates lazily (a block that changed is skipped)", () => {
    const live = cube(3);
    const w = new VeinWalker({ x: 0, y: 0, z: 0 }, 100);
    const first = w.next(1, inSet(live));
    expect(first).toHaveLength(1);
    live.clear();
    expect(w.next(100, inSet(live))).toEqual([]);
    expect(w.done).toBe(true);
  });
});

describe("vein types", () => {
  it("lit and unlit redstone ore are the same type", () => {
    expect(sameVeinType("minecraft:redstone_ore", "minecraft:lit_redstone_ore")).toBe(true);
    expect(sameVeinType("minecraft:lit_deepslate_redstone_ore", "minecraft:deepslate_redstone_ore")).toBe(true);
    expect(sameVeinType("minecraft:redstone_ore", "minecraft:deepslate_redstone_ore")).toBe(false);
    expect(sameVeinType("minecraft:stone", "minecraft:stone")).toBe(true);
    expect(sameVeinType("minecraft:stone", "minecraft:cobblestone")).toBe(false);
  });

  it("deny list holds unbreakable and technical blocks", () => {
    for (const id of ["bedrock", "barrier", "command_block", "end_portal_frame", "air", "water", "lava", "portal"]) {
      expect(VEIN_DENY.has(`minecraft:${id}`)).toBe(true);
    }
    expect(VEIN_DENY.has("minecraft:stone")).toBe(false);
  });
});
