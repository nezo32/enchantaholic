/** Incremental breadth-first walk over connected blocks for Vein Miner. Pure. */

export type Pos = { x: number; y: number; z: number };

const key = (p: Pos): string => `${p.x},${p.y},${p.z}`;

/** The 26 neighbour offsets, in a fixed order (y, then x, then z). */
const OFFSETS: readonly Pos[] = (() => {
  const out: Pos[] = [];
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) if (x !== 0 || y !== 0 || z !== 0) out.push({ x, y, z });
    }
  }
  return out;
})();

/**
 * Walks the blocks connected to `origin` through the 26-neighbourhood, a batch at a time.
 * Candidates are checked with `matches` only when they are dequeued, so a batch always sees the
 * current world. Non-matching candidates are neither yielded nor expanded. The origin is expanded
 * but never yielded (the player already broke it). The visited set is capped at `limit * 27` keys.
 */
export class VeinWalker {
  private readonly queue: Pos[];
  private head = 0;
  private readonly visited = new Set<string>();
  private readonly maxVisited: number;
  private count = 0;
  private originExpanded = false;

  constructor(
    origin: Pos,
    private readonly limit: number,
  ) {
    const o = { x: origin.x, y: origin.y, z: origin.z };
    this.queue = [o];
    this.visited.add(key(o));
    this.maxVisited = Math.max(1, limit * 27);
  }

  get done(): boolean {
    return this.count >= this.limit || this.head >= this.queue.length;
  }

  get yielded(): number {
    return this.count;
  }

  /** Up to `budget` positions whose `matches(p)` is true, in BFS order; stops after `limit` in total. */
  next(budget: number, matches: (p: Pos) => boolean): Pos[] {
    const out: Pos[] = [];
    while (out.length < budget && !this.done) {
      const p = this.queue[this.head++] as Pos;
      if (!this.originExpanded) {
        this.originExpanded = true;
      } else {
        if (!matches(p)) continue;
        out.push(p);
        this.count++;
        if (this.count >= this.limit) break;
      }
      this.expand(p);
    }
    // Free the consumed part of the queue now and then.
    if (this.head > 4096) {
      this.queue.splice(0, this.head);
      this.head = 0;
    }
    return out;
  }

  private expand(p: Pos): void {
    for (const o of OFFSETS) {
      if (this.visited.size >= this.maxVisited) return;
      const n = { x: p.x + o.x, y: p.y + o.y, z: p.z + o.z };
      const k = key(n);
      if (this.visited.has(k)) continue;
      this.visited.add(k);
      this.queue.push(n);
    }
  }
}

/** Block ids that count as the same type for a vein (lit and unlit redstone ore). */
const EQUIVALENT: ReadonlyMap<string, string> = new Map([
  ["minecraft:lit_redstone_ore", "minecraft:redstone_ore"],
  ["minecraft:lit_deepslate_redstone_ore", "minecraft:deepslate_redstone_ore"],
]);

const canonical = (id: string): string => EQUIVALENT.get(id) ?? id;

/** True when `a` and `b` are the same block type for Vein Miner. */
export function sameVeinType(a: string, b: string): boolean {
  return canonical(a) === canonical(b);
}

/** Blocks Vein Miner never breaks (unbreakable, technical, fluids, portals). */
export const VEIN_DENY: ReadonlySet<string> = new Set([
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:command_block",
  "minecraft:chain_command_block",
  "minecraft:repeating_command_block",
  "minecraft:structure_block",
  "minecraft:structure_void",
  "minecraft:jigsaw",
  "minecraft:end_portal_frame",
  "minecraft:reinforced_deepslate",
  "minecraft:air",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:light_block",
  ...Array.from({ length: 16 }, (_, i) => `minecraft:light_block_${i}`),
  "minecraft:allow",
  "minecraft:deny",
  "minecraft:border_block",
  "minecraft:moving_block",
  "minecraft:portal",
  "minecraft:end_portal",
  "minecraft:end_gateway",
]);
