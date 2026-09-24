package dev.enchantaholic.test;

import static dev.enchantaholic.test.TestSupport.BREAK_POS;
import static dev.enchantaholic.test.TestSupport.breakBlock;
import static dev.enchantaholic.test.TestSupport.setRule;
import static dev.enchantaholic.test.TestSupport.survivalPlayer;
import static dev.enchantaholic.test.TestSupport.totalLevels;

import com.mojang.authlib.GameProfile;
import dev.enchantaholic.BlockBreakHandler;
import dev.enchantaholic.Enchantaholic;
import dev.enchantaholic.Feedback;
import dev.enchantaholic.ItemEnchanter;
import io.netty.channel.embedded.EmbeddedChannel;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.entity.FakePlayer;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.advancements.predicates.BlockPredicate;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.Registries;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.network.Connection;
import net.minecraft.network.chat.contents.TranslatableContents;
import net.minecraft.network.protocol.PacketFlow;
import net.minecraft.network.protocol.game.ClientboundContainerSetSlotPacket;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.CommonListenerCookie;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.AdventureModePredicate;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.Enchantments;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;

/**
 * Edge-case server gametests (tester additions). Same concurrency rule as {@link EnchantaholicGameTests}:
 * rule-dependent tests set the rule and do all work synchronously.
 */
