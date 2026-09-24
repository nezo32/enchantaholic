package dev.enchantaholic.custom;

import java.util.List;
import java.util.function.Function;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.core.component.DataComponents;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.util.RandomSource;
import net.minecraft.util.Unit;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.entity.projectile.arrow.ThrownTrident;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrownEnderpearl;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrownExperienceBottle;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.EnchantmentHelper;
import net.minecraft.world.item.enchantment.Enchantments;

/**
 * Barrage: each shot/throw by a player also fires 10×L (cap 512) copies with random spread. Copies can
 * never be picked up (arrows/tridents: CREATIVE_ONLY; trident copies lose Loyalty so they don't return).
 * Ender pearls and bottles o' enchanting are never copied.
 */
public final class Barrage {
	/** Extra random yaw (degrees, ±) and extra inaccuracy for the copies. */
	public static final float SPREAD_DEGREES = 12.0F;
	public static final float EXTRA_UNCERTAINTY = 6.0F;

	private Barrage() {}

	/** Callback for one copy of a bow/crossbow shot: creates the projectile from an ammo stack. */
	public interface Shooter {
		void shoot(Projectile projectile, float yawOffset, float uncertainty);
	}

	/** ProjectileWeaponItem#shoot (TAIL): bows and crossbows. */
	public static void fromWeapon(ServerLevel level, LivingEntity shooter, ItemStack weapon, List<ItemStack> projectiles,
			float uncertainty, Function<ItemStack, Projectile> create, Shooter shoot) {
		int n = copies(shooter, level, weapon);
		if (n == 0 || weapon.isEmpty()) return;
		ItemStack ammo = projectiles.stream().filter(s -> !s.isEmpty()).findFirst().orElse(ItemStack.EMPTY);
		if (ammo.isEmpty()) return;
		RandomSource r = level.getRandom();
		CustomEffects.guarded(() -> {
			for (int i = 0; i < n; i++) {
				ItemStack copy = ammo.copyWithCount(1);
				copy.set(DataComponents.INTANGIBLE_PROJECTILE, Unit.INSTANCE); // arrows: pickup CREATIVE_ONLY
				Projectile p = create.apply(copy);
				shoot.shoot(p, (r.nextFloat() * 2 - 1) * SPREAD_DEGREES, uncertainty + EXTRA_UNCERTAINTY);
				spawn(level, p, copy);
			}
		});
	}

	/** Projectile#spawnProjectileFromRotation (RETURN): snowball, egg, trident, wind charge, potions. */
	public static <T extends Projectile> void fromThrow(Projectile.ProjectileFactory<T> factory, ServerLevel level, ItemStack stack,
			LivingEntity source, float yOffset, float pow, float uncertainty, T original) {
		if (original instanceof ThrownEnderpearl || original instanceof ThrownExperienceBottle || stack.isEmpty()) return;
		int n = copies(source, level, stack);
		if (n == 0) return;
		ItemStack template = stack.copyWithCount(1);
		if (original instanceof ThrownTrident) {
			EnchantmentHelper.updateEnchantments(template, m -> m.removeIf(e -> e.is(Enchantments.LOYALTY)));
		}
		RandomSource r = level.getRandom();
		CustomEffects.guarded(() -> {
			for (int i = 0; i < n; i++) {
				ItemStack copy = template.copy();
				T p = factory.create(level, source, copy);
				p.shootFromRotation(source, source.getXRot() + (r.nextFloat() * 2 - 1) * SPREAD_DEGREES / 2,
						source.getYRot() + (r.nextFloat() * 2 - 1) * SPREAD_DEGREES, yOffset, pow, uncertainty + EXTRA_UNCERTAINTY);
				spawn(level, p, copy);
			}
		});
	}

	private static int copies(LivingEntity shooter, ServerLevel level, ItemStack source) {
		if (!(shooter instanceof ServerPlayer player) || !CustomEffects.active(player)) return 0;
		return CustomMath.barrageCopies(CustomEnchants.level(source, CustomEnchants.BARRAGE));
	}

	private static void spawn(ServerLevel level, Projectile p, ItemStack pickupStack) {
		if (p instanceof AbstractArrow arrow) arrow.pickup = AbstractArrow.Pickup.CREATIVE_ONLY;
		level.addFreshEntity(p);
		p.applyOnProjectileSpawned(level, pickupStack); // vanilla projectile enchantments + Kaboom tag
	}
}
