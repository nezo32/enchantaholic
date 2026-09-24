package dev.enchantaholic.mode;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;

/** /enchantaholic [on|off|status], permission level 2 (gamemasters) like /gamerule. */
public final class ModeCommand {
	private ModeCommand() {}

	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("enchantaholic")
				.requires(Commands.hasPermission(Commands.LEVEL_GAMEMASTERS))
				.executes(c -> status(c.getSource()))
				.then(Commands.literal("on").executes(c -> set(c.getSource(), true)))
				.then(Commands.literal("off").executes(c -> set(c.getSource(), false)))
				.then(Commands.literal("status").executes(c -> status(c.getSource()))));
	}

	private static int set(CommandSourceStack source, boolean value) {
		EnchantaholicMode.set(source.getServer(), value);
		source.sendSuccess(() -> value
				? Component.translatableWithFallback("enchantaholic.command.on", "Enchantaholic Mode is now ON for this world")
				: Component.translatableWithFallback("enchantaholic.command.off", "Enchantaholic Mode is now OFF for this world"), true);
		return value ? 1 : 0;
	}

	private static int status(CommandSourceStack source) {
		boolean on = EnchantaholicMode.isEnabled(source.getServer());
		source.sendSuccess(() -> on
				? Component.translatableWithFallback("enchantaholic.command.status.on", "Enchantaholic Mode is ON in this world")
				: Component.translatableWithFallback("enchantaholic.command.status.off", "Enchantaholic Mode is OFF in this world"), false);
		return on ? 1 : 0;
	}
}
