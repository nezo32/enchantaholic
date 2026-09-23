package dev.enchantaholic.client.mixin;

import com.llamalad7.mixinextras.sugar.Local;
import dev.enchantaholic.Enchantaholic;
import net.minecraft.client.gui.components.CycleButton;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.layouts.GridLayout;
import net.minecraft.client.gui.screens.worldselection.CreateWorldScreen;
import net.minecraft.client.gui.screens.worldselection.WorldCreationUiState;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Adds an ON/OFF toggle for the {@code enchantaholic:enchantaholic} game rule to the "Game" tab
 * of the Create World screen, below "Allow Commands".
 *
 * <p>{@code GameTab} is a private inner class without a {@code this$0} field, so the outer
 * {@link CreateWorldScreen} is captured from the constructor argument.
 */
@Mixin(targets = "net.minecraft.client.gui.screens.worldselection.CreateWorldScreen$GameTab")
public abstract class GameTabMixin {
	@Inject(method = "<init>", at = @At("TAIL"))
	private void enchantaholic$addToggle(CreateWorldScreen screen, CallbackInfo ci, @Local GridLayout.RowHelper helper) {
		WorldCreationUiState ui = screen.getUiState();
		CycleButton<Boolean> button = helper.addChild(
				CycleButton.onOffBuilder(ui.getGameRules().get(Enchantaholic.ENCHANTAHOLIC))
						.withTooltip(value -> Tooltip.create(Component.translatable("enchantaholic.createWorld.toggle.tooltip")))
						.create(0, 0, 210, 20, Component.translatable("enchantaholic.createWorld.toggle"),
								// read the GameRules at click time: More > Game Rules replaces the object
								(b, value) -> ui.getGameRules().set(Enchantaholic.ENCHANTAHOLIC, value, null)));
		// keep the button in sync if the rule is changed via More > Game Rules
		ui.addListener(state -> button.setValue(state.getGameRules().get(Enchantaholic.ENCHANTAHOLIC)));
	}
}
