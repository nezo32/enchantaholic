package dev.enchantaholic.client;

import dev.enchantaholic.Feedback;
import dev.enchantaholic.core.NotifySettings;
import dev.enchantaholic.net.EnchantedPayload;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;

/** Receives {@link EnchantedPayload} and shows the message / plays the sound according to {@link NotifyConfig}. */
public final class NotifyClient {
	private NotifyClient() {}

	public static void register() {
		ClientPlayNetworking.registerGlobalReceiver(EnchantedPayload.TYPE, (payload, ctx) -> handle(payload.message(), ctx.player()));
	}

	/** Shows / plays according to NotifyConfig.get(). Public so the client gametest can call it directly. */
	public static void handle(Component message, LocalPlayer player) {
		if (player == null) return;
		NotifySettings settings = NotifyConfig.get();
		if (settings.message()) {
			player.sendOverlayMessage(message);
		}
		if (settings.sound()) {
			player.level().playLocalSound(player.getX(), player.getY(), player.getZ(), SoundEvents.EXPERIENCE_ORB_PICKUP,
					SoundSource.PLAYERS, Feedback.VOLUME, Feedback.PITCH, false);
		}
	}
}
