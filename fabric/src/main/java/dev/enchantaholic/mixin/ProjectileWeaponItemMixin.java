package dev.enchantaholic.mixin;

import java.util.List;

import dev.enchantaholic.custom.Barrage;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ProjectileWeaponItem;
import net.minecraft.world.level.Level;
import org.jspecify.annotations.Nullable;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Barrage for bows and crossbows: extra copies after vanilla's shot loop, created and aimed by the weapon's own code. */
@Mixin(ProjectileWeaponItem.class)
public abstract class ProjectileWeaponItemMixin {
	@Shadow
	protected abstract Projectile createProjectile(Level level, LivingEntity shooter, ItemStack weapon, ItemStack projectile, boolean isCrit);

	@Shadow
	protected abstract void shootProjectile(LivingEntity shooter, Projectile projectile, int index, float power, float uncertainty,
			float angle, @Nullable LivingEntity targetOverride);

	@Inject(method = "shoot", at = @At("TAIL"))
	private void enchantaholic$barrage(ServerLevel level, LivingEntity shooter, InteractionHand hand, ItemStack weapon,
			List<ItemStack> projectiles, float power, float uncertainty, boolean isCrit, @Nullable LivingEntity targetOverride,
			CallbackInfo ci) {
		Barrage.fromWeapon(level, shooter, weapon, projectiles, uncertainty,
				ammo -> createProjectile(level, shooter, weapon, ammo, isCrit),
				(p, yaw, unc) -> shootProjectile(shooter, p, 0, power, unc, yaw, targetOverride));
	}
}
