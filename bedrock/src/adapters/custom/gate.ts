import { GameMode, type Player } from "@minecraft/server";
import type { CustomId } from "../../core/custom/roster";
import { armorItems, collectSlots, mainhandItem, offhandItem } from "../inventory";
import { getCustomLevel } from "../item-levels";
import { isCustomEnabled } from "../state";

/** Custom Enchantments are ON and the player is a valid non-spectator. */
export function activePlayer(p: Player): boolean {
  if (!isCustomEnabled()) return false;
  try {
    return p.isValid && p.getGameMode() !== GameMode.Spectator;
  } catch {
    return false;
  }
}

/** True for a player in creative mode (false on error). */
export function isCreative(p: Player): boolean {
  try {
    return p.getGameMode() === GameMode.Creative;
  } catch {
    return false;
  }
}

/** Level of a custom enchant on the main-hand item. */
export function levelHeld(p: Player, id: CustomId): number {
  try {
    return getCustomLevel(mainhandItem(p), id);
  } catch {
    return 0;
  }
}

/** Level of a custom enchant on the off-hand item. */
export function levelOffhand(p: Player, id: CustomId): number {
  try {
    return getCustomLevel(offhandItem(p), id);
  } catch {
    return 0;
  }
}

/** Highest level of a custom enchant over the four armor slots. */
export function levelWorn(p: Player, id: CustomId): number {
  try {
    let best = 0;
    for (const item of armorItems(p)) best = Math.max(best, getCustomLevel(item, id));
    return best;
  } catch {
    return 0;
  }
}

/** Highest level of a custom enchant anywhere on the player (inventory + equipment). */
export function levelAnywhere(p: Player, id: CustomId): number {
  try {
    let best = 0;
    for (const slot of collectSlots(p)) best = Math.max(best, getCustomLevel(slot.read(), id));
    return best;
  } catch {
    return 0;
  }
}

export const PLAYER_TYPE = "minecraft:player";
