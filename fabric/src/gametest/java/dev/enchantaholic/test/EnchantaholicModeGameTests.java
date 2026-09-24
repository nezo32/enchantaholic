package dev.enchantaholic.test;

import static dev.enchantaholic.test.TestSupport.mode;
import static dev.enchantaholic.test.TestSupport.setMode;
import static dev.enchantaholic.test.TestSupport.survivalPlayer;

import java.nio.file.Files;
import java.nio.file.Path;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import dev.enchantaholic.mode.EnchantaholicMode;
import dev.enchantaholic.mode.ModeBootstrap;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.NbtIo;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.permissions.PermissionSet;

/** /enchantaholic command, per-world saved state and the v0.1.0 game rule migration. */
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
}
