import type * as mc from "@minecraft/server";
import { computeDamage, type HurtModifier } from "../../../src/adapters/effects/hurt-dispatch";
import { makeHurtEvent, type HurtSpec } from "../../fakes/builders";
import { asReal } from "../../fakes/minecraft-server";

/** Damage after running `mods` over a synthetic hurt event (original when unchanged). */
export function hurt(mods: readonly HurtModifier[], spec: HurtSpec): number {
  const e = makeHurtEvent(spec);
  return computeDamage(asReal<mc.EntityHurtBeforeEvent>(e), mods) ?? spec.damage;
}
