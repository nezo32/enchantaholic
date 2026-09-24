package dev.enchantaholic.test;

import static dev.enchantaholic.test.TestSupport.allEnchantments;
import static dev.enchantaholic.test.TestSupport.breakBlocks;
import static dev.enchantaholic.test.TestSupport.custom;
import static dev.enchantaholic.test.TestSupport.mode;
import static dev.enchantaholic.test.TestSupport.setCustom;
import static dev.enchantaholic.test.TestSupport.setLevel;
import static dev.enchantaholic.test.TestSupport.setMode;
import static dev.enchantaholic.test.TestSupport.survivalPlayer;
import static dev.enchantaholic.test.TestSupport.totalLevels;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import dev.enchantaholic.ItemEnchanter;
import dev.enchantaholic.custom.CustomEnchants;
import dev.enchantaholic.mixin.MinecraftServerAccessor;
import dev.enchantaholic.mode.EnchantaholicMode;
import dev.enchantaholic.mode.ModeBootstrap;
import dev.enchantaholic.mode.PendingWorldMode;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.core.Holder;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.NbtIo;
import net.minecraft.nbt.NbtOps;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.PermissionSet;
import net.minecraft.util.RandomSource;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.ItemEnchantments;
import net.minecraft.world.level.block.Blocks;

/**
 * /enchantaholic command, per-world saved state and the v0.1.0 game rule migration; the Custom Enchantments switch
 * (v0.3.0): /enchantaholic custom, saved-data compat, Create World handoff and roll-pool gating.
 *
 * <p>The custom switch is server-global and the custom-effect gametests run in parallel with these and need it ON:
 * every test here that turns it OFF does synchronous work only and restores ON in {@code finally}.
 */
public class EnchantaholicModeGameTests {
	private static int run(GameTestHelper h, CommandSourceStack source, String command) throws CommandSyntaxException {
		CommandDispatcher<CommandSourceStack> d = h.getLevel().getServer().getCommands().getDispatcher();
		return d.execute(command, source);
	}

	@GameTest
	public void commandOnOffStatus(GameTestHelper helper) throws CommandSyntaxException {
		MinecraftServer server = helper.getLevel().getServer();
		CommandSourceStack op = server.createCommandSourceStack();
		try {
			helper.assertValueEqual(run(helper, op, "enchantaholic off"), 0, "off result");
			helper.assertTrue(!mode(helper), "off stored");
			helper.assertValueEqual(run(helper, op, "enchantaholic status"), 0, "status off");
			helper.assertValueEqual(run(helper, op, "enchantaholic"), 0, "bare = status");
			helper.assertValueEqual(run(helper, op, "enchantaholic on"), 1, "on result");
			helper.assertTrue(mode(helper), "on stored");
			helper.assertValueEqual(run(helper, op, "enchantaholic status"), 1, "status on");
			helper.assertTrue(EnchantaholicMode.get(server).isDirty(), "state marked dirty for saving");
		} finally {
			setMode(helper, true);
		}
		helper.succeed();
	}

	@GameTest
	public void commandNeedsGamemaster(GameTestHelper helper) {
		setMode(helper, true);
		MinecraftServer server = helper.getLevel().getServer();
		CommandSourceStack nobody = server.createCommandSourceStack().withPermission(PermissionSet.NO_PERMISSIONS);
		CommandSourceStack player = survivalPlayer(helper).createCommandSourceStack(); // mock player is not an op
		for (CommandSourceStack source : new CommandSourceStack[] {nobody, player}) {
			for (String cmd : new String[] {"enchantaholic off", "enchantaholic status", "enchantaholic"}) {
				try {
					run(helper, source, cmd);
					helper.fail("non-op could run /" + cmd);
				} catch (CommandSyntaxException expected) {
					// unknown command for this source: requires() hides it
				}
			}
		}
		helper.assertTrue(mode(helper), "mode unchanged");
		helper.succeed();
	}

