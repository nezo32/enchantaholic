package dev.enchantaholic.test;

import static dev.enchantaholic.test.TestSupport.breakBlock;
import static dev.enchantaholic.test.TestSupport.breakBlocks;
import static dev.enchantaholic.test.TestSupport.ench;
import static dev.enchantaholic.test.TestSupport.maxedAllExcept;
import static dev.enchantaholic.test.TestSupport.setMode;
import static dev.enchantaholic.test.TestSupport.survivalPlayer;
import static dev.enchantaholic.test.TestSupport.totalLevels;

import dev.enchantaholic.BlockBreakHandler;
import dev.enchantaholic.ItemEnchanter;
import java.util.Optional;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.core.Holder;
import net.minecraft.core.component.DataComponents;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.ItemEnchantments;
import net.minecraft.world.item.enchantment.Enchantments;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.block.Blocks;

/**
 * Server gametests (run by {@code ./gradlew build} through {@code runGameTest}).
 *
 * <p>Concurrency: all tests of a batch share one server, and Enchantaholic Mode is server-global.
 * Every mode-dependent test therefore sets the mode at the start and does all of its breaking
 * and asserting synchronously inside the test method (no delays, no polling), so no other test
 * can run in between. Every test ends with {@code helper.succeed()}.
 */
public class EnchantaholicGameTests {
	private static final int HEAD = 39;
	private static final int FEET = 36;
	private static final int BODY = 41;
	private static final int SADDLE = 42;

	@GameTest
	public void stoneTriggers(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(0, new ItemStack(Items.STICK));
		breakBlocks(helper, player, Blocks.STONE, 20);
		ItemStack stick = player.getInventory().getItem(0);
		helper.assertValueEqual(totalLevels(stick), 20, "total levels after 20 stone breaks");
		helper.succeed();
	}

	@GameTest
	public void shortGrassDoesNotTrigger(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(0, new ItemStack(Items.STICK));
		ItemStack before = player.getInventory().getItem(0).copy();
		breakBlock(helper, player, Blocks.SHORT_GRASS);
		helper.assertTrue(ItemStack.matches(before, player.getInventory().getItem(0)), "short grass must not enchant");

		helper.assertTrue(BlockBreakHandler.countsAsNonInstabreak(Blocks.STONE.defaultBlockState()), "stone counts");
		helper.assertTrue(BlockBreakHandler.countsAsNonInstabreak(Blocks.OBSIDIAN.defaultBlockState()), "obsidian counts");
		helper.assertTrue(!BlockBreakHandler.countsAsNonInstabreak(Blocks.SHORT_GRASS.defaultBlockState()), "short grass is instabreak");
		helper.assertTrue(!BlockBreakHandler.countsAsNonInstabreak(Blocks.TORCH.defaultBlockState()), "torch is instabreak");
		helper.succeed();
	}

	@GameTest
	public void modeOffDoesNotTrigger(GameTestHelper helper) {
		setMode(helper, false);
		try {
			ServerPlayer player = survivalPlayer(helper);
			player.getInventory().setItem(0, new ItemStack(Items.STICK));
			ItemStack before = player.getInventory().getItem(0).copy();
			helper.assertTrue(!BlockBreakHandler.shouldTrigger(helper.getLevel(), player, Blocks.STONE.defaultBlockState()),
					"shouldTrigger must be false with the mode off");
			breakBlocks(helper, player, Blocks.STONE, 10);
			helper.assertTrue(ItemStack.matches(before, player.getInventory().getItem(0)), "mode off must not enchant");
		} finally {
			setMode(helper, true);
		}
		helper.succeed();
	}

	@GameTest
	public void creativeDoesNotTrigger(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		helper.assertTrue(BlockBreakHandler.shouldTrigger(helper.getLevel(), player, Blocks.STONE.defaultBlockState()),
				"sanity: survival + mode on + stone triggers");

		player.setGameMode(GameType.CREATIVE);
		player.getInventory().setItem(0, new ItemStack(Items.STICK));
		ItemStack before = player.getInventory().getItem(0).copy();
		breakBlocks(helper, player, Blocks.STONE, 10);
		helper.assertTrue(ItemStack.matches(before, player.getInventory().getItem(0)), "creative must not enchant");

		player.setGameMode(GameType.SPECTATOR);
		helper.assertTrue(!BlockBreakHandler.shouldTrigger(helper.getLevel(), player, Blocks.STONE.defaultBlockState()),
				"spectator must not trigger");
		helper.succeed();
	}

