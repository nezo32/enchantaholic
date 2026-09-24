package dev.enchantaholic.mode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import dev.enchantaholic.Enchantaholic;
import dev.enchantaholic.mixin.MinecraftServerAccessor;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.NbtAccounter;
import net.minecraft.nbt.NbtIo;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.storage.LevelResource;

/** ServerLifecycleEvents.SERVER_STARTING: initialize the mode before levels load or anyone joins. */
public final class ModeBootstrap {
	/** Key of the v0.1.0 game rule inside data/minecraft/game_rules.dat -> "data" compound. */
	public static final String LEGACY_RULE_KEY = "enchantaholic:enchantaholic";

	private ModeBootstrap() {}

	public static void onServerStarting(MinecraftServer server) {
		// 1. new world from the Create World screen: the button value rides on this world's storage access
		Boolean pending = ((PendingWorldMode) ((MinecraftServerAccessor) server).enchantaholic$getStorageSource())
				.enchantaholic$takePendingMode();
		if (pending != null) {
			EnchantaholicMode.set(server, pending);
			server.getDataStorage().scheduleSave(); // persist now: a crash before the first autosave must not lose the choice
			Enchantaholic.LOGGER.info("Enchantaholic Mode {} for new world", pending ? "ON" : "OFF");
			return;
		}
		// 2. existing world that already has mode.dat: it is authoritative
		if (server.getDataStorage().get(EnchantaholicMode.TYPE) != null) {
			Enchantaholic.LOGGER.debug("Enchantaholic Mode loaded: {}", EnchantaholicMode.isEnabled(server));
			return; // already stored
		}
		// 3. no mode.dat yet (0.1.0 world, dedicated server, other launcher): migrate the old game rule, else OFF.
		//    Always written, so this runs once per world.
		Path dataDir = server.getWorldPath(LevelResource.ROOT).resolve("data");
		if (Files.exists(dataDir.resolve("enchantaholic/mode.dat"))) {
			// vanilla already logged the read error and cached "absent"; the file is replaced on the next save
			Enchantaholic.LOGGER.warn("Unreadable Enchantaholic mode.dat; resetting Enchantaholic Mode from the legacy game rule (default OFF)");
		}
		boolean legacy = readLegacyRule(dataDir.resolve("minecraft/game_rules.dat"));
		EnchantaholicMode.set(server, legacy);
		server.getDataStorage().scheduleSave();
		if (legacy) Enchantaholic.LOGGER.info("Migrated game rule {}=true to Enchantaholic Mode ON", LEGACY_RULE_KEY);
	}

	/** true iff the file exists and its data compound has the legacy rule set to true. Never throws. */
	public static boolean readLegacyRule(Path gameRulesDat) {
		if (!Files.isRegularFile(gameRulesDat)) return false;
		try {
			CompoundTag root = NbtIo.readCompressed(gameRulesDat, NbtAccounter.unlimitedHeap());
			return root.getCompoundOrEmpty("data").getBooleanOr(LEGACY_RULE_KEY, false);
		} catch (IOException | RuntimeException e) {
			Enchantaholic.LOGGER.warn("Could not read {} for the legacy Enchantaholic game rule: {}", gameRulesDat, e.toString());
			return false;
		}
	}
}
