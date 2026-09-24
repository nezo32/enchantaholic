package dev.enchantaholic.custom;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;

/**
 * Kaboom: projectiles fired by a player from a Kaboom item (the bow/crossbow/trident, or the thrown item
 * itself) explode once on impact with power 1 + 0.5×L (cap 8), never breaking blocks or setting fire.
 * The level rides on the projectile as an entity tag "enchantaholic.kaboom=L" (saved with the entity).
 */
public final class Kaboom {
	public static final String TAG_PREFIX = "enchantaholic.kaboom=";
	private static int budget = CustomMath.KABOOM_PER_TICK;

	private Kaboom() {}

	static void resetBudget() {
		budget = CustomMath.KABOOM_PER_TICK;
	}

	/** Kaboom explosions so far in the current server tick (at most {@link CustomMath#KABOOM_PER_TICK}). */
	public static int explosionsThisTick() {
		return CustomMath.KABOOM_PER_TICK - budget;
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
		if (lvl <= 0 || !CustomEnchants.enabled(server) || budget <= 0) return;
		budget--;
		server.explode(projectile, projectile.getX(), projectile.getY(), projectile.getZ(),
				CustomMath.kaboomPower(lvl), false, Level.ExplosionInteraction.NONE);
	}
}
