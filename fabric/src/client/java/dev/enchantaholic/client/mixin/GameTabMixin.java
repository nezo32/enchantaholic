package dev.enchantaholic.client.mixin;

import com.llamalad7.mixinextras.sugar.Local;
import dev.enchantaholic.client.CreateWorldModeHolder;
import net.minecraft.client.gui.components.CycleButton;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.layouts.GridLayout;
import net.minecraft.client.gui.screens.worldselection.CreateWorldScreen;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Adds the "Enchantaholic Mode: ON/OFF" toggle to the "Game" tab of the Create World screen, below
 * "Allow Commands". The value lives on the screen (CreateWorldScreenMixin), not in a game rule.
 */
@Mixin(targets = "net.minecraft.client.gui.screens.worldselection.CreateWorldScreen$GameTab")
public abstract class GameTabMixin {
	@Inject(method = "<init>", at = @At("TAIL"))
	private void enchantaholic$addToggle(CreateWorldScreen screen, CallbackInfo ci, @Local GridLayout.RowHelper helper) {
		CreateWorldModeHolder holder = (CreateWorldModeHolder) screen;
		helper.addChild(CycleButton.onOffBuilder(holder.enchantaholic$isModeEnabled())
				.withTooltip(value -> Tooltip.create(Component.translatable("enchantaholic.createWorld.toggle.tooltip")))
				.create(0, 0, 210, 20, Component.translatable("enchantaholic.createWorld.toggle"),
						(b, value) -> holder.enchantaholic$setModeEnabled(value)));
		helper.addChild(CycleButton.onOffBuilder(holder.enchantaholic$isCustomEnabled())
				.withTooltip(value -> Tooltip.create(Component.translatable("enchantaholic.createWorld.customToggle.tooltip")))
				.create(0, 0, 210, 20, Component.translatable("enchantaholic.createWorld.customToggle"),
						(b, value) -> holder.enchantaholic$setCustomEnabled(value)));
	}
}