	@GameTest
	public void lungeNeverOnNonSpear(GameTestHelper helper) {
		ServerPlayer player = survivalPlayer(helper);
		Holder<Enchantment> lunge = ench(helper, Enchantments.LUNGE);

		// everything but lunge maxed: lunge is the only possible roll, and it is not allowed on a stick
		player.getInventory().setItem(0, maxedAllExcept(helper, Items.STICK, Enchantments.LUNGE));
		ItemStack before = player.getInventory().getItem(0).copy();
		for (int seed = 0; seed < 200; seed++) {
			Optional<ItemEnchanter.Result> r = ItemEnchanter.enchantRandom(player, RandomSource.create(seed));
			helper.assertTrue(r.isEmpty(), "seed " + seed + ": expected no pick, got " + r);
		}
		ItemStack after = player.getInventory().getItem(0);
		helper.assertValueEqual(ItemEnchanter.getLevel(after, lunge), 0, "lunge level on maxed stick");
		helper.assertTrue(ItemStack.matches(before, after), "maxed stick must be unchanged");

		// a fresh stick: 500 rolls, lunge never lands
		player.getInventory().setItem(0, new ItemStack(Items.STICK));
		RandomSource random = RandomSource.create(4242L);
		for (int i = 0; i < 500; i++) {
			Optional<ItemEnchanter.Result> r = ItemEnchanter.enchantRandom(player, random);
			helper.assertTrue(r.isPresent(), "roll " + i + ": fresh stick must always get a pick");
			helper.assertTrue(!ItemEnchanter.isLunge(r.get().enchantment()), "roll " + i + ": lunge picked for a stick");
		}
		ItemStack fresh = player.getInventory().getItem(0);
		helper.assertValueEqual(ItemEnchanter.getLevel(fresh, lunge), 0, "lunge level on fresh stick");
		helper.assertValueEqual(totalLevels(fresh), 500, "total levels on fresh stick after 500 rolls");
		helper.succeed();
	}

	@GameTest
	public void lungeReachableOnSpear(GameTestHelper helper) {
		ServerPlayer player = survivalPlayer(helper);
		Holder<Enchantment> lunge = ench(helper, Enchantments.LUNGE);
		player.getInventory().setItem(0, maxedAllExcept(helper, Items.IRON_SPEAR, Enchantments.LUNGE));
		Optional<ItemEnchanter.Result> r = ItemEnchanter.enchantRandom(player, RandomSource.create(7L));
		helper.assertTrue(r.isPresent(), "spear with only lunge left must get a pick");
		helper.assertTrue(r.get().enchantment().is(Enchantments.LUNGE), "picked " + r.get().enchantment());
		helper.assertValueEqual(r.get().newLevel(), 1, "result level");
		helper.assertValueEqual(r.get().slot(), 0, "result slot");
		helper.assertValueEqual(ItemEnchanter.getLevel(player.getInventory().getItem(0), lunge), 1, "lunge level on spear");
		helper.succeed();
	}

	@GameTest
	public void levelsStack(GameTestHelper helper) {
		Holder<Enchantment> sharp = ench(helper, Enchantments.SHARPNESS);
		ItemStack sword = new ItemStack(Items.DIAMOND_SWORD);
		int last = 0;
		for (int i = 0; i < 7; i++) last = ItemEnchanter.apply(sword, sharp);
		helper.assertValueEqual(last, 7, "apply return value");
		helper.assertValueEqual(ItemEnchanter.getLevel(sword, sharp), 7, "sharpness level");
		helper.assertValueEqual(sword.getOrDefault(DataComponents.ENCHANTMENTS, ItemEnchantments.EMPTY).getLevel(sharp), 7,
				"sharpness level in ENCHANTMENTS");
		helper.succeed();
	}

