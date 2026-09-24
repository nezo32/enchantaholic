import { system, type Entity, type ProjectileHitBlockAfterEvent, type ProjectileHitEntityAfterEvent } from "@minecraft/server";
import { KABOOM_MAX_PER_TICK, MAX_TRACKED_KABOOM } from "../../core/custom/tuning";
import { warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { forgetCopy, isCopy } from "./copies";

interface Tracked {
  readonly power: number;
  readonly owner: Entity | undefined;
}

/** In-flight Kaboom projectiles by entity id (oldest evicted first). */
const tracked = new Map<string, Tracked>();
let budgetTick = -1;
let budgetUsed = 0;

const TRIDENT = "minecraft:thrown_trident";

/** Marks a projectile to explode on impact with `power`. */
export function trackKaboom(entity: Entity, power: number, owner?: Entity): void {
  if (!(power > 0)) return;
  tracked.delete(entity.id);
  tracked.set(entity.id, { power, owner });
  while (tracked.size > MAX_TRACKED_KABOOM) {
    const oldest = tracked.keys().next().value;
    if (oldest === undefined) break;
    tracked.delete(oldest);
  }
}

export function forgetKaboom(entityId: string): void {
  tracked.delete(entityId);
}

function takeBudget(): boolean {
  if (budgetTick !== system.currentTick) {
    budgetTick = system.currentTick;
    budgetUsed = 0;
  }
  if (budgetUsed >= KABOOM_MAX_PER_TICK) return false;
  budgetUsed++;
  return true;
}

function removeProjectile(projectile: Entity): void {
  try {
    if (projectile.isValid) projectile.remove();
  } catch (err) {
    warnOnce("kaboom:remove", err);
  }
}

/**
 * Projectile impact: a Kaboom projectile explodes (no block damage, no fire; at most 16 per tick);
 * a Barrage copy is removed so it can never be picked up.
 */
export function onProjectileHit(ev: ProjectileHitBlockAfterEvent | ProjectileHitEntityAfterEvent): void {
  const projectile = ev.projectile;
  let id: string;
  try {
    id = projectile.id;
  } catch {
    return;
  }
  const copy = isCopy(projectile);
  const boom = tracked.get(id);
  if (boom) {
    tracked.delete(id);
    if (isCustomEnabled() && takeBudget()) {
      const owner = boom.owner?.isValid ? boom.owner : undefined;
      ev.dimension.createExplosion(ev.location, boom.power, {
        breaksBlocks: false,
        causesFire: false,
        allowUnderwater: false,
        ...(owner ? { source: owner } : {}),
      });
      // A real (non-copy) trident is the player's item: never delete it.
      if (copy || projectile.typeId !== TRIDENT) {
        if (copy) forgetCopy(id);
        removeProjectile(projectile);
        return;
      }
    }
  }
  if (copy) {
    forgetCopy(id);
    removeProjectile(projectile);
  }
}

/** Test helpers. */
export function _trackedKaboom(): ReadonlyMap<string, Tracked> {
  return tracked;
}
export function _resetKaboom(): void {
  tracked.clear();
  budgetTick = -1;
  budgetUsed = 0;
}
