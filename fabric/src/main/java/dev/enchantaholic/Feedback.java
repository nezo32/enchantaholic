package dev.enchantaholic;

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

/** Actionbar message and a quiet sound, only for the affected player. */
public final class Feedback {
	private static final float VOLUME = 0.25F;
	private static final float PITCH = 1.6F;

	private Feedback() {}

	/** "✦ item → Enchant N". Curses keep vanilla red, other enchantments are aqua. */
	public static Component message(ItemStack stack, Holder<Enchantment> enchantment, int level) {
		Component name = Enchantment.getFullname(enchantment, level);
		if (!enchantment.is(EnchantmentTags.CURSE)) {
			name = name.copy().withStyle(ChatFormatting.AQUA);
		}
		return Component.translatable("enchantaholic.message.enchanted",
				stack.getHoverName().copy().withStyle(ChatFormatting.LIGHT_PURPLE),
				name);
	}

	public static void send(ServerPlayer player, ItemEnchanter.Result result) {
		player.sendOverlayMessage(message(result.stack(), result.enchantment(), result.newLevel()));
		player.connection.send(new ClientboundSoundPacket(
				BuiltInRegistries.SOUND_EVENT.wrapAsHolder(SoundEvents.EXPERIENCE_ORB_PICKUP),
				SoundSource.PLAYERS, player.getX(), player.getY(), player.getZ(),
				VOLUME, PITCH, player.getRandom().nextLong()));
	}
}