	@GameTest
	public void capsAt255(GameTestHelper helper) {
		Holder<Enchantment> sharp = ench(helper, Enchantments.SHARPNESS);
		ItemStack sword = new ItemStack(Items.DIAMOND_SWORD);
		TestSupport.setLevel(sword, sharp, 254);
		helper.assertValueEqual(ItemEnchanter.apply(sword, sharp), 255, "254 -> 255");
		helper.assertValueEqual(ItemEnchanter.apply(sword, sharp), 255, "255 stays 255");
		helper.assertValueEqual(ItemEnchanter.getLevel(sword, sharp), 255, "stored level");

		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(0, maxedAllExcept(helper, Items.STICK));
		ItemStack before = player.getInventory().getItem(0).copy();
		Optional<ItemEnchanter.Result> r = ItemEnchanter.enchantRandom(player, RandomSource.create(1L));
		helper.assertTrue(r.isEmpty(), "fully maxed stick must yield no pick, got " + r);
		helper.assertTrue(ItemStack.matches(before, player.getInventory().getItem(0)), "fully maxed stick unchanged");
		helper.succeed();
	}

	@GameTest
	public void fortuneAndSilkTouchExcludeEachOther(GameTestHelper helper) {
		ItemStack silky = new ItemStack(Items.DIAMOND_PICKAXE);
		ItemEnchanter.apply(silky, ench(helper, Enchantments.SILK_TOUCH));
		helper.assertTrue(ItemEnchanter.excludedBy(silky, ench(helper, Enchantments.FORTUNE)), "Silk Touch blocks Fortune");
		helper.assertFalse(ItemEnchanter.excludedBy(silky, ench(helper, Enchantments.SILK_TOUCH)), "Silk Touch can still level up");

		ItemStack lucky = new ItemStack(Items.DIAMOND_PICKAXE);
		ItemEnchanter.apply(lucky, ench(helper, Enchantments.FORTUNE));
		helper.assertTrue(ItemEnchanter.excludedBy(lucky, ench(helper, Enchantments.SILK_TOUCH)), "Fortune blocks Silk Touch");
		helper.assertFalse(ItemEnchanter.excludedBy(lucky, ench(helper, Enchantments.FORTUNE)), "Fortune can still level up");

		// Everything maxed except the blocked one: the roll must find nothing rather than add it.
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(0, maxedAllExcept(helper, Items.STICK, Enchantments.FORTUNE));
		helper.assertTrue(ItemEnchanter.enchantRandom(player, RandomSource.create(1L)).isEmpty(), "no Fortune next to Silk Touch");
		player.getInventory().setItem(0, maxedAllExcept(helper, Items.STICK, Enchantments.SILK_TOUCH));
		helper.assertTrue(ItemEnchanter.enchantRandom(player, RandomSource.create(1L)).isEmpty(), "no Silk Touch next to Fortune");
		helper.succeed();
	}

	@GameTest
	public void booksUseStoredEnchantments(GameTestHelper helper) {
		Holder<Enchantment> sharp = ench(helper, Enchantments.SHARPNESS);

		ItemStack enchantedBook = new ItemStack(Items.ENCHANTED_BOOK);
		ItemEnchanter.apply(enchantedBook, sharp);
		helper.assertValueEqual(enchantedBook.getOrDefault(DataComponents.STORED_ENCHANTMENTS, ItemEnchantments.EMPTY).getLevel(sharp), 1,
				"enchanted book: stored level");
		helper.assertTrue(enchantedBook.getOrDefault(DataComponents.ENCHANTMENTS, ItemEnchantments.EMPTY).isEmpty(),
				"enchanted book: ENCHANTMENTS stays empty");

		ItemStack book = new ItemStack(Items.BOOK);
		ItemEnchanter.apply(book, sharp);
		helper.assertTrue(book.is(Items.BOOK), "plain book is not converted");
		helper.assertValueEqual(book.getOrDefault(DataComponents.ENCHANTMENTS, ItemEnchantments.EMPTY).getLevel(sharp), 1,
				"plain book: ENCHANTMENTS level");

		// end to end: an enchanted book alone in the inventory, one stone break
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(0, new ItemStack(Items.ENCHANTED_BOOK));
		breakBlock(helper, player, Blocks.STONE);
		ItemStack after = player.getInventory().getItem(0);
		helper.assertValueEqual(totalLevels(after), 1, "stored total after one break");
		helper.assertTrue(after.getOrDefault(DataComponents.ENCHANTMENTS, ItemEnchantments.EMPTY).isEmpty(),
				"e2e enchanted book: ENCHANTMENTS stays empty");
		helper.succeed();
	}

