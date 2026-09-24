import { system, world, type ItemStack, type Player } from "@minecraft/server";
import { CUSTOM } from "../../core/custom/roster";
import { mainhandItem, offhandItem } from "../inventory";
import { getCustomLevel } from "../item-levels";
import { safe } from "../log";
import { isCustomEnabled } from "../state";

/** Projectile entity → the items that launch it. Other projectiles are ignored. */
export const LAUNCHERS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["minecraft:arrow", new Set(["minecraft:bow", "minecraft:crossbow"])],
  ["minecraft:thrown_trident", new Set(["minecraft:trident"])],
  ["minecraft:snowball", new Set(["minecraft:snowball"])],
  ["minecraft:egg", new Set(["minecraft:egg", "minecraft:blue_egg", "minecraft:brown_egg"])],
  ["minecraft:wind_charge_projectile", new Set(["minecraft:wind_charge"])],
]);

const LAUNCHER_ITEMS: ReadonlySet<string> = new Set([...LAUNCHERS.values()].flatMap((s) => [...s]));

/** A shot snapshot is valid this many ticks after the last use event (unless still charging). */
export const SNAPSHOT_TICKS = 2;
const MAX_SNAPSHOTS = 256;

export interface LauncherLevels {
  barrage: number;
  kaboom: number;
}

interface Snapshot extends LauncherLevels {
  launcherTypeId: string;
  tick: number;
  charging: boolean;
}

const snapshots = new Map<string, Snapshot>();

function levelsOf(item: ItemStack): LauncherLevels {
  return { barrage: getCustomLevel(item, CUSTOM.barrage), kaboom: getCustomLevel(item, CUSTOM.kaboom) };
}

/**
 * Barrage/Kaboom levels of the launcher of a projectile: the main hand if it is a launcher of that
 * projectile, else the off hand, else the player's recent use snapshot (tridents leave the hand).
 */
export function launcherLevels(player: Player, projectileTypeId: string): LauncherLevels {
  const set = LAUNCHERS.get(projectileTypeId);
  if (!set) return { barrage: 0, kaboom: 0 };
  for (const item of [mainhandItem(player), offhandItem(player)]) {
    if (item && set.has(item.typeId)) return levelsOf(item);
  }
  const snap = snapshots.get(player.id);
  if (snap && set.has(snap.launcherTypeId) && (snap.charging || system.currentTick - snap.tick <= SNAPSHOT_TICKS)) {
    return { barrage: snap.barrage, kaboom: snap.kaboom };
  }
  return { barrage: 0, kaboom: 0 };
}

/** Records the launcher the player is using (item-use events). */
export function recordUse(player: Player, item: ItemStack | undefined, charging: boolean): void {
  if (!isCustomEnabled()) return;
  const tick = system.currentTick;
  if (!item || !LAUNCHER_ITEMS.has(item.typeId)) {
    // Release/stop without an item: keep the last launcher but end the charge.
    const prev = snapshots.get(player.id);
    if (prev) snapshots.set(player.id, { ...prev, tick, charging: false });
    return;
  }
  snapshots.delete(player.id);
  snapshots.set(player.id, { launcherTypeId: item.typeId, ...levelsOf(item), tick, charging });
  while (snapshots.size > MAX_SNAPSHOTS) {
    const oldest = snapshots.keys().next().value;
    if (oldest === undefined) break;
    snapshots.delete(oldest);
  }
}

export function registerShotSnapshots(): void {
  world.afterEvents.itemStartUse.subscribe(safe("shots:start", (ev) => recordUse(ev.source, ev.itemStack, true)));
  world.afterEvents.itemUse.subscribe(safe("shots:use", (ev) => recordUse(ev.source, ev.itemStack, false)));
  world.afterEvents.itemReleaseUse.subscribe(
    safe("shots:release", (ev) => recordUse(ev.source, ev.itemStack, false)),
  );
  world.afterEvents.itemStopUse.subscribe(safe("shots:stop", (ev) => recordUse(ev.source, ev.itemStack, false)));
}

/** Test helpers. */
export function _snapshots(): ReadonlyMap<string, Readonly<Snapshot>> {
  return snapshots;
}
export function _resetShots(): void {
  snapshots.clear();
}
