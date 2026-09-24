import { system, world, type Dimension, type EntityDieAfterEvent, type Player, type Vector3 } from "@minecraft/server";
import { CUSTOM } from "../../core/custom/roster";
import { PARTY_MAX_FIREWORKS, PARTY_TICKS_BETWEEN } from "../../core/custom/tuning";
import { safe, warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { activePlayer, levelHeld, PLAYER_TYPE } from "./gate";

const ROCKET = "minecraft:fireworks_rocket";
const PARTICLES = ["minecraft:totem_particle", "minecraft:villager_happy"] as const;
const BURST = 8;

function burst(dim: Dimension, loc: Vector3): void {
  for (const id of PARTICLES) {
    try {
      for (let i = 0; i < BURST; i++) {
        dim.spawnParticle(id, {
          x: loc.x + (Math.random() - 0.5),
          y: loc.y + 0.5 + (Math.random() - 0.5),
          z: loc.z + (Math.random() - 0.5),
        });
      }
      break;
    } catch {
      // Unknown particle on this version: try the next one.
    }
  }
  try {
    dim.playSound("firework.blast", loc);
  } catch {
    // Cosmetic only.
  }
}

function rocket(dim: Dimension, loc: Vector3): void {
  if (!isCustomEnabled()) return;
  try {
    dim.spawnEntity(ROCKET, { x: loc.x, y: loc.y + 0.5, z: loc.z });
  } catch (err) {
    warnOnce("party:rocket", err);
  }
}

/** Party Popper: a kill with the enchanted item fires min(L, 16) rockets (one every 2 ticks) and confetti. */
export function onEntityDie(ev: EntityDieAfterEvent): void {
  if (!isCustomEnabled()) return;
  const killer = ev.damageSource.damagingEntity;
  if (!killer || killer.typeId !== PLAYER_TYPE) return;
  const player = killer as Player;
  if (!activePlayer(player)) return;
  const level = levelHeld(player, CUSTOM.party_popper);
  if (level <= 0) return;
  let loc: Vector3;
  let dim: Dimension;
  try {
    const l = ev.deadEntity.location;
    loc = { x: l.x, y: l.y, z: l.z };
    dim = ev.deadEntity.dimension;
  } catch {
    return;
  }
  const n = Math.min(level, PARTY_MAX_FIREWORKS);
  rocket(dim, loc);
  burst(dim, loc);
  for (let i = 1; i < n; i++) {
    system.runTimeout(safe("party:rocket", () => rocket(dim, loc)), i * PARTY_TICKS_BETWEEN);
  }
}

export function registerPartyPopper(): void {
  world.afterEvents.entityDie.subscribe(safe("custom:die", onEntityDie));
}
