import { EntityComponentTypes, type Entity } from "@minecraft/server";
import { meleeBonus } from "../../core/overcap-math";
import { mainhandItem } from "../inventory";
import { overcapById } from "../item-levels";
import { getRegistry } from "../registry";
import type { HurtModifier } from "./hurt-dispatch";

function hasFamily(entity: Entity, family: string): boolean {
  try {
    return entity.getComponent(EntityComponentTypes.TypeFamily)?.hasTypeFamily(family) ?? false;
  } catch {
    return false;
  }
}

/** Sharpness / Smite / Bane of Arthropods beyond max: flat bonus on direct player melee hits. */
export const meleeModifier: HurtModifier = {
  name: "melee",
  modify(ctx, damage) {
    if (ctx.cause !== "entityAttack" || !ctx.attacker || ctx.projectile) return damage;
    const weapon = mainhandItem(ctx.attacker);
    if (!weapon) return damage;
    const reg = getRegistry();
    const over = {
      sharpness: overcapById(weapon, "minecraft:sharpness", reg),
      smite: overcapById(weapon, "minecraft:smite", reg),
      bane: overcapById(weapon, "minecraft:bane_of_arthropods", reg),
    };
    if (over.sharpness <= 0 && over.smite <= 0 && over.bane <= 0) return damage;
    const target = {
      undead: over.smite > 0 && hasFamily(ctx.victim, "undead"),
      arthropod: over.bane > 0 && hasFamily(ctx.victim, "arthropod"),
    };
    return damage + meleeBonus(over, target);
  },
};
