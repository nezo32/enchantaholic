import { world, type EntityHitEntityAfterEvent, type Player } from "@minecraft/server";
import { safe, warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { fumble } from "./butterfingers";
import { activePlayer, PLAYER_TYPE } from "./gate";
import { yeet } from "./yeet";

/** Custom effects of a player's melee hit. Order: yeet → butterfingers. */
export function onCustomHit(ev: EntityHitEntityAfterEvent): void {
  if (!isCustomEnabled()) return;
  const attacker = ev.damagingEntity;
  if (attacker.typeId !== PLAYER_TYPE) return;
  const player = attacker as Player;
  if (!activePlayer(player)) return;
  try {
    yeet(player, ev.hitEntity);
  } catch (err) {
    warnOnce("custom:yeet", err);
  }
  try {
    fumble(player);
  } catch (err) {
    warnOnce("custom:butterfingers", err);
  }
}

export function registerCustomHit(): void {
  world.afterEvents.entityHitEntity.subscribe(safe("custom:hit", onCustomHit));
}
