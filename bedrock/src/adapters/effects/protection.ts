import type { Player } from "@minecraft/server";
import {
  overEpfForCause,
  PROTECTION_EXCLUDED_CAUSES,
  PROTECTION_RULES,
  protectionFactor,
} from "../../core/overcap-math";
import { armorItems } from "../inventory";
import { overcapById } from "../item-levels";
import { getRegistry } from "../registry";
import type { HurtModifier } from "./hurt-dispatch";

/** Protection family + Feather Falling beyond max: extra damage reduction for players. */
export const protectionModifier: HurtModifier = {
  name: "protection",
  modify(ctx, damage) {
    if (ctx.victim.typeId !== "minecraft:player" || PROTECTION_EXCLUDED_CAUSES.has(ctx.cause)) return damage;
    const armor = armorItems(ctx.victim as Player);
    if (armor.length === 0) return damage;
    const reg = getRegistry();
    const overById = new Map<string, number>();
    for (const rule of PROTECTION_RULES) {
      if (rule.causes !== "all" && !rule.causes.has(ctx.cause)) continue;
      let sum = 0;
      for (const item of armor) sum += overcapById(item, rule.id, reg);
      if (sum > 0) overById.set(rule.id, sum);
    }
    const overEpf = overEpfForCause(ctx.cause, overById);
    return overEpf > 0 ? damage * protectionFactor(overEpf) : damage;
  },
};
