import { EntityComponentTypes, type Player } from "@minecraft/server";
import { butterPct, rollPct } from "../../core/custom/math";
import { CUSTOM } from "../../core/custom/roster";
import { FUMBLE_TAG } from "../../core/custom/tuning";
import { defaultRng, type Rng } from "../../core/rng";
import { getCustomLevel } from "../item-levels";
import { warnOnce } from "../log";
import { activePlayer, isCreative } from "./gate";

const TOSS = 0.3;

/**
 * Curse of Butterfingers: 2 % per level (max 50 %) to drop the held item. The slot is cleared
 * before the item entity spawns and restored if the spawn fails, so the item is never duplicated.
 * Returns true when the item was dropped. Not in creative.
 */
export function fumble(player: Player, rng: Rng = defaultRng): boolean {
  if (!activePlayer(player) || isCreative(player)) return false;
  const container = player.getComponent(EntityComponentTypes.Inventory)?.container;
  if (!container) return false;
  const slot = player.selectedSlotIndex;
  const item = container.getItem(slot);
  if (!item) return false;
  const level = getCustomLevel(item, CUSTOM.butterfingers);
  if (level <= 0 || !rollPct(butterPct(level), rng)) return false;

  try {
    container.setItem(slot, undefined);
  } catch (err) {
    warnOnce("butterfingers:clear", err);
    return false;
  }
  let dropped;
  try {
    dropped = player.dimension.spawnItem(item, player.getHeadLocation());
  } catch (err) {
    warnOnce("butterfingers:spawn", err);
    try {
      container.setItem(slot, item);
    } catch (restoreErr) {
      warnOnce("butterfingers:restore", restoreErr);
    }
    return false;
  }
  try {
    dropped.addTag(FUMBLE_TAG);
  } catch {
    // Without the tag a Magnet may pull the item back: harmless.
  }
  try {
    const d = player.getViewDirection();
    dropped.applyImpulse({ x: d.x * TOSS, y: d.y * TOSS, z: d.z * TOSS });
  } catch {
    // The item just drops at the player's feet.
  }
  try {
    player.playSound("random.pop");
  } catch {
    // Cosmetic only.
  }
  return true;
}
