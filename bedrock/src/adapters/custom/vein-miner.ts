import {
  EntityComponentTypes,
  ItemComponentTypes,
  system,
  type Dimension,
  type ItemDurabilityComponent,
  type ItemStack,
  type Player,
  type PlayerBreakBlockAfterEvent,
} from "@minecraft/server";
import { unbreakingSkips, veinLimit } from "../../core/custom/math";
import { CUSTOM } from "../../core/custom/roster";
import { VEIN_BLOCKS_PER_TICK, VEIN_MAX_JOBS } from "../../core/custom/tuning";
import { sameVeinType, VEIN_DENY, VeinWalker, type Pos } from "../../core/custom/vein";
import { defaultRng, type Rng } from "../../core/rng";
import { getCustomLevel, getEnchantable } from "../item-levels";
import { safe, warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { activePlayer, isCreative } from "./gate";

export interface VeinJob {
  readonly player: Player;
  readonly dimension: Dimension;
  /** Block type of the vein (the block the player broke). */
  readonly typeId: string;
  readonly walker: VeinWalker;
  /** Hotbar slot holding the tool; the job aborts when the selection changes. */
  readonly slot: number;
  /** Tool type after the real break (undefined for an empty hand). */
  readonly toolTypeId: string | undefined;
  /** Tool durability damage the slot must still have (undefined for items without durability). */
  lastDamage: number | undefined;
  readonly creative: boolean;
  finished: boolean;
}

const jobs: VeinJob[] = [];
let intervalId: number | undefined;
let rng: Rng = defaultRng;

function durabilityOf(item: ItemStack | undefined): ItemDurabilityComponent | undefined {
  try {
    return item?.getComponent(ItemComponentTypes.Durability);
  } catch {
    return undefined;
  }
}

function unbreakingOf(item: ItemStack): number {
  try {
    return getEnchantable(item)?.getEnchantment("minecraft:unbreaking")?.level ?? 0;
  } catch {
    return 0;
  }
}

function containerOf(player: Player) {
  return player.getComponent(EntityComponentTypes.Inventory)?.container;
}

function breakBlock(job: VeinJob, p: Pos): void {
  try {
    job.dimension.runCommand(`setblock ${p.x} ${p.y} ${p.z} air ${job.creative ? "replace" : "destroy"}`);
  } catch (err) {
    warnOnce("vein:setblock", err);
  }
}

function toolBreaks(player: Player, slot: number): void {
  try {
    containerOf(player)?.setItem(slot, undefined);
  } catch (err) {
    warnOnce("vein:tool-break", err);
  }
  try {
    player.playSound("random.break");
  } catch {
    // Cosmetic only.
  }
}

/** Runs one batch of a job. Marks the job finished when it is done or must abort. */
function runBatch(job: VeinJob): void {
  if (job.finished) return;
  const { player } = job;
  if (!isCustomEnabled() || !player.isValid || player.selectedSlotIndex !== job.slot) {
    job.finished = true;
    return;
  }
  const container = containerOf(player);
  if (!container) {
    job.finished = true;
    return;
  }
  // The slot must still hold the same tool in the same state, otherwise a swap could dupe or cheat.
  const tool = container.getItem(job.slot);
  const durability = durabilityOf(tool);
  if (tool?.typeId !== job.toolTypeId || durability?.damage !== job.lastDamage) {
    job.finished = true;
    return;
  }

  const dim = job.dimension;
  const positions = job.walker.next(VEIN_BLOCKS_PER_TICK, (p) => {
    const b = dim.getBlock(p);
    return !!b && sameVeinType(b.typeId, job.typeId) && !VEIN_DENY.has(b.typeId);
  });

  const wear = !job.creative && tool !== undefined && durability !== undefined && !durability.unbreakable;
  const unbreaking = wear && tool ? unbreakingOf(tool) : 0;
  let damage = durability?.damage ?? 0;
  const max = durability?.maxDurability ?? 0;
  let changed = false;
  for (const p of positions) {
    breakBlock(job, p);
    if (!wear || unbreakingSkips(unbreaking, rng)) continue;
    damage += 1;
    changed = true;
    if (damage >= max) {
      toolBreaks(player, job.slot);
      job.finished = true;
      return;
    }
  }
  if (changed && tool && durability) {
    try {
      durability.damage = damage;
      container.setItem(job.slot, tool);
      job.lastDamage = damage;
    } catch (err) {
      warnOnce("vein:tool-write", err);
      job.finished = true;
      return;
    }
  }
  if (job.walker.done) job.finished = true;
}

function stopLoopIfIdle(): void {
  if (jobs.length > 0 || intervalId === undefined) return;
  try {
    system.clearRun(intervalId);
  } catch {
    // Already cleared.
  }
  intervalId = undefined;
}

/** Runs one batch of every active job (≤ 32 blocks each) and drops finished jobs. */
export function veinTick(): void {
  for (const job of [...jobs]) {
    try {
      runBatch(job);
    } catch (err) {
      job.finished = true;
      warnOnce("vein:tick", err);
    }
  }
  for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i]?.finished) jobs.splice(i, 1);
  stopLoopIfIdle();
}

/** Vein Miner: breaks up to 8×L connected blocks of the broken type, spread over ticks. */
export function startVein(ev: PlayerBreakBlockAfterEvent, random: Rng = defaultRng): void {
  const player = ev.player;
  if (!activePlayer(player)) return;
  const before = ev.itemStackBeforeBreak;
  const level = getCustomLevel(before, CUSTOM.vein_miner);
  if (level <= 0) return;
  const after = ev.itemStackAfterBreak;
  // The held item broke (or was used up) on the real break: nothing left to mine with.
  if (before && !after) return;
  const typeId = ev.brokenBlockPermutation.type.id;
  if (VEIN_DENY.has(typeId) || jobs.length >= VEIN_MAX_JOBS) return;

  rng = random;
  const loc = ev.block.location;
  const job: VeinJob = {
    player,
    dimension: ev.dimension,
    typeId,
    walker: new VeinWalker({ x: loc.x, y: loc.y, z: loc.z }, veinLimit(level)),
    slot: player.selectedSlotIndex,
    toolTypeId: after?.typeId,
    lastDamage: durabilityOf(after)?.damage,
    creative: isCreative(player),
    finished: false,
  };
  // First batch now, so nothing else (butterfingers, a slot switch) can race it.
  runBatch(job);
  if (job.finished) return;
  jobs.push(job);
  intervalId ??= system.runInterval(safe("vein:loop", veinTick), 1);
}

/** Test helpers. */
export function _jobs(): readonly VeinJob[] {
  return jobs;
}
export function _resetVein(): void {
  jobs.length = 0;
  if (intervalId !== undefined) {
    try {
      system.clearRun(intervalId);
    } catch {
      // ignore
    }
  }
  intervalId = undefined;
  rng = defaultRng;
}
