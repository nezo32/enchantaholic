package dev.enchantaholic.mixin;

import dev.enchantaholic.custom.Barrage;
import dev.enchantaholic.custom.Kaboom;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.ProjectileDeflection;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.phys.HitResult;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Barrage for thrown items, Kaboom tagging on spawn and Kaboom explosion on impact. */
@Mixin(Projectile.class)
public abstract class ProjectileMixin {
	@Inject(method = "spawnProjectileFromRotation", at = @At("RETURN"))
	private static <T extends Projectile> void enchantaholic$barrage(Projectile.ProjectileFactory<T> factory, ServerLevel level,
			ItemStack stack, LivingEntity source, float yOffset, float pow, float uncertainty, CallbackInfoReturnable<T> cir) {
		Barrage.fromThrow(factory, level, stack, source, yOffset, pow, uncertainty, cir.getReturnValue());
	}

	@Inject(method = "applyOnProjectileSpawned", at = @At("HEAD"))
	private void enchantaholic$kaboomTag(ServerLevel level, ItemStack pickupStack, CallbackInfo ci) {
		Kaboom.onSpawned((Projectile) (Object) this, level, pickupStack);
	}

	@Inject(method = "hitTargetOrDeflectSelf", at = @At("RETURN"))
	private void enchantaholic$kaboom(HitResult hit, CallbackInfoReturnable<ProjectileDeflection> cir) {
		if (cir.getReturnValue() == ProjectileDeflection.NONE) Kaboom.onImpact((Projectile) (Object) this);
	}
}
