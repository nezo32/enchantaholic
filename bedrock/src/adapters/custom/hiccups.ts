import { system, world, type Player } from "@minecraft/server";
import { hiccupPct, rollPct } from "../../core/custom/math";
import { CUSTOM } from "../../core/custom/roster";
import { HICCUP_HOP, HICCUP_INTERVAL_TICKS } from "../../core/custom/tuning";
import { defaultRng, type Rng } from "../../core/rng";
import { safe, warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { activePlayer, levelAnywhere } from "./gate";

function hiccup(p: Player): void {
  try {
    // Never applyImpulse on a player (unsupported); knockback with no horizontal force is a hop.
    p.applyKnockback({ x: 0, z: 0 }, HICCUP_HOP);
  } catch {
    p.addEffect("minecraft:levitation", 4, { amplifier: 4, showParticles: false });
  }
  try {
    p.playSound("random.burp", { pitch: 1.6 });
  } catch {
    // Cosmetic only.
  }
  try {
    p.dimension.spawnParticle("minecraft:villager_angry", p.getHeadLocation());
  } catch {
    // Cosmetic only.
  }
}

/** Curse of Hiccups (anywhere in the inventory): 3 % per level (max 60 %) per roll to hop. */
export function hiccupTick(players: readonly Player[], rng: Rng = defaultRng): void {
  if (!isCustomEnabled()) return;
  for (const p of players) {
    try {
      if (!activePlayer(p)) continue;
      const level = levelAnywhere(p, CUSTOM.hiccups);
      if (level <= 0 || !rollPct(hiccupPct(level), rng)) continue;
      hiccup(p);
    } catch (err) {
      warnOnce("hiccups", err);
    }
  }
}

export function startHiccupLoop(): number {
  return system.runInterval(
    safe("hiccup-loop", () => {
      if (isCustomEnabled()) hiccupTick(world.getAllPlayers());
    }),
    HICCUP_INTERVAL_TICKS,
  );
}