	/** 0.2.0 dropped the game rule: /gamerule must not know it any more (the command replaces it). */
	@GameTest
	public void legacyGameRuleIsGone(GameTestHelper helper) {
		CommandSourceStack op = helper.getLevel().getServer().createCommandSourceStack();
		for (String cmd : new String[] {"gamerule enchantaholic:enchantaholic", "gamerule enchantaholic:enchantaholic true"}) {
			try {
				run(helper, op, cmd);
				helper.fail("/" + cmd + " still works");
			} catch (CommandSyntaxException expected) {
				// unknown game rule
			}
		}
		helper.succeed();
	}

	@GameTest
	public void legacyGameRuleIsRead(GameTestHelper helper) throws Exception {
		Path dir = Files.createTempDirectory("enchantaholic-legacy");
		try {
			Path file = dir.resolve("game_rules.dat");
			helper.assertTrue(!ModeBootstrap.readLegacyRule(file), "missing file -> off");
			for (boolean value : new boolean[] {true, false}) {
				CompoundTag data = new CompoundTag();
				data.putBoolean("minecraft:keep_inventory", true);
				data.putBoolean(ModeBootstrap.LEGACY_RULE_KEY, value);
				CompoundTag root = new CompoundTag();
				root.put("data", data);
				root.putInt("DataVersion", 4000);
				NbtIo.writeCompressed(root, file);
				helper.assertValueEqual(ModeBootstrap.readLegacyRule(file), value, "legacy " + value);
			}
			Files.writeString(file, "not nbt");
			helper.assertTrue(!ModeBootstrap.readLegacyRule(file), "corrupt file -> off, no throw");
		} finally {
			try (var s = Files.list(dir)) { s.forEach(p -> p.toFile().delete()); }
			Files.deleteIfExists(dir);
		}
		helper.succeed();
	}

	private static final int CUSTOM_COUNT = 11;

	@GameTest
	public void customCommandOnOffStatus(GameTestHelper helper) throws CommandSyntaxException {
		MinecraftServer server = helper.getLevel().getServer();
		CommandSourceStack op = server.createCommandSourceStack();
		boolean modeBefore = mode(helper);
		try {
			helper.assertValueEqual(run(helper, op, "enchantaholic custom off"), 0, "off result");
			helper.assertTrue(!custom(helper), "off stored");
			helper.assertValueEqual(run(helper, op, "enchantaholic custom status"), 0, "status off");
			helper.assertValueEqual(run(helper, op, "enchantaholic custom"), 0, "bare custom = status");
			helper.assertValueEqual(run(helper, op, "enchantaholic custom on"), 1, "on result");
			helper.assertTrue(custom(helper), "on stored");
			helper.assertValueEqual(run(helper, op, "enchantaholic custom status"), 1, "status on");
			helper.assertValueEqual(run(helper, op, "enchantaholic custom"), 1, "bare custom on");
			helper.assertTrue(EnchantaholicMode.get(server).isDirty(), "state marked dirty for saving");
			helper.assertValueEqual(mode(helper), modeBefore, "Enchantaholic Mode untouched by /enchantaholic custom");
			try {
				run(helper, op, "enchantaholic custom maybe");
				helper.fail("/enchantaholic custom maybe parsed");
			} catch (CommandSyntaxException expected) {
				// unknown argument
			}
		} finally {
			setCustom(helper, true);
		}
		helper.succeed();
	}

	@GameTest
	public void customCommandNeedsGamemaster(GameTestHelper helper) {
		setCustom(helper, true);
		MinecraftServer server = helper.getLevel().getServer();
		CommandSourceStack nobody = server.createCommandSourceStack().withPermission(PermissionSet.NO_PERMISSIONS);
		CommandSourceStack player = survivalPlayer(helper).createCommandSourceStack(); // mock player is not an op
		for (CommandSourceStack source : new CommandSourceStack[] {nobody, player}) {
			for (String cmd : new String[] {"enchantaholic custom off", "enchantaholic custom status", "enchantaholic custom"}) {
				try {
					run(helper, source, cmd);
					helper.fail("non-op could run /" + cmd);
				} catch (CommandSyntaxException expected) {
					// unknown command for this source: requires() hides it
				}
			}
		}
		helper.assertTrue(custom(helper), "custom switch unchanged");
		helper.succeed();
	}

