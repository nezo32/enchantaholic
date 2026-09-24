import { EntityInitializationCause, world } from "@minecraft/server";
import { safe } from "../log";
import { onProjectileSpawn, removeStaleCopy } from "./barrage";
import { forgetCopy } from "./copies";
import { forgetKaboom, onProjectileHit } from "./kaboom";
import { LAUNCHERS } from "./shots";

/**
 * Barrage + Kaboom: spawn → track/copy, impact → explode/clean up, removal → forget.
 * Entities loaded from disk are never copied; stale copies among them are removed.
 */
export function registerProjectiles(): void {
  world.afterEvents.entitySpawn.subscribe(
    safe("custom:spawn", (ev) => {
      if (ev.cause === EntityInitializationCause.Loaded) removeStaleCopy(ev.entity);
      else onProjectileSpawn(ev.entity);
    }),
  );
  world.afterEvents.entityLoad.subscribe(safe("custom:load", (ev) => removeStaleCopy(ev.entity)));
  world.afterEvents.projectileHitBlock.subscribe(safe("custom:hit-block", onProjectileHit));
  world.afterEvents.projectileHitEntity.subscribe(safe("custom:hit-entity", onProjectileHit));
  world.afterEvents.entityRemove.subscribe(
    safe("custom:remove", (ev) => {
      forgetKaboom(ev.removedEntityId);
      forgetCopy(ev.removedEntityId);
    }),
    { entityTypes: [...LAUNCHERS.keys()] },
  );
}
