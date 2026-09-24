import type { PlayerBreakBlockAfterEvent } from "@minecraft/server";
import { chickenPct, rollPct } from "../../core/custom/math";
import { CUSTOM } from "../../core/custom/roster";
import { CHICKEN_CAP_RADIUS, CHICKEN_LOCAL_CAP } from "../../core/custom/tuning";
import { defaultRng, type Rng } from "../../core/rng";
import { getCustomLevel } from "../item-levels";
import { activePlayer } from "./gate";

const CHICKEN = "minecraft:chicken";
const BABY_EVENT = "minecraft:entity_born";

/** Chicken Rain: 5 % per level to spawn one chicken (baby half the time) at the broken block. */
export function chickenRain(ev: PlayerBreakBlockAfterEvent, rng: Rng = defaultRng): void {
  if (!activePlayer(ev.player)) return;
  const level = getCustomLevel(ev.itemStackBeforeBreak, CUSTOM.chicken_rain);
  if (level <= 0 || !rollPct(chickenPct(level), rng)) return;
  const dim = ev.dimension;
  const at = ev.block.center();
  const nearby = dim.getEntities({ type: CHICKEN, location: at, maxDistance: CHICKEN_CAP_RADIUS });
  if (nearby.length >= CHICKEN_LOCAL_CAP) return;
  dim.spawnEntity(CHICKEN, at, rng() < 0.5 ? { spawnEvent: BABY_EVENT } : undefined);
}