	@GameTest
	public void customCodecBackwardCompat(GameTestHelper helper) {
		// a 0.2.x mode.dat has no customEnchants field: it reads as OFF
		CompoundTag old = new CompoundTag();
		old.putBoolean("enabled", true);
		EnchantaholicMode parsed = EnchantaholicMode.CODEC.parse(NbtOps.INSTANCE, old).getOrThrow();
		helper.assertTrue(parsed.enabled(), "0.2.x enabled read");
		helper.assertTrue(!parsed.customEnchants(), "0.2.x file -> customs OFF");
		helper.assertTrue(!new EnchantaholicMode().customEnchants(), "new state -> customs OFF");

		for (boolean enabled : new boolean[] {true, false}) {
			for (boolean customs : new boolean[] {true, false}) {
				CompoundTag tag = new CompoundTag();
				tag.putBoolean("enabled", enabled);
				tag.putBoolean("customEnchants", customs);
				EnchantaholicMode state = EnchantaholicMode.CODEC.parse(NbtOps.INSTANCE, tag).getOrThrow();
				helper.assertValueEqual(state.enabled(), enabled, "enabled " + enabled + "/" + customs);
				helper.assertValueEqual(state.customEnchants(), customs, "customs " + enabled + "/" + customs);
				Tag encoded = EnchantaholicMode.CODEC.encodeStart(NbtOps.INSTANCE, state).getOrThrow();
				EnchantaholicMode again = EnchantaholicMode.CODEC.parse(NbtOps.INSTANCE, encoded).getOrThrow();
				helper.assertValueEqual(again.enabled(), enabled, "round trip enabled");
				helper.assertValueEqual(again.customEnchants(), customs, "round trip customs");
			}
		}
		EnchantaholicMode state = new EnchantaholicMode();
		state.setCustomEnchants(true);
		helper.assertTrue(state.isDirty(), "setCustomEnchants marks dirty on change");
		helper.succeed();
	}

	/** The Create World handoff: the server's storage access carries both button values into onServerStarting. */
	@GameTest
	public void pendingCustomHandoff(GameTestHelper helper) {
		MinecraftServer server = helper.getLevel().getServer();
		PendingWorldMode access = (PendingWorldMode) ((MinecraftServerAccessor) server).enchantaholic$getStorageSource();
		boolean modeBefore = mode(helper);
		try {
			// nothing pending: take returns null
			helper.assertTrue(access.enchantaholic$takePendingCustom() == null, "nothing pending on a running server");

			// take clears
			access.enchantaholic$setPendingCustom(true);
			helper.assertValueEqual(access.enchantaholic$takePendingCustom(), Boolean.TRUE, "take returns the value");
			helper.assertTrue(access.enchantaholic$takePendingCustom() == null, "take clears the value");

			// new world, both buttons: mode and customs applied, nothing left pending
			access.enchantaholic$setPendingMode(modeBefore);
			access.enchantaholic$setPendingCustom(true);
			setCustom(helper, false);
			ModeBootstrap.onServerStarting(server);
			helper.assertTrue(custom(helper), "pending customs ON applied");
			helper.assertValueEqual(mode(helper), modeBefore, "pending mode applied");
			helper.assertTrue(access.enchantaholic$takePendingMode() == null && access.enchantaholic$takePendingCustom() == null,
					"both pending values consumed");

			// new world, custom button left OFF
			access.enchantaholic$setPendingMode(modeBefore);
			access.enchantaholic$setPendingCustom(false);
			ModeBootstrap.onServerStarting(server);
			helper.assertTrue(!custom(helper), "pending customs OFF applied");

			// pending mode without a custom value (defensive): customs OFF
			setCustom(helper, true);
			access.enchantaholic$setPendingMode(modeBefore);
			ModeBootstrap.onServerStarting(server);
			helper.assertTrue(!custom(helper), "no pending custom value -> OFF for a new world");

			// existing world (no pending mode): a stray custom value is dropped, the stored value is authoritative
			setCustom(helper, false);
			access.enchantaholic$setPendingCustom(true);
			ModeBootstrap.onServerStarting(server);
			helper.assertTrue(!custom(helper), "stray pending custom not applied to an existing world");
			helper.assertTrue(access.enchantaholic$takePendingCustom() == null, "stray pending custom consumed anyway");
		} finally {
			access.enchantaholic$takePendingMode();
			access.enchantaholic$takePendingCustom();
			setMode(helper, modeBefore);
			setCustom(helper, true);
		}
		helper.succeed();
	}

