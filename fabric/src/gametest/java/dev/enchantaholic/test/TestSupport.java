package dev.enchantaholic.test;

import com.mojang.authlib.GameProfile;
import dev.enchantaholic.ItemEnchanter;
import dev.enchantaholic.core.Levels;
import dev.enchantaholic.mode.EnchantaholicMode;
import io.netty.channel.embedded.EmbeddedChannel;
import it.unimi.dsi.fastutil.objects.Object2IntMap;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.registries.Registries;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.network.Connection;
import net.minecraft.network.protocol.PacketFlow;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.CommonListenerCookie;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.ItemEnchantments;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.block.Block;

/** Shared helpers for the server gametests. */
public final class TestSupport {
	/** Relative position (inside the test structure) where blocks are placed and broken. */
	public static final BlockPos BREAK_POS = new BlockPos(1, 1, 1);

	private TestSupport() {}

	/**
	 * A mock server player in the test level, in survival, with an empty inventory.
	 *
	 * <p>Same as {@link GameTestHelper#makeMockServerPlayerInLevel()}, except that the vanilla helper's
	 * player overrides {@code gameMode()} to always return CREATIVE, so {@code isCreative()} would be
	 * true no matter what {@code setGameMode} says. This one uses the real game mode.
	 */
	public static ServerPlayer survivalPlayer(GameTestHelper h) {
		ServerLevel level = h.getLevel();
		CommonListenerCookie cookie = CommonListenerCookie.createInitial(new GameProfile(UUID.randomUUID(), "test-mock-player"), false);
		ServerPlayer p = new ServerPlayer(level.getServer(), level, cookie.gameProfile(), cookie.clientInformation());
		Connection connection = new Connection(PacketFlow.SERVERBOUND);
		new EmbeddedChannel(connection);
		level.getServer().getPlayerList().placeNewPlayer(connection, p, cookie);
		p.setGameMode(GameType.SURVIVAL);
		p.getInventory().clearContent();
		return p;
	}

	/**
	 * Sets Enchantaholic Mode. It is per world (server-global) and gametests share one server, so every
	 * mode-dependent test sets it itself and does all of its work synchronously afterwards.
	 */
	public static void setMode(GameTestHelper h, boolean value) {
		EnchantaholicMode.set(h.getLevel().getServer(), value);
	}

	public static boolean mode(GameTestHelper h) {
		return EnchantaholicMode.isEnabled(h.getLevel().getServer());
	}

	/**
	 * Sets the Custom Enchantments switch (per world, server-global). Custom-effect tests run in parallel and rely on
	 * it being ON: a test that needs OFF does synchronous work only and restores ON in {@code finally}.
	 */
	public static void setCustom(GameTestHelper h, boolean value) {
		EnchantaholicMode.setCustomEnchants(h.getLevel().getServer(), value);
	}

	public static boolean custom(GameTestHelper h) {
		return EnchantaholicMode.isCustomEnchants(h.getLevel().getServer());
	}

	/** Places {@code b} at {@link #BREAK_POS} and has the player break it (fires PlayerBlockBreakEvents.AFTER). */
	public static void breakBlock(GameTestHelper h, ServerPlayer p, Block b) {
		h.setBlock(BREAK_POS, b);
		p.gameMode.destroyBlock(h.absolutePos(BREAK_POS));
	}

	public static void breakBlocks(GameTestHelper h, ServerPlayer p, Block b, int times) {
		for (int i = 0; i < times; i++) breakBlock(h, p, b);
	}

	public static Holder<Enchantment> ench(GameTestHelper h, ResourceKey<Enchantment> k) {
		return h.getLevel().registryAccess().lookupOrThrow(Registries.ENCHANTMENT).getOrThrow(k);
	}

	public static List<Holder<Enchantment>> allEnchantments(GameTestHelper h) {
		return ItemEnchanter.allEnchantments(h.getLevel().registryAccess());
	}

	/** Sum of all levels in the stack's enchantment component (stored enchantments for enchanted books). */
	public static int totalLevels(ItemStack s) {
		int total = 0;
		for (Object2IntMap.Entry<Holder<Enchantment>> e : s.getOrDefault(ItemEnchanter.componentFor(s), ItemEnchantments.EMPTY).entrySet()) {
			total += e.getIntValue();
		}
		return total;
	}

	/** Sets {@code ench} on {@code stack} to exactly {@code level} (via ItemEnchantments.Mutable). */
	public static void setLevel(ItemStack stack, Holder<Enchantment> ench, int level) {
		var type = ItemEnchanter.componentFor(stack);
		ItemEnchantments.Mutable m = new ItemEnchantments.Mutable(stack.getOrDefault(type, ItemEnchantments.EMPTY));
		m.set(ench, level);
		stack.set(type, m.toImmutable());
	}

	/** A stack of {@code item} with every registry enchantment at 255, except the ones listed. */
	@SafeVarargs
	public static ItemStack maxedAllExcept(GameTestHelper h, Item item, ResourceKey<Enchantment>... except) {
		List<ResourceKey<Enchantment>> skip = Arrays.asList(except);
		ItemStack stack = new ItemStack(item);
		var type = ItemEnchanter.componentFor(stack);
		ItemEnchantments.Mutable m = new ItemEnchantments.Mutable(stack.getOrDefault(type, ItemEnchantments.EMPTY));
		for (Holder<Enchantment> e : allEnchantments(h)) {
			if (skip.stream().anyMatch(e::is)) continue;
			m.set(e, Levels.MAX_LEVEL);
		}
		stack.set(type, m.toImmutable());
		return stack;
	}
}
