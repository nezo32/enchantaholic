import { system, world, type Entity, type Player } from "@minecraft/server";
import { magnetRadius, pullVector } from "../../core/custom/math";
import { CUSTOM } from "../../core/custom/roster";
import { FUMBLE_TAG, MAGNET_INTERVAL_TICKS, MAGNET_MAX_PER_PLAYER, MAGNET_PULL } from "../../core/custom/tuning";
import { safe, warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { activePlayer, levelHeld, levelOffhand, levelWorn } from "./gate";

const PULLED_TYPES = ["minecraft:item", "minecraft:xp_orb"] as const;
/** Entities this close are left alone (they are being picked up). */
const NEAR = 1.5;

function pull(e: Entity, to: { x: number; y: number; z: number }): void {
  const from = e.location;
  if (Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) <= NEAR) return;
  try {
    e.clearVelocity();
    e.applyImpulse(pullVector(from, to, MAGNET_PULL));
  } catch {
    e.teleport(to);
  }
}

function tickPlayer(p: Player): void {
  if (!activePlayer(p)) return;
  const level = Math.max(levelHeld(p, CUSTOM.magnet), levelOffhand(p, CUSTOM.magnet), levelWorn(p, CUSTOM.magnet));
  if (level <= 0) return;
  const r = magnetRadius(level);
  const at = p.location;
  const to = { x: at.x, y: at.y, z: at.z };
  let handled = 0;
  for (const type of PULLED_TYPES) {
    const found = p.dimension.getEntities({ location: to, maxDistance: r, type, excludeTags: [FUMBLE_TAG] });
    for (const e of found) {
      if (handled >= MAGNET_MAX_PER_PLAYER) return;
      try {
        if (e.hasTag(FUMBLE_TAG)) continue;
        handled++;
        pull(e, to);
      } catch (err) {
        warnOnce("magnet:pull", err);
      }
    }
  }
}

/** Magnet (held, off-hand or worn): pulls items and XP orbs within 3 + L blocks (max 24). */
export function magnetTick(players: readonly Player[]): void {
  if (!isCustomEnabled()) return;
  for (const p of players) {
    try {
      tickPlayer(p);
    } catch (err) {
      warnOnce("magnet", err);
    }
  }
}

export function startMagnetLoop(): number {
  return system.runInterval(
    safe("magnet-loop", () => {
      if (isCustomEnabled()) magnetTick(world.getAllPlayers());
    }),
    MAGNET_INTERVAL_TICKS,
  );
}