public class EnchantaholicEdgeGameTests {
	/** Adventure mode is not excluded: a permitted (can_break) break triggers; shouldTrigger is true. */
	@GameTest
	public void adventureTriggers(GameTestHelper helper) {
		setRule(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		player.setGameMode(GameType.ADVENTURE);
		helper.assertValueEqual(player.gameMode(), GameType.ADVENTURE, "real game mode");
		helper.assertTrue(BlockBreakHandler.shouldTrigger(helper.getLevel(), player, Blocks.STONE.defaultBlockState()),
				"adventure must trigger");

		ItemStack pick = new ItemStack(Items.IRON_PICKAXE);
		pick.set(DataComponents.CAN_BREAK, new AdventureModePredicate(List.of(BlockPredicate.Builder.block()
				.of(helper.getLevel().registryAccess().lookupOrThrow(Registries.BLOCK), Blocks.STONE).build())));
		player.getInventory().setItem(0, pick);
		player.getInventory().setSelectedSlot(0);
		breakBlock(helper, player, Blocks.STONE);
		helper.assertBlockNotPresent(Blocks.STONE, BREAK_POS);
		helper.assertValueEqual(totalLevels(player.getInventory().getItem(0)), 1, "adventure break with can_break enchants");
		helper.succeed();
	}

	/** Toggling the rule mid-game with the real /gamerule command takes effect immediately. */
	@GameTest
	public void ruleToggledViaCommand(GameTestHelper helper) {
		MinecraftServer server = helper.getLevel().getServer();
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(0, new ItemStack(Items.STICK));
		try {
			server.getCommands().performPrefixedCommand(server.createCommandSourceStack(), "gamerule enchantaholic:enchantaholic false");
			helper.assertTrue(!helper.getLevel().getGameRules().get(Enchantaholic.ENCHANTAHOLIC), "command set false");
			breakBlock(helper, player, Blocks.STONE);
			helper.assertValueEqual(totalLevels(player.getInventory().getItem(0)), 0, "off via command: no enchant");

			server.getCommands().performPrefixedCommand(server.createCommandSourceStack(), "gamerule enchantaholic:enchantaholic true");
			helper.assertTrue(helper.getLevel().getGameRules().get(Enchantaholic.ENCHANTAHOLIC), "command set true");
			breakBlock(helper, player, Blocks.STONE);
			helper.assertValueEqual(totalLevels(player.getInventory().getItem(0)), 1, "on via command: one enchant");
		} finally {
			setRule(helper, true);
		}
		helper.succeed();
	}

	/** Blocks destroyed without a player break (plain destroyBlock, explosion) never enchant anything. */
	@GameTest
	public void nonPlayerBreaksDoNothing(GameTestHelper helper) {
		setRule(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(0, new ItemStack(Items.STICK));
		ServerLevel level = helper.getLevel();
		BlockPos abs = helper.absolutePos(BREAK_POS);

		helper.setBlock(BREAK_POS, Blocks.STONE);
		level.destroyBlock(abs, true, player);
		helper.assertBlockNotPresent(Blocks.STONE, BREAK_POS);

		helper.setBlock(BREAK_POS, Blocks.STONE);
		level.explode(null, abs.getX() + 0.5, abs.getY() + 0.5, abs.getZ() + 0.5, 3.0F, Level.ExplosionInteraction.BLOCK);
		helper.assertBlockNotPresent(Blocks.STONE, BREAK_POS);

		helper.assertValueEqual(totalLevels(player.getInventory().getItem(0)), 0, "non-player breaks: stick untouched");
		helper.succeed();
	}

	/** A Fabric FakePlayer (e.g. a machine mod) breaking a block never enchants anything and does not crash. */
	@GameTest
	public void fakePlayerIsSafe(GameTestHelper helper) {
		setRule(helper, true);
		FakePlayer fake = FakePlayer.get(helper.getLevel(), new GameProfile(UUID.randomUUID(), "enchantaholic-fake"));
		fake.getInventory().clearContent();
		fake.getInventory().setItem(0, new ItemStack(Items.STICK));
		helper.assertTrue(!BlockBreakHandler.shouldTrigger(helper.getLevel(), fake, Blocks.STONE.defaultBlockState()),
				"fake player must not trigger");
		breakBlock(helper, fake, Blocks.STONE);
		helper.assertBlockNotPresent(Blocks.STONE, BREAK_POS);
		helper.assertValueEqual(totalLevels(fake.getInventory().getItem(0)), 0, "fake player stick after a real break");
		// direct call with a null block entity
		BlockBreakHandler.onAfterBreak(helper.getLevel(), fake, helper.absolutePos(BREAK_POS), Blocks.STONE.defaultBlockState(), null);
		helper.assertValueEqual(totalLevels(fake.getInventory().getItem(0)), 0, "direct call, null block entity");
		fake.getInventory().clearContent();
		helper.succeed();
	}

	/** The pool is the full, datapack-free enchantment registry, curses and lunge included, no duplicates. */
	@GameTest
	public void poolIsWholeRegistry(GameTestHelper helper) {
		var lookup = helper.getLevel().registryAccess().lookupOrThrow(Registries.ENCHANTMENT);
		List<Holder<Enchantment>> all = ItemEnchanter.allEnchantments(helper.getLevel().registryAccess());
		helper.assertValueEqual(all.size(), (int) lookup.listElements().count(), "pool size == registry size");
		helper.assertValueEqual(new HashSet<>(all).size(), all.size(), "no duplicates");
		helper.assertTrue(all.size() >= 40, "vanilla registry has 40+ enchantments, got " + all.size());
		for (var key : List.of(Enchantments.LUNGE, Enchantments.BINDING_CURSE, Enchantments.VANISHING_CURSE,
				Enchantments.SHARPNESS, Enchantments.MENDING)) {
			helper.assertTrue(all.stream().anyMatch(h -> h.is(key)), "pool contains " + key);
		}
		helper.succeed();
	}

	/** Every slot 0..40 gets picked eventually; 41/42 never; each roll changes exactly one level. */
	@GameTest
	public void allSlots0to40Reachable(GameTestHelper helper) {
		ServerPlayer player = survivalPlayer(helper);
		Inventory inv = player.getInventory();
		for (int i = 0; i <= 40; i++) inv.setItem(i, new ItemStack(Items.STICK));
		inv.setItem(41, new ItemStack(Items.DIAMOND_HORSE_ARMOR));
		inv.setItem(42, new ItemStack(Items.SADDLE));
		ItemStack body = inv.getItem(41).copy();
		ItemStack saddle = inv.getItem(42).copy();
		Set<Integer> hit = new HashSet<>();
		RandomSource random = RandomSource.create(99L);
		int rolls = 3000;
		for (int n = 0; n < rolls; n++) {
			Optional<ItemEnchanter.Result> r = ItemEnchanter.enchantRandom(player, random);
			helper.assertTrue(r.isPresent(), "roll " + n + " must pick");
			int slot = r.get().slot();
			helper.assertTrue(slot >= 0 && slot <= 40, "slot out of range: " + slot);
			helper.assertTrue(r.get().stack() == inv.getItem(slot), "result stack is the live stack");
			hit.add(slot);
		}
		helper.assertValueEqual(hit.size(), 41, "distinct slots hit");
		int sum = 0;
		for (int i = 0; i <= 40; i++) sum += totalLevels(inv.getItem(i));
		helper.assertValueEqual(sum, rolls, "total levels == rolls");
		helper.assertTrue(ItemStack.matches(body, inv.getItem(41)), "slot 41 untouched");
		helper.assertTrue(ItemStack.matches(saddle, inv.getItem(42)), "slot 42 untouched");
		helper.succeed();
	}

	/** The in-place component change reaches the client immediately for armor (menu slot 5) and offhand (menu slot 45). */
	@GameTest
	public void armorAndOffhandChangeIsSentToClient(GameTestHelper helper) {
		setRule(helper, true);
		ServerLevel level = helper.getLevel();
		CommonListenerCookie cookie = CommonListenerCookie.createInitial(new GameProfile(UUID.randomUUID(), "sync-mock-player"), false);
		ServerPlayer player = new ServerPlayer(level.getServer(), level, cookie.gameProfile(), cookie.clientInformation());
		Connection connection = new Connection(PacketFlow.SERVERBOUND);
		EmbeddedChannel channel = new EmbeddedChannel(connection);
		level.getServer().getPlayerList().placeNewPlayer(connection, player, cookie);
		player.setGameMode(GameType.SURVIVAL);
		Inventory inv = player.getInventory();
		inv.clearContent();

		int[][] cases = {{39, 5}, {Inventory.SLOT_OFFHAND, 45}};
		for (int[] c : cases) {
			inv.clearContent();
			inv.setItem(c[0], new ItemStack(c[0] == 39 ? Items.LEATHER_HELMET : Items.STICK));
			player.containerMenu.broadcastChanges();
			channel.runPendingTasks();
			channel.outboundMessages().clear();

			breakBlock(helper, player, Blocks.STONE);
			channel.runPendingTasks();
			helper.assertValueEqual(totalLevels(inv.getItem(c[0])), 1, "server-side level in slot " + c[0]);
			boolean sent = false;
			for (Object msg : channel.outboundMessages()) {
				if (msg instanceof ClientboundContainerSetSlotPacket p && p.getContainerId() == player.inventoryMenu.containerId
						&& p.getSlot() == c[1] && totalLevels(p.getItem()) == 1) {
					sent = true;
				}
			}
			helper.assertTrue(sent, "slot update for menu slot " + c[1] + " was sent; outbound=" + channel.outboundMessages());
		}
		helper.succeed();
	}

	/** The actionbar message carries a literal fallback so vanilla clients on a server-only install see text, not a key. */
	@GameTest
	public void messageHasFallback(GameTestHelper helper) {
		var msg = Feedback.message(new ItemStack(Items.STICK), TestSupport.ench(helper, Enchantments.SHARPNESS), 12);
		helper.assertTrue(msg.getContents() instanceof TranslatableContents, "translatable message");
		TranslatableContents tc = (TranslatableContents) msg.getContents();
		helper.assertValueEqual(tc.getKey(), "enchantaholic.message.enchanted", "key");
		helper.assertValueEqual(tc.getFallback(), "\u2726 %1$s \u2192 %2$s", "fallback matches en_us");
		helper.succeed();
	}
}
