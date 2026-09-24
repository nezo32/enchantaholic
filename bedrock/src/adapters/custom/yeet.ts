import { system, type Entity, type Player } from "@minecraft/server";
import { horizontalDir, yeetForce } from "../../core/custom/math";
import { CUSTOM } from "../../core/custom/roster";
import { safe } from "../log";
import { isCustomEnabled } from "../state";
import { activePlayer, levelHeld, PLAYER_TYPE } from "./gate";

/** Pushes `target` away from `from` and up. Never calls applyImpulse on a player. */
export function launch(target: Entity, from: { x: number; y: number; z: number }, level: number): void {
  const d = horizontalDir(from, target.location);
  const { h, v } = yeetForce(level);
  const horizontal = { x: d.x * h, z: d.z * h };
  if (target.typeId === PLAYER_TYPE) {
    target.applyKnockback(horizontal, v);
    return;
  }
  try {
    target.applyKnockback(horizontal, v);
  } catch {
    target.applyImpulse({ x: horizontal.x, y: v, z: horizontal.z });
  }
}

/** Yeet: one tick after the hit (after vanilla knockback), launches the target up and away. */
export function yeet(attacker: Player, target: Entity): void {
  if (!activePlayer(attacker)) return;
  const level = levelHeld(attacker, CUSTOM.yeet);
  if (level <= 0) return;
  let from = attacker.location;
  system.runTimeout(
    safe("yeet", () => {
      if (!isCustomEnabled() || !target.isValid) return;
      try {
        if (attacker.isValid) from = attacker.location;
      } catch {
        // Keep the location from the hit.
      }
      launch(target, from, level);
    }),
    1,
  );
}
