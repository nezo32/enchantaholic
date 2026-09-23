package dev.enchantaholic;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.gamerule.v1.GameRuleBuilder;
import net.minecraft.resources.Identifier;
import net.minecraft.world.level.gamerules.GameRule;
import net.minecraft.world.level.gamerules.GameRuleCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Enchantaholic implements ModInitializer {
	public static final String MOD_ID = "enchantaholic";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	/** Boolean game rule {@code enchantaholic:enchantaholic}, default off. Translation key: gamerule.enchantaholic.enchantaholic */
	public static final GameRule<Boolean> ENCHANTAHOLIC = GameRuleBuilder.forBoolean(false)
			.category(GameRuleCategory.PLAYER)
			.buildAndRegister(Identifier.fromNamespaceAndPath(MOD_ID, "enchantaholic"));

	@Override
	public void onInitialize() {
		PlayerBlockBreakEvents.AFTER.register(BlockBreakHandler::onAfterBreak);
	}
}
