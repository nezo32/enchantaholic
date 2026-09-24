package dev.enchantaholic.mixin;

import dev.enchantaholic.custom.CustomEffects;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.level.ServerPlayerGameMode;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Butterfingers on a block break runs when destroyBlock returns. Fabric's PlayerBlockBreakEvents.AFTER fires
 * earlier, before vanilla reads the main-hand tool for the block's drops (Fortune, Silk Touch, correct tool) and durability.
 */
@Mixin(ServerPlayerGameMode.class)
public abstract class ServerPlayerGameModeMixin {
	@Shadow
	@Final
	protected ServerPlayer player;

	@Inject(method = "destroyBlock", at = @At("RETURN"))
	private void enchantaholic$afterDestroyBlock(BlockPos pos, CallbackInfoReturnable<Boolean> cir) {
		CustomEffects.afterDestroyBlock(player, cir.getReturnValueZ());
	}
}
