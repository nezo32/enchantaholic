import { EntityComponentTypes, system, type Entity, type Player } from "@minecraft/server";
import { barrageCount, kaboomPower, spreadVelocity } from "../../core/custom/math";
import { BARRAGE_SPREAD_DEG, COPY_LIFETIME_TICKS, COPY_TAG } from "../../core/custom/tuning";
import { defaultRng, type Rng } from "../../core/rng";
import { safe, warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { _resetCopies, forgetCopy, isCopy, rememberCopy } from "./copies";
import { activePlayer, PLAYER_TYPE } from "./gate";
import { trackKaboom } from "./kaboom";
import { LAUNCHERS, launcherLevels } from "./shots";

export { isCopy };

/** Set while copies are being spawned: their own spawn events are ignored (no recursion). */
let spawningCopies = false;

function removeLater(copy: Entity): void {
  const id = copy.id;
  system.runTimeout(
    safe("barrage:expire", () => {
      forgetCopy(id);
      if (copy.isValid) copy.remove();
    }),
    COPY_LIFETIME_TICKS,
  );
}

function spawnCopy(source: Entity, player: Player, velocity: { x: number; y: number; z: number }, rng: Rng): Entity {
  const copy = source.dimension.spawnEntity(source.typeId, source.location);
  // Tag and track first: if anything below fails, the copy is still cleaned up.
  rememberCopy(copy.id);
  removeLater(copy);
  copy.addTag(COPY_TAG);
  const proj = copy.getComponent(EntityComponentTypes.Projectile);
  if (proj) {
    proj.owner = player;
    proj.shoot(spreadVelocity(velocity, BARRAGE_SPREAD_DEG, rng), { uncertainty: 0 });
  }
  return copy;
}

/**
 * Projectile spawn: Kaboom marks the projectile (and its copies) to explode; Barrage fires
 * 10×L copies (max 64) with ±10° spread. Copies are tagged, never copied again, removed on impact
 * and after 200 ticks.
 */
export function onProjectileSpawn(entity: Entity, rng: Rng = defaultRng): void {
  if (spawningCopies || !isCustomEnabled()) return;
  const typeId = entity.typeId;
  if (!LAUNCHERS.has(typeId) || isCopy(entity)) return;
  const owner = entity.getComponent(EntityComponentTypes.Projectile)?.owner;
  if (!owner || owner.typeId !== PLAYER_TYPE) return;
  const player = owner as Player;
  if (!activePlayer(player)) return;

  const { barrage, kaboom } = launcherLevels(player, typeId);
  const power = kaboomPower(kaboom);
  if (power > 0) trackKaboom(entity, power, player);
  const n = barrageCount(barrage);
  if (n <= 0) return;

  const velocity = entity.getVelocity();
  spawningCopies = true;
  try {
    for (let i = 0; i < n; i++) {
      try {
        const copy = spawnCopy(entity, player, velocity, rng);
        if (power > 0) trackKaboom(copy, power, player);
      } catch (err) {
        warnOnce("barrage:copy", err);
        break;
      }
    }
  } finally {
    spawningCopies = false;
  }
}

/** Test helper. */
export function _resetBarrage(): void {
  spawningCopies = false;
  _resetCopies();
}