	@GameTest
	public void armorSlotReachable(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(HEAD, new ItemStack(Items.LEATHER_HELMET));
		breakBlock(helper, player, Blocks.STONE);
		helper.assertValueEqual(totalLevels(player.getInventory().getItem(HEAD)), 1, "helmet (slot 39) total");

		player.getInventory().clearContent();
		player.getInventory().setItem(FEET, new ItemStack(Items.LEATHER_BOOTS));
		breakBlock(helper, player, Blocks.STONE);
		helper.assertValueEqual(totalLevels(player.getInventory().getItem(FEET)), 1, "boots (slot 36) total");
		helper.succeed();
	}

	@GameTest
	public void offhandSlotReachable(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(Inventory.SLOT_OFFHAND, new ItemStack(Items.STICK));
		breakBlock(helper, player, Blocks.STONE);
		helper.assertValueEqual(totalLevels(player.getInventory().getItem(Inventory.SLOT_OFFHAND)), 1, "offhand total");
		helper.succeed();
	}

	@GameTest
	public void bodyAndSaddleNeverChosen(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		Inventory inv = player.getInventory();
		inv.setItem(BODY, new ItemStack(Items.DIAMOND_HORSE_ARMOR));
		inv.setItem(SADDLE, new ItemStack(Items.SADDLE));
		ItemStack body = inv.getItem(BODY).copy();
		ItemStack saddle = inv.getItem(SADDLE).copy();
		// If a player's equipment ignored these slots, getItem would be empty and the assertions below trivially true;
		// in 26.x EntityEquipment stores them, so make sure the test really exercises them.
		helper.assertTrue(!body.isEmpty() && !saddle.isEmpty(), "body/saddle slots must hold the items for this test");
		breakBlocks(helper, player, Blocks.STONE, 5);
		helper.assertTrue(ItemStack.matches(body, inv.getItem(BODY)), "body slot (41) must not be enchanted");
		helper.assertTrue(ItemStack.matches(saddle, inv.getItem(SADDLE)), "saddle slot (42) must not be enchanted");
		helper.succeed();
	}

	@GameTest
	public void emptyInventoryNoop(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		breakBlock(helper, player, Blocks.STONE);
		helper.assertTrue(ItemEnchanter.enchantRandom(player, RandomSource.create(3L)).isEmpty(), "empty inventory: no pick");
		for (int i = 0; i <= ItemEnchanter.LAST_SLOT; i++) {
			helper.assertTrue(player.getInventory().getItem(i).isEmpty(), "slot " + i + " stays empty");
		}
		helper.succeed();
	}

	@GameTest
	public void anyItemAnyEnchant(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		player.getInventory().setItem(0, new ItemStack(Items.DIRT, 64));
		breakBlocks(helper, player, Blocks.STONE, 5);
		ItemStack dirt = player.getInventory().getItem(0);
		helper.assertTrue(dirt.is(Items.DIRT), "still dirt");
		helper.assertValueEqual(dirt.getCount(), 64, "whole stack stays together");
		helper.assertValueEqual(totalLevels(dirt), 5, "dirt total after 5 breaks");
		helper.succeed();
	}

	@GameTest
	public void onlyOneItemPerBreak(GameTestHelper helper) {
		setMode(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		Inventory inv = player.getInventory();
		int[] slots = {0, 7, 20, 38, Inventory.SLOT_OFFHAND};
		inv.setItem(0, new ItemStack(Items.STICK));
		inv.setItem(7, new ItemStack(Items.DIAMOND_SWORD));
		inv.setItem(20, new ItemStack(Items.DIRT, 10));
		inv.setItem(38, new ItemStack(Items.LEATHER_CHESTPLATE));
		inv.setItem(Inventory.SLOT_OFFHAND, new ItemStack(Items.BOOK));
		ItemStack[] before = new ItemStack[slots.length];
		for (int i = 0; i < slots.length; i++) before[i] = inv.getItem(slots[i]).copy();

		breakBlock(helper, player, Blocks.STONE);

		int changed = 0;
		for (int i = 0; i < slots.length; i++) {
			ItemStack now = inv.getItem(slots[i]);
			if (!ItemStack.matches(before[i], now)) {
				changed++;
				helper.assertValueEqual(totalLevels(now), 1, "changed stack in slot " + slots[i] + " total");
			}
		}
		helper.assertValueEqual(changed, 1, "number of changed stacks after one break");
		helper.succeed();
	}
}
