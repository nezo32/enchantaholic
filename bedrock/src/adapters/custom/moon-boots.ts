import { EntityDamageCause, system, world, type EntityHurtBeforeEvent, type Player } from "@minecraft/server";
import { moonAmplifier } from "../../core/custom/math";
import { CUSTOM } from "../../core/custom/roster";
import { MOON_DURATION_TICKS, MOON_INTERVAL_TICKS } from "../../core/custom/tuning";
import { safe, warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { activePlayer, levelWorn, PLAYER_TYPE } from "./gate";

const JUMP = "minecraft:jump_boost";

function tickPlayer(p: Player): void {
  if (!activePlayer(p)) return;
  const level = levelWorn(p, CUSTOM.moon_boots);
  if (level <= 0) return;
  const amp = moonAmplifier(level);
  const existing = p.getEffect(JUMP);
  // Same rule as Haste: never downgrade a stronger effect, never shorten an equal one.
  if (existing && (existing.amplifier > amp || (existing.amplifier === amp && existing.duration >= MOON_DURATION_TICKS))) {
    return;
  }
  p.addEffect(JUMP, MOON_DURATION_TICKS, { amplifier: amp, showParticles: false });
}

/** Moon Boots (worn): Jump Boost min(L − 1, 10). */
export function moonTick(players: readonly Player[]): void {
  if (!isCustomEnabled()) return;
  for (const p of players) {
    try {
      tickPlayer(p);
    } catch (err) {
      warnOnce("moon-boots", err);
    }
  }
}

export function startMoonLoop(): number {
  return system.runInterval(
    safe("moon-loop", () => {
      if (isCustomEnabled()) moonTick(world.getAllPlayers());
    }),
    MOON_INTERVAL_TICKS,
  );
}

/** Fall damage to a player wearing Moon Boots is cancelled. Read-only (runs in a before-event). */
export function shouldCancelFall(ev: EntityHurtBeforeEvent): boolean {
  if (!isCustomEnabled()) return false;
  if (ev.damageSource.cause !== EntityDamageCause.fall) return false;
  const victim = ev.hurtEntity;
  if (victim.typeId !== PLAYER_TYPE) return false;
  return levelWorn(victim as Player, CUSTOM.moon_boots) > 0;
}

export function registerMoonFallGuard(): void {
  world.beforeEvents.entityHurt.subscribe(
    safe("moon-boots:fall", (ev: EntityHurtBeforeEvent) => {
      if (shouldCancelFall(ev)) ev.cancel = true;
    }),
    { allowedDamageCauses: [EntityDamageCause.fall], entityFilter: { type: PLAYER_TYPE } },
  );
}
