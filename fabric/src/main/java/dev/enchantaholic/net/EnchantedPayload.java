package dev.enchantaholic.net;

import dev.enchantaholic.Enchantaholic;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.ComponentSerialization;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

/**
 * Server to client: "one of your items was enchanted", carrying the complete actionbar message. Sent instead of the
 * vanilla overlay + sound packets when the client has Enchantaholic, so the client can apply its own settings.
 */
public record EnchantedPayload(Component message) implements CustomPacketPayload {
	public static final CustomPacketPayload.Type<EnchantedPayload> TYPE =
			new CustomPacketPayload.Type<>(Identifier.fromNamespaceAndPath(Enchantaholic.MOD_ID, "enchanted"));
	public static final StreamCodec<RegistryFriendlyByteBuf, EnchantedPayload> CODEC =
			StreamCodec.composite(ComponentSerialization.TRUSTED_STREAM_CODEC, EnchantedPayload::message, EnchantedPayload::new);

	@Override
	public Type<EnchantedPayload> type() {
		return TYPE;
	}

	/** Called once from Enchantaholic#onInitialize (runs on both sides). */
	public static void register() {
		PayloadTypeRegistry.clientboundPlay().register(TYPE, CODEC);
	}
}
