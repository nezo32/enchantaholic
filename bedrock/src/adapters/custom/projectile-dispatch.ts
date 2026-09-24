import { world } from "@minecraft/server";
import { safe } from "../log";
import { onProjectileSpawn } from "./barrage";
import { forgetCopy } from "./copies";
import { forgetKaboom, onProjectileHit } from "./kaboom";
import { LAUNCHERS } from "./shots";

/** Barrage + Kaboom: spawn → track/copy, impact → explode/clean up, removal → forget. */
export function registerProjectiles(): void {
  world.afterEvents.entitySpawn.subscribe(safe("custom:spawn", (ev) => onProjectileSpawn(ev.entity)));
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
