import { world, type PlayerBreakBlockAfterEvent } from "@minecraft/server";
import { safe, warnOnce } from "../log";
import { isCustomEnabled } from "../state";
import { fumble } from "./butterfingers";
import { chickenRain } from "./chicken-rain";
import { activePlayer } from "./gate";
import { midasTouch } from "./midas-touch";
import { startVein } from "./vein-miner";

const HANDLERS: ReadonlyArray<readonly [string, (ev: PlayerBreakBlockAfterEvent) => void]> = [
  ["vein-miner", (ev) => startVein(ev)],
  ["chicken-rain", (ev) => chickenRain(ev)],
  ["midas-touch", (ev) => midasTouch(ev)],
  // Last: the vein job's synchronous first batch has already used the tool.
  ["butterfingers", (ev) => void fumble(ev.player)],
];

/** Custom effects of one real player break (vein breaks use /setblock and never come back here). */
export function onCustomBreak(ev: PlayerBreakBlockAfterEvent): void {
  if (!isCustomEnabled() || !activePlayer(ev.player)) return;
  for (const [name, fn] of HANDLERS) {
    try {
      fn(ev);
    } catch (err) {
      warnOnce(`custom:${name}`, err);
    }
  }
}

export function registerCustomBreak(): void {
  world.afterEvents.playerBreakBlock.subscribe(safe("custom:break", onCustomBreak));
}