	@GameTest
	public void poolExcludesCustomsWhenOff(GameTestHelper helper) {
		List<Holder<Enchantment>> all = allEnchantments(helper);
		long customsInRegistry = all.stream().filter(CustomEnchants::isCustom).count();
		helper.assertValueEqual((int) customsInRegistry, CUSTOM_COUNT, "custom enchantments in the registry");
		ServerPlayer player = survivalPlayer(helper);
		try {
			setCustom(helper, false);
			List<Holder<Enchantment>> off = ItemEnchanter.rollPool(helper.getLevel());
			helper.assertTrue(off.stream().noneMatch(CustomEnchants::isCustom), "OFF pool has a custom enchantment");
			helper.assertValueEqual(off.size(), all.size() - CUSTOM_COUNT, "OFF pool = vanilla");

			// 200 rolls with mode ON, customs OFF: a dirt stack never gets a custom one
			setMode(helper, true);
			ItemStack dirt = new ItemStack(Items.DIRT);
			player.getInventory().setItem(0, dirt);
			breakBlocks(helper, player, Blocks.STONE, 200);
			ItemStack after = player.getInventory().getItem(0);
			helper.assertTrue(after.is(Items.DIRT), "dirt stayed in slot 0");
			helper.assertTrue(totalLevels(after) >= 200, "200 breaks rolled (got " + totalLevels(after) + " levels)");
			for (var e : after.getOrDefault(ItemEnchanter.componentFor(after), ItemEnchantments.EMPTY).entrySet()) {
				helper.assertTrue(!CustomEnchants.isCustom(e.getKey()), "custom enchantment rolled while OFF: " + e.getKey());
			}

			setCustom(helper, true);
			List<Holder<Enchantment>> on = ItemEnchanter.rollPool(helper.getLevel());
			helper.assertValueEqual(on.size(), all.size(), "ON pool = whole registry");
			helper.assertValueEqual((int) on.stream().filter(CustomEnchants::isCustom).count(), CUSTOM_COUNT, "ON pool has all 11");
		} finally {
			setCustom(helper, true);
			player.discard();
		}
		helper.succeed();
	}

	/** Customs ON, every vanilla enchantment maxed: the roll can only pick a custom one. */
	@GameTest
	public void customsRollWhenOn(GameTestHelper helper) {
		setCustom(helper, true);
		ServerPlayer player = survivalPlayer(helper);
		ItemStack stick = new ItemStack(Items.STICK);
		for (Holder<Enchantment> e : allEnchantments(helper)) {
			if (!CustomEnchants.isCustom(e)) setLevel(stick, e, 255);
		}
		player.getInventory().setItem(0, stick);
		RandomSource random = RandomSource.create(42);
		for (int i = 0; i < 20; i++) {
			// enchantRandom directly (not a block break), so a freshly rolled effect can't act on this test
			Optional<ItemEnchanter.Result> result = ItemEnchanter.enchantRandom(player, random);
			helper.assertTrue(result.isPresent(), "roll " + i + " found nothing");
			helper.assertTrue(CustomEnchants.isCustom(result.get().enchantment()), "roll " + i + " was not custom: " + result.get().enchantment());
			helper.assertValueEqual(result.get().slot(), 0, "slot");
		}
		long customLevels = 0;
		for (var e : stick.getOrDefault(ItemEnchanter.componentFor(stick), ItemEnchantments.EMPTY).entrySet()) {
			if (CustomEnchants.isCustom(e.getKey())) customLevels += e.getIntValue();
		}
		helper.assertValueEqual((int) customLevels, 20, "custom levels on the stick");
		player.discard();
		helper.succeed();
	}
}
