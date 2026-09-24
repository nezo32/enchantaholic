import { GameMode, system, world, type Player } from "@minecraft/server";
import { EFFECT_INTERVAL_TICKS, HASTE_DURATION_TICKS } from "../../core/config";
import { hasteAmplifier } from "../../core/overcap-math";
import { mainhandItem } from "../inventory";
import { overcapById } from "../item-levels";
import { safe, warnOnce } from "../log";
import { getRegistry } from "../registry";

const HASTE = "minecraft:haste";

function tickPlayer(player: Player): void {
  if (player.getGameMode() === GameMode.Spectator) return;
  const item = mainhandItem(player);
  if (!item) return;
  const amp = hasteAmplifier(overcapById(item, "minecraft:efficiency", getRegistry()));
  if (amp === undefined) return;
  const existing = player.getEffect(HASTE);
  // Never downgrade a stronger Haste (beacon), and don't shorten an equal one that outlasts ours.
  if (existing && (existing.amplifier > amp || (existing.amplifier === amp && existing.duration >= HASTE_DURATION_TICKS))) {
    return;
  }
  player.addEffect(HASTE, HASTE_DURATION_TICKS, { amplifier: amp, showParticles: false });
}

/** Efficiency beyond max: Haste while the item is in the main hand. */
export function efficiencyTick(players: readonly Player[]): void {
  for (const player of players) {
    try {
      tickPlayer(player);
    } catch (err) {
      warnOnce("efficiency", err);
    }
  }
}

export function startEfficiencyLoop(): number {
  return system.runInterval(
    safe("efficiency-loop", () => efficiencyTick(world.getAllPlayers())),
    EFFECT_INTERVAL_TICKS,
  );
}
