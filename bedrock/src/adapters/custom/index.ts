import { system } from "@minecraft/server";
import { _resetBarrage } from "./barrage";
import { registerCustomBreak } from "./break-dispatch";
import { startHiccupLoop } from "./hiccups";
import { registerCustomHit } from "./hit-dispatch";
import { _resetKaboom } from "./kaboom";
import { startMagnetLoop } from "./magnet";
import { registerMoonFallGuard, startMoonLoop } from "./moon-boots";
import { registerPartyPopper } from "./party-popper";
import { registerProjectiles } from "./projectile-dispatch";
import { _resetShots, registerShotSnapshots } from "./shots";
import { _resetVein } from "./vein-miner";

const loops: number[] = [];

/**
 * Custom enchantment effects. Every handler returns at once while Custom Enchantments are OFF,
 * so the subscriptions stay registered and the effects resume when the setting is turned ON.
 */
export function registerCustomEffects(): void {
  registerCustomBreak();
  registerCustomHit();
  registerShotSnapshots();
  registerProjectiles();
  registerPartyPopper();
  registerMoonFallGuard();
  loops.push(startMagnetLoop(), startMoonLoop(), startHiccupLoop());
}

/** Test helper: forget every module's state and stop the loops. */
export function _resetCustomEffects(): void {
  for (const id of loops.splice(0)) {
    try {
      system.clearRun(id);
    } catch {
      // ignore
    }
  }
  _resetVein();
  _resetShots();
  _resetBarrage();
  _resetKaboom();
}
