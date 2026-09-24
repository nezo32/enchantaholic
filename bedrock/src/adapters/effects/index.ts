import { startEfficiencyLoop } from "./efficiency";
import { registerHurtDispatch } from "./hurt-dispatch";
import { meleeModifier } from "./melee";
import { powerModifier, registerPowerTracking } from "./power";
import { protectionModifier } from "./protection";

/** Overcap effects (D10). Order: attacker bonuses first, then victim reduction. */
export function registerEffects(): void {
  registerHurtDispatch([meleeModifier, powerModifier, protectionModifier]);
  registerPowerTracking();
  startEfficiencyLoop();
}
