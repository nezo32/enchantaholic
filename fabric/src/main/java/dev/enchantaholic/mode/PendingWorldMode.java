package dev.enchantaholic.mode;

/**
 * Duck interface on {@code LevelStorageSource.LevelStorageAccess} (see LevelStorageAccessMixin).
 * The Create World screen stores the button value on the access object of the world it just created;
 * the integrated server that is handed that same object consumes it on SERVER_STARTING.
 */
public interface PendingWorldMode {
	void enchantaholic$setPendingMode(boolean enabled);

	/** Returns and clears the pending value; null if none (existing world, dedicated server). */
	Boolean enchantaholic$takePendingMode();

	/** Custom Enchantments button value (v0.3.0). */
	void enchantaholic$setPendingCustom(boolean enabled);

	/** Returns and clears the pending Custom Enchantments value; null if none. */
	Boolean enchantaholic$takePendingCustom();
}
