package dev.enchantaholic.test;

import dev.enchantaholic.Enchantaholic;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.minecraft.client.gui.screens.GenericMessageScreen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.worldselection.CreateWorldScreen;
import net.minecraft.network.chat.Component;

/**
 * Client gametest (not part of {@code build}; run with {@code ./gradlew runClientGameTest} under Xvfb).
 * Toggles the Create World "Game" tab button and checks that the created world has the rule on.
 */
public class EnchantaholicClientGameTest implements FabricClientGameTest {
	private static final String TOGGLE = "enchantaholic.createWorld.toggle";

	@Override
	public void runTest(ClientGameTestContext ctx) {
		ctx.runOnClient(mc -> CreateWorldScreen.openFresh(mc, () -> {}));
		ctx.waitForScreen(CreateWorldScreen.class);

		boolean initial = uiRule(ctx);
		ctx.clickScreenButton(TOGGLE);
		boolean afterFirst = uiRule(ctx);
		ctx.takeScreenshot("create_world_game_tab");
		ctx.clickScreenButton(TOGGLE);
		boolean afterSecond = uiRule(ctx);
		ctx.clickScreenButton(TOGGLE);
		boolean afterThird = uiRule(ctx);
		if (initial || !afterFirst || afterSecond || !afterThird) {
			throw new AssertionError("toggle failed: initial=" + initial + " first=" + afterFirst
					+ " second=" + afterSecond + " third=" + afterThird);
		}

		ctx.clickScreenButton("selectWorld.create");
		ctx.waitFor(mc -> mc.getSingleplayerServer() != null && mc.player != null, 20 * 60);
		boolean onServer = ctx.computeOnClient(mc -> mc.getSingleplayerServer().overworld().getGameRules().get(Enchantaholic.ENCHANTAHOLIC));
		if (!onServer) throw new AssertionError("rule not applied to created world");

		// leave the world, otherwise the client-gametest framework fails ("finished while a server is still running")
		ctx.runOnClient(mc -> {
			mc.level.disconnect(Component.translatable("menu.savingLevel"));
			mc.disconnect(new GenericMessageScreen(Component.translatable("menu.savingLevel")), false);
		});
		ctx.waitFor(mc -> mc.level == null && mc.getSingleplayerServer() == null, 20 * 60);
		ctx.waitTicks(20);
		ctx.setScreen(TitleScreen::new);
		System.out.println("ENCHANTAHOLIC_CLIENT_TEST_OK initial=" + initial + " first=" + afterFirst
				+ " second=" + afterSecond + " third=" + afterThird + " server=" + onServer);
	}

	private static boolean uiRule(ClientGameTestContext ctx) {
		return ctx.computeOnClient(mc -> ((CreateWorldScreen) mc.gui.screen()).getUiState().getGameRules().get(Enchantaholic.ENCHANTAHOLIC));
	}
}
