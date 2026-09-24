package dev.enchantaholic;

import dev.enchantaholic.net.EnchantedPayload;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.ChatFormatting;
import net.minecraft.core.Holder;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundSoundPacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.EnchantmentTags;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;

/**
 * Actionbar message and a quiet sound, only for the affected player.
 *
 * <p>If the player's client has Enchantaholic (it accepts the {@code enchantaholic:enchanted} channel), the server
 * sends only an {@link EnchantedPayload} with the message, and the client shows the message and plays the sound
 * according to its own notification settings. Otherwise (vanilla client, server-only install) the server sends the
 * overlay message and the sound packet itself.
 */
public final class Feedback {
	public static final float VOLUME = 0.25F;
	public static final float PITCH = 1.6F;

	private Feedback() {}

	/** "✦ item → Enchant N". Curses keep vanilla red, other enchantments are aqua. */
	public static Component message(ItemStack stack, Holder<Enchantment> enchantment, int level) {
		Component name = Enchantment.getFullname(enchantment, level);
		if (!enchantment.is(EnchantmentTags.CURSE)) {
			name = name.copy().withStyle(ChatFormatting.AQUA);
		}
		// fallback: server-only installs (vanilla clients have no mod lang)
		return Component.translatableWithFallback("enchantaholic.message.enchanted", "✦ %1$s → %2$s",
				stack.getHoverName().copy().withStyle(ChatFormatting.LIGHT_PURPLE),
				name);
	}

	public static void send(ServerPlayer player, ItemEnchanter.Result result) {
		send(player, result, ServerPlayNetworking.canSend(player, EnchantedPayload.TYPE));
	}

	/** modded = the client has the enchantaholic:enchanted channel. Public for gametests. */
	public static void send(ServerPlayer player, ItemEnchanter.Result result, boolean modded) {
		Component msg = message(result.stack(), result.enchantment(), result.newLevel());
		if (modded) {
			// the client decides message/sound from its own config
			player.connection.send(ServerPlayNetworking.createClientboundPacket(new EnchantedPayload(msg)));
			return;
		}
		player.sendOverlayMessage(msg);
		player.connection.send(new ClientboundSoundPacket(
				BuiltInRegistries.SOUND_EVENT.wrapAsHolder(SoundEvents.EXPERIENCE_ORB_PICKUP),
				SoundSource.PLAYERS, player.getX(), player.getY(), player.getZ(),
				VOLUME, PITCH, player.getRandom().nextLong()));
	}
}
