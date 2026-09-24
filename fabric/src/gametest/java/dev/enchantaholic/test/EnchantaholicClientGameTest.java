package dev.enchantaholic.test;

import java.nio.file.Files;
import java.nio.file.Path;

import dev.enchantaholic.client.CreateWorldModeHolder;
import dev.enchantaholic.mode.EnchantaholicMode;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.minecraft.client.gui.screens.GenericMessageScreen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.worldselection.CreateWorldScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.level.storage.LevelResource;

/**
 * Client gametest (not part of {@code build}; run with {@code ./gradlew runClientGameTest} under Xvfb).
 * World 1: toggle the Create World "Game" tab button to ON, create, assert the world's saved mode is ON
 * (in memory and in data/enchantaholic/mode.dat after saving). World 2: leave the button alone, create,
 * assert OFF (the first world's choice must not leak).
 */
public class EnchantaholicClientGameTest implements FabricClientGameTest {
	private static final String TOGGLE = "enchantaholic.createWorld.toggle";

	@Override
	public void runTest(ClientGameTestContext ctx) {
		// world 1: toggle ON
		openCreateWorld(ctx);
		boolean initial = uiMode(ctx);
		ctx.clickScreenButton(TOGGLE);
		boolean afterFirst = uiMode(ctx);
		ctx.takeScreenshot("create_world_game_tab");
		ctx.clickScreenButton(TOGGLE);
		boolean afterSecond = uiMode(ctx);
		ctx.clickScreenButton(TOGGLE);
		boolean afterThird = uiMode(ctx);
		if (initial || !afterFirst || afterSecond || !afterThird) {
			throw new AssertionError("toggle failed: initial=" + initial + " first=" + afterFirst
					+ " second=" + afterSecond + " third=" + afterThird);
		}
		Path world1 = createWorldAndAssert(ctx, true);
		if (!Files.isRegularFile(world1.resolve("data/enchantaholic/mode.dat"))) {
			throw new AssertionError("mode.dat not saved in " + world1);
		}

		// world 2: default OFF, no leak from world 1
		openCreateWorld(ctx);
		if (uiMode(ctx)) throw new AssertionError("fresh Create World screen starts ON");
		Path world2 = createWorldAndAssert(ctx, false);
		if (world1.equals(world2)) throw new AssertionError("same world folder twice: " + world1);

		ctx.setScreen(TitleScreen::new);
		System.out.println("ENCHANTAHOLIC_CLIENT_TEST_OK world1=" + world1.getFileName() + " world2=" + world2.getFileName());
	}

	private static void openCreateWorld(ClientGameTestContext ctx) {
		ctx.runOnClient(mc -> CreateWorldScreen.openFresh(mc, () -> {}));
		ctx.waitForScreen(CreateWorldScreen.class);
	}

	/** Creates the world, checks the saved mode on the server thread, leaves, and returns the world folder. */
	private static Path createWorldAndAssert(ClientGameTestContext ctx, boolean expected) {
		ctx.clickScreenButton("selectWorld.create");
		ctx.waitFor(mc -> mc.getSingleplayerServer() != null && mc.player != null, 20 * 60);
		// not server.submit(..).join(): the client-gametest framework holds the server thread while the test thread runs
		boolean actual = ctx.computeOnClient(mc -> EnchantaholicMode.isEnabled(mc.getSingleplayerServer()));
		Path worldDir = ctx.computeOnClient(mc -> mc.getSingleplayerServer().getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize());
		if (actual != expected) throw new AssertionError("world " + worldDir + ": mode " + actual + ", expected " + expected);
		// leave the world, otherwise the client-gametest framework fails ("finished while a server is still running")
		ctx.runOnClient(mc -> {
			mc.level.disconnect(Component.translatable("menu.savingLevel"));
			mc.disconnect(new GenericMessageScreen(Component.translatable("menu.savingLevel")), false);
		});
		ctx.waitFor(mc -> mc.level == null && mc.getSingleplayerServer() == null, 20 * 60);
		ctx.waitTicks(20);
		return worldDir;
	}

	private static boolean uiMode(ClientGameTestContext ctx) {
		return ctx.computeOnClient(mc -> ((CreateWorldModeHolder) mc.gui.screen()).enchantaholic$isModeEnabled());
	}
}
