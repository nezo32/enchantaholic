package dev.enchantaholic.mixin;

import dev.enchantaholic.mode.PendingWorldMode;
import net.minecraft.world.level.storage.LevelStorageSource;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;

/**
 * Implements {@link PendingWorldMode} on the storage access of one world directory. Volatile: the
 * client thread writes the value (Create World), the integrated server thread reads it (SERVER_STARTING).
 */
@Mixin(LevelStorageSource.LevelStorageAccess.class)
public abstract class LevelStorageAccessMixin implements PendingWorldMode {
	@Unique
	private volatile Boolean enchantaholic$pendingMode;

	@Unique
	private volatile Boolean enchantaholic$pendingCustom;

	@Override
	public void enchantaholic$setPendingCustom(boolean enabled) {
		enchantaholic$pendingCustom = enabled;
	}

	@Override
	public Boolean enchantaholic$takePendingCustom() {
		Boolean value = enchantaholic$pendingCustom;
		enchantaholic$pendingCustom = null;
		return value;
	}

	@Override
	public void enchantaholic$setPendingMode(boolean enabled) {
		enchantaholic$pendingMode = enabled;
	}

	@Override
	public Boolean enchantaholic$takePendingMode() {
		Boolean value = enchantaholic$pendingMode;
		enchantaholic$pendingMode = null;
		return value;
	}
}
