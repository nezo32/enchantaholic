package dev.enchantaholic;

import dev.enchantaholic.mode.ModeBootstrap;
import dev.enchantaholic.mode.ModeCommand;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Enchantaholic implements ModInitializer {
	public static final String MOD_ID = "enchantaholic";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		PlayerBlockBreakEvents.AFTER.register(BlockBreakHandler::onAfterBreak);
		ServerLifecycleEvents.SERVER_STARTING.register(ModeBootstrap::onServerStarting);
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> ModeCommand.register(dispatcher));
	}
}
