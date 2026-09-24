package dev.enchantaholic.mode;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import dev.enchantaholic.Enchantaholic;
import net.minecraft.resources.Identifier;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.level.saveddata.SavedDataType;

/**
 * Per-world "Enchantaholic Mode" switch, saved as {@code <world>/data/enchantaholic/mode.dat}
 * in the server-wide {@link net.minecraft.world.level.storage.SavedDataStorage} (MinecraftServer#getDataStorage).
 * Absent file = off.
 */
public final class EnchantaholicMode extends SavedData {
	public static final Codec<EnchantaholicMode> CODEC = RecordCodecBuilder.create(i -> i.group(
			Codec.BOOL.optionalFieldOf("enabled", false).forGetter(EnchantaholicMode::enabled)
	).apply(i, EnchantaholicMode::new));

	/** null DataFixTypes: no vanilla fixer applies; Fabric's SavedDataStorageMixin skips datafixing for null. */
	public static final SavedDataType<EnchantaholicMode> TYPE = new SavedDataType<>(
			Identifier.fromNamespaceAndPath(Enchantaholic.MOD_ID, "mode"), EnchantaholicMode::new, CODEC, null);

	private boolean enabled;

	public EnchantaholicMode() {
		this(false);
	}

	private EnchantaholicMode(boolean enabled) {
		this.enabled = enabled;
	}

	public boolean enabled() {
		return enabled;
	}

	public void setEnabled(boolean value) {
		if (enabled != value) {
			enabled = value;
			setDirty();
		}
	}

	public static EnchantaholicMode get(MinecraftServer server) {
		return server.getDataStorage().computeIfAbsent(TYPE);
	}

	public static boolean isEnabled(MinecraftServer server) {
		return get(server).enabled();
	}

	public static void set(MinecraftServer server, boolean value) {
		EnchantaholicMode mode = get(server);
		mode.setEnabled(value);
		mode.setDirty(); // make sure the file exists even when the value did not change
	}
}
