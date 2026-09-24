package dev.enchantaholic.test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.mojang.authlib.GameProfile;
import dev.enchantaholic.Feedback;
import dev.enchantaholic.ItemEnchanter;
import dev.enchantaholic.net.EnchantedPayload;
import io.netty.buffer.Unpooled;
import io.netty.channel.embedded.EmbeddedChannel;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.network.Connection;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.contents.TranslatableContents;
import net.minecraft.network.protocol.PacketFlow;
import net.minecraft.network.protocol.common.ClientboundCustomPayloadPacket;
import net.minecraft.network.protocol.game.ClientboundSoundPacket;
import net.minecraft.network.protocol.game.ClientboundSystemChatPacket;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.CommonListenerCookie;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.enchantment.Enchantments;
import net.minecraft.world.level.GameType;

/**
 * Notification delivery: vanilla clients get the overlay message + sound packet from the server; clients with
 * Enchantaholic get only the {@code enchantaholic:enchanted} payload and decide themselves.
 */
public class EnchantaholicNotifyGameTests {
	/** A mock player whose outbound packets can be inspected (same setup as armorAndOffhandChangeIsSentToClient). */
	private record Mock(ServerPlayer player, EmbeddedChannel channel) {
		List<Object> drain() {
			channel.runPendingTasks();
			List<Object> out = new ArrayList<>(channel.outboundMessages());
			channel.outboundMessages().clear();
			return out;
		}
	}

	private static Mock mockPlayer(GameTestHelper helper) {
		ServerLevel level = helper.getLevel();
		CommonListenerCookie cookie = CommonListenerCookie.createInitial(new GameProfile(UUID.randomUUID(), "notify-mock-player"), false);
		ServerPlayer player = new ServerPlayer(level.getServer(), level, cookie.gameProfile(), cookie.clientInformation());
		Connection connection = new Connection(PacketFlow.SERVERBOUND);
		EmbeddedChannel channel = new EmbeddedChannel(connection);
		level.getServer().getPlayerList().placeNewPlayer(connection, player, cookie);
		player.setGameMode(GameType.SURVIVAL);
		player.getInventory().clearContent();
		Mock mock = new Mock(player, channel);
		mock.drain(); // join packets
		return mock;
	}

	private static ItemEnchanter.Result result(GameTestHelper helper) {
		return new ItemEnchanter.Result(0, new ItemStack(Items.STICK), TestSupport.ench(helper, Enchantments.SHARPNESS), 2);
	}

	private static Component expected(ItemEnchanter.Result r) {
		return Feedback.message(r.stack(), r.enchantment(), r.newLevel());
	}

	private static boolean isEnchantedPayload(Object msg) {
		return msg instanceof ClientboundCustomPayloadPacket p && p.payload() instanceof EnchantedPayload;
	}

	@GameTest
	public void vanillaClientGetsOverlayAndSound(GameTestHelper helper) {
		Mock mock = mockPlayer(helper);
		helper.assertTrue(!ServerPlayNetworking.canSend(mock.player(), EnchantedPayload.TYPE), "mock player has no enchantaholic channel");
		ItemEnchanter.Result r = result(helper);
		Feedback.send(mock.player(), r);
		List<Object> out = mock.drain();
		long overlays = out.stream().filter(m -> m instanceof ClientboundSystemChatPacket p && p.overlay()
				&& p.content().equals(expected(r))).count();
		long sounds = out.stream().filter(m -> m instanceof ClientboundSoundPacket).count();
		long payloads = out.stream().filter(EnchantaholicNotifyGameTests::isEnchantedPayload).count();
		helper.assertValueEqual(overlays, 1L, "overlay message packets; outbound=" + out);
		helper.assertValueEqual(sounds, 1L, "sound packets; outbound=" + out);
		helper.assertValueEqual(payloads, 0L, "enchanted payloads; outbound=" + out);
		helper.succeed();
	}

	@GameTest
	public void moddedClientGetsPayloadOnly(GameTestHelper helper) {
		Mock mock = mockPlayer(helper);
		ItemEnchanter.Result r = result(helper);
		Feedback.send(mock.player(), r, true);
		List<Object> out = mock.drain();
		List<EnchantedPayload> payloads = out.stream().filter(EnchantaholicNotifyGameTests::isEnchantedPayload)
				.map(m -> (EnchantedPayload) ((ClientboundCustomPayloadPacket) m).payload()).toList();
		helper.assertValueEqual(payloads.size(), 1, "enchanted payloads; outbound=" + out);
		helper.assertValueEqual(payloads.get(0).message(), expected(r), "payload message");
		helper.assertTrue(out.stream().noneMatch(m -> m instanceof ClientboundSystemChatPacket p && p.overlay()),
				"no overlay packet; outbound=" + out);
		helper.assertTrue(out.stream().noneMatch(m -> m instanceof ClientboundSoundPacket), "no sound packet; outbound=" + out);
		helper.succeed();
	}

	@GameTest
	public void payloadCodecRoundTrip(GameTestHelper helper) {
		Component msg = expected(result(helper));
		RegistryFriendlyByteBuf buf = new RegistryFriendlyByteBuf(Unpooled.buffer(), helper.getLevel().registryAccess());
		try {
			EnchantedPayload.CODEC.encode(buf, new EnchantedPayload(msg));
			EnchantedPayload decoded = EnchantedPayload.CODEC.decode(buf);
			helper.assertValueEqual(decoded.message(), msg, "decoded message");
			helper.assertTrue(decoded.message().getContents() instanceof TranslatableContents, "translatable after decode");
			TranslatableContents tc = (TranslatableContents) decoded.message().getContents();
			helper.assertValueEqual(tc.getKey(), "enchantaholic.message.enchanted", "key");
			helper.assertValueEqual(tc.getFallback(), "✦ %1$s → %2$s", "fallback");
			helper.assertValueEqual(buf.readableBytes(), 0, "bytes left unread");
		} finally {
			buf.release();
		}
		helper.assertValueEqual(EnchantedPayload.TYPE.id().toString(), "enchantaholic:enchanted", "channel id");
		helper.succeed();
	}
}
