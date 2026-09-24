import { world, type Entity, type EntityHurtBeforeEvent, type Player } from "@minecraft/server";
import { safe, warnOnce } from "../log";

export interface HurtContext {
  /** EntityDamageCause value. */
  readonly cause: string;
  readonly victim: Entity;
  /** damagingEntity when it is a player. */
  readonly attacker?: Player;
  /** damagingProjectile. */
  readonly projectile?: Entity;
}

export interface HurtModifier {
  readonly name: string;
  modify(ctx: HurtContext, damage: number): number;
}

const PLAYER = "minecraft:player";

/** Runs the modifiers in order over one hurt event; returns the new damage or undefined if unchanged. */
export function computeDamage(ev: EntityHurtBeforeEvent, mods: readonly HurtModifier[]): number | undefined {
  const source = ev.damageSource;
  const victim = ev.hurtEntity;
  const damaging = source.damagingEntity;
  const attacker = damaging?.typeId === PLAYER ? (damaging as Player) : undefined;
  if (!attacker && victim.typeId !== PLAYER) return undefined;

  const ctx: HurtContext = { cause: source.cause, victim, attacker, projectile: source.damagingProjectile };
  const original = ev.damage;
  let damage = original;
  for (const mod of mods) {
    try {
      const next = mod.modify(ctx, damage);
      if (Number.isFinite(next) && next >= 0) damage = next;
    } catch (err) {
      warnOnce(`effect:${mod.name}`, err);
    }
  }
  return damage !== original && Number.isFinite(damage) && damage >= 0 ? damage : undefined;
}

/** One beforeEvents.entityHurt subscription for every damage modifier (D11). */
export function registerHurtDispatch(mods: readonly HurtModifier[]): void {
  world.beforeEvents.entityHurt.subscribe(
    safe("hurt", (ev: EntityHurtBeforeEvent) => {
      const damage = computeDamage(ev, mods);
      if (damage !== undefined) ev.damage = damage;
    }),
  );
}
