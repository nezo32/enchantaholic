package dev.enchantaholic.mixin;

import dev.enchantaholic.custom.Yeet;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Yeet: re-applies the launch after vanilla's extra knockback at the end of a melee attack. */
@Mixin(Player.class)
public abstract class PlayerMixin {
	@Inject(method = "attack", at = @At("RETURN"))
	private void enchantaholic$yeet(Entity target, CallbackInfo ci) {
		if ((Object) this instanceof ServerPlayer player) Yeet.afterAttack(player);
	}
}
