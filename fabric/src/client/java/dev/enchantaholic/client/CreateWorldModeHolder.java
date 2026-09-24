package dev.enchantaholic.client;

/** Duck interface on CreateWorldScreen (CreateWorldScreenMixin): the Game tab button's value for this screen. */
public interface CreateWorldModeHolder {
	boolean enchantaholic$isModeEnabled();

	void enchantaholic$setModeEnabled(boolean enabled);

	boolean enchantaholic$isCustomEnabled();

	void enchantaholic$setCustomEnabled(boolean enabled);
}
