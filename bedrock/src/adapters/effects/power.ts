import { EntityComponentTypes, world, type Entity, type Player } from "@minecraft/server";
import { powerMultiplier } from "../../core/overcap-math";
import { mainhandItem, offhandItem } from "../inventory";
import { overcapById } from "../item-levels";
import { safe } from "../log";
import { getRegistry } from "../registry";
import type { HurtModifier } from "./hurt-dispatch";

const ARROW = "minecraft:arrow";
const BOW = "minecraft:bow";
const PLAYER = "minecraft:player";
/** Upper bound on tracked in-flight arrows (oldest evicted first). */
export const MAX_TRACKED_ARROWS = 512;

/** Power overcap of each player-shot arrow, recorded at spawn time, keyed by entity id. */
const shots = new Map<string, number>();

/** Power overcap of the bow the player holds (mainhand first, then offhand); 0 without a bow. */
export function heldBowOvercap(player: Player): number {
  const main = mainhandItem(player);
  const bow = main?.typeId === BOW ? main : offhandItem(player);
  if (!bow || bow.typeId !== BOW) return 0;
  return overcapById(bow, "minecraft:power", getRegistry());
}

/** Records the shooter's bow Power overcap for a freshly spawned player arrow. */
export function recordShot(entity: Entity): void {
  if (entity.typeId !== ARROW) return;
  const owner = entity.getComponent(EntityComponentTypes.Projectile)?.owner;
  if (!owner || owner.typeId !== PLAYER) return;
  const over = heldBowOvercap(owner as Player);
  shots.delete(entity.id);
  shots.set(entity.id, over);
  while (shots.size > MAX_TRACKED_ARROWS) {
    const oldest = shots.keys().next().value;
    if (oldest === undefined) break;
    shots.delete(oldest);
  }
}

export function forgetShot(entityId: string): void {
  shots.delete(entityId);
}

/** Test helpers. */
export function _trackedShots(): ReadonlyMap<string, number> {
  return shots;
}
export function _resetShots(): void {
  shots.clear();
}

/** Tracks arrows from spawn to removal so Power uses the bow held when the arrow was shot. */
export function registerPowerTracking(): void {
  world.afterEvents.entitySpawn.subscribe(safe("power:spawn", (ev) => recordShot(ev.entity)));
  world.afterEvents.entityRemove.subscribe(
    safe("power:remove", (ev) => forgetShot(ev.removedEntityId)),
    { entityTypes: [ARROW] },
  );
}

/**
 * Power beyond max: multiplies player arrow damage. Uses the overcap recorded when the arrow
 * spawned; falls back to the bow held at impact time when the arrow was not tracked.
 */
export const powerModifier: HurtModifier = {
  name: "power",
  modify(ctx, damage) {
    if (ctx.cause !== "projectile" || !ctx.attacker || ctx.projectile?.typeId !== ARROW) return damage;
    const recorded = shots.get(ctx.projectile.id);
    const over = recorded ?? heldBowOvercap(ctx.attacker);
    return over > 0 ? damage * powerMultiplier(over) : damage;
  },
};
