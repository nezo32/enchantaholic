import { ItemStack, type PlayerBreakBlockAfterEvent } from "@minecraft/server";
import { midasDrop } from "../../core/custom/math";
import { CUSTOM } from "../../core/custom/roster";
import { defaultRng, type Rng } from "../../core/rng";
import { getCustomLevel } from "../item-levels";
import { activePlayer, isCreative } from "./gate";

const DROPS = { nugget: "minecraft:gold_nugget", ingot: "minecraft:gold_ingot" } as const;

/** Midas Touch: 3 % per level to drop a gold nugget (an ingot sometimes at level 34+). Not in creative. */
export function midasTouch(ev: PlayerBreakBlockAfterEvent, rng: Rng = defaultRng): void {
  const player = ev.player;
  if (!activePlayer(player) || isCreative(player)) return;
  const level = getCustomLevel(ev.itemStackBeforeBreak, CUSTOM.midas_touch);
  if (level <= 0) return;
  const drop = midasDrop(level, rng);
  if (!drop) return;
  ev.dimension.spawnItem(new ItemStack(DROPS[drop], 1), ev.block.center());
}
