package dev.enchantaholic.custom;

import java.util.Optional;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.ExperienceOrb;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.entity.decoration.BlockAttachedEntity;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Explosion;
import net.minecraft.world.level.ExplosionDamageCalculator;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.material.FluidState;

/**
 * Kaboom: projectiles fired by a player from a Kaboom item (the bow/crossbow/trident, or the thrown item
 * itself) explode once on impact with power 1 + 0.5×L (cap 8), never breaking blocks or setting fire.
 * The level rides on the projectile as an entity tag "enchantaholic.kaboom=L" (saved with the entity).
 *
 * <p>Performance: at most {@link CustomMath#KABOOM_PER_TICK} explosions and {@link CustomMath#KABOOM_NANOS_PER_TICK}
 * of explosion work per server tick; later impacts that tick fizzle. The blasts leave projectiles, item drops,
 * XP orbs and decorations (item frames, paintings, armor stands: no griefing) alone: no damage, no knockback and so
 * no exposure ray-casts for them. A Barrage volley lands as a dense
 * cluster of projectiles, which would otherwise cost every explosion hundreds of ray-casts (and scatter the volley).
 */
public final class Kaboom {
	public static final String TAG_PREFIX = "enchantaholic.kaboom=";

	private static final Optional<Float> STOP_RAY = Optional.of(Float.MAX_VALUE);

	/**
	 * Vanilla damage/knockback, except for projectiles, item drops, XP orbs and decorations. Blocks are never affected
	 * (ExplosionInteraction.NONE), so the vanilla block ray-cast (1,352 rays, run even then) stops at its first step.
	 */
	private static final ExplosionDamageCalculator DAMAGE = new ExplosionDamageCalculator() {
		@Override
		public Optional<Float> getBlockExplosionResistance(Explosion explosion, BlockGetter level, BlockPos pos, BlockState block, FluidState fluid) {
			return STOP_RAY;
		}

		@Override
		public boolean shouldBlockExplode(Explosion explosion, BlockGetter level, BlockPos pos, BlockState state, float power) {
			return false;
		}

		@Override
		public boolean shouldDamageEntity(Explosion explosion, Entity entity) {
			return !spared(entity) && super.shouldDamageEntity(explosion, entity);
		}

		@Override
		public float getKnockbackMultiplier(Entity entity) {
			return spared(entity) ? 0.0F : super.getKnockbackMultiplier(entity);
		}
	};

	private static int budget = CustomMath.KABOOM_PER_TICK;
	private static long nanos;
	private static long nanosBudget = CustomMath.KABOOM_NANOS_PER_TICK;

	private Kaboom() {}

	private static boolean spared(Entity entity) {
		return entity instanceof Projectile || entity instanceof ItemEntity || entity instanceof ExperienceOrb
				|| entity instanceof BlockAttachedEntity || entity instanceof ArmorStand; // no griefing of item frames, paintings, armor stands
	}

	static void resetBudget() {
		budget = CustomMath.KABOOM_PER_TICK;
		nanos = 0;
	}

	/** Kaboom explosions so far in the current server tick (at most {@link CustomMath#KABOOM_PER_TICK}). */
	public static int explosionsThisTick() {
		return CustomMath.KABOOM_PER_TICK - budget;
	}

	/** Nanoseconds spent in Kaboom explosions so far in the current server tick. */
	public static long nanosThisTick() {
		return nanos;
	}

	/** Tests only: overrides the per-tick time budget ({@code CustomMath.KABOOM_NANOS_PER_TICK} to restore). Server thread. */
	public static void setNanosBudget(long value) {
		nanosBudget = value;
	}

	/** Projectile#applyOnProjectileSpawned (HEAD): every player projectile spawned through vanilla's helpers or by Barrage. */
	public static void onSpawned(Projectile projectile, ServerLevel level, ItemStack pickupStack) {
		if (!(projectile.getOwner() instanceof Player) || !CustomEnchants.enabled(level)) return;
		ItemStack source = projectile instanceof AbstractArrow arrow && arrow.getWeaponItem() != null && !arrow.getWeaponItem().isEmpty()
				? arrow.getWeaponItem() : pickupStack;
		int lvl = CustomEnchants.level(source, CustomEnchants.KABOOM);
		if (lvl > 0) projectile.addTag(TAG_PREFIX + lvl);
	}

	/** Projectile#hitTargetOrDeflectSelf (RETURN, not deflected): the projectile hit something. */
	public static void onImpact(Projectile projectile) {
		Level level = projectile.level();
		if (!(level instanceof ServerLevel server)) return;
		int lvl = 0;
		String found = null;
		for (String tag : projectile.entityTags()) {
			if (tag.startsWith(TAG_PREFIX)) {
				found = tag;
				try {
					lvl = Integer.parseInt(tag.substring(TAG_PREFIX.length()));
				} catch (NumberFormatException ignored) {
					lvl = 0;
				}
				break;
			}
		}
		if (found == null) return;
		projectile.removeTag(found); // once per projectile (piercing arrows, bouncing)
		if (lvl <= 0 || !CustomEnchants.enabled(server) || budget <= 0 || nanos >= nanosBudget) return;
		budget--;
		long start = System.nanoTime();
		try {
			server.explode(projectile, Explosion.getDefaultDamageSource(server, projectile), DAMAGE,
					projectile.getX(), projectile.getY(), projectile.getZ(), CustomMath.kaboomPower(lvl), false, Level.ExplosionInteraction.NONE);
		} finally {
			nanos += System.nanoTime() - start;
		}
	}
}
