/** Shared helpers for the custom-effect adapter tests. */
import { _resetCustomEffects } from "../../../src/adapters/custom";
import { setCustomEnabled } from "../../../src/adapters/state";
import { CUSTOM, type CustomKey } from "../../../src/core/custom/roster";
import { makeItem, type ItemSpec } from "../../fakes/builders";
import {
  EntityComponentTypes,
  FakeEntity,
  FakeProjectileComponent,
  world,
  type FakeDimension,
  type FakeItemStack,
  type Vec3,
} from "../../fakes/minecraft-server";
import { resetAll } from "../helpers";

export { CUSTOM };

/** resetAll() + custom module state; returns the console.warn spy. */
export function resetCustom() {
  const warn = resetAll();
  _resetCustomEffects();
  return warn;
}

export function customOn(): void {
  setCustomEnabled(true);
}

export function customOff(): void {
  setCustomEnabled(false);
}

export const overworld = (): FakeDimension => world.getDimension("overworld");

/** An item carrying custom enchant levels (`{ yeet: 2 }`). */
export function withCustoms(typeId: string, levels: Partial<Record<CustomKey, number>>, spec: ItemSpec = {}): FakeItemStack {
  const customs: Record<string, number> = {};
  for (const [k, v] of Object.entries(levels)) customs[CUSTOM[k as CustomKey]] = v as number;
  return makeItem(typeId, { ...spec, customs });
}

/**
 * A projectile the way the engine delivers it: owner already set when entitySpawn fires.
 * Emits world.afterEvents.entitySpawn synchronously.
 */
export function launch(
  owner: FakeEntity | undefined,
  typeId = "minecraft:arrow",
  velocity: Vec3 = { x: 0, y: 0.5, z: 2 },
  at: Vec3 = { x: 0, y: 65, z: 0 },
): FakeEntity {
  const e = new FakeEntity(typeId);
  const proj = new FakeProjectileComponent(e);
  if (owner) proj.owner = owner;
  e.components.set(EntityComponentTypes.Projectile, proj);
  e.velocity = { ...velocity };
  overworld().addEntity(e, at);
  world.afterEvents.entitySpawn.emit({ entity: e, cause: "Spawned" });
  return e;
}

export const projectileOf = (e: FakeEntity): FakeProjectileComponent =>
  e.getComponent(EntityComponentTypes.Projectile) as FakeProjectileComponent;

/** Valid entities of a type in the overworld. */
export const live = (typeId: string): FakeEntity[] => overworld().getEntities({ type: typeId });
