package dev.enchantaholic.test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import dev.enchantaholic.client.CreateWorldModeHolder;
import dev.enchantaholic.mode.EnchantaholicMode;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.GenericMessageScreen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.worldselection.CreateWorldScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.gui.screens.worldselection.WorldSelectionList;
import net.minecraft.network.chat.Component;
import net.minecraft.world.level.storage.LevelResource;

/**
 * Client gametest (not part of {@code build}; run with {@code ./gradlew runClientGameTest} under Xvfb).
 * <ol>
 * <li>World 1 (cheats on): toggle the Create World "Game" tab button to ON, create, assert the saved mode is ON
 *     (in memory and in data/enchantaholic/mode.dat), then flip it with /enchantaholic off|on as the host.</li>
 * <li>Cancel: open Create World, toggle ON, Cancel. Nothing may leak into the next world.</li>
 * <li>World 2 (cheats off): leave the button alone, create, assert OFF; the host is not an op, so the command is
 *     not in the client command tree and sending it changes nothing.</li>
 * <li>Re-Create world 1 from the world list: the button starts OFF (not copied), toggled ON, new world is ON.</li>
 * <li>Re-open world 1 and world 2: mode.dat is read back (ON / OFF), no pending value is applied.</li>
 * </ol>
 */
public class EnchantaholicClientGameTest implements FabricClientGameTest {
	private static final String TOGGLE = "enchantaholic.createWorld.toggle";

	@Override
	public void runTest(ClientGameTestContext ctx) {
		// 1. world 1: toggle ON, cheats on
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
		ctx.runOnClient(mc -> ((CreateWorldScreen) mc.gui.screen()).getUiState().setAllowCommands(true));
		Path world1 = createWorld(ctx);
		assertMode(ctx, true, "world 1 after create");
		if (!Files.isRegularFile(world1.resolve("data/enchantaholic/mode.dat"))) {
			throw new AssertionError("mode.dat not written right after creating " + world1);
		}
		if (!hasClientCommand(ctx)) throw new AssertionError("host with cheats on does not see /enchantaholic");
		sendCommand(ctx, "enchantaholic off");
		waitForMode(ctx, false, "world 1 after /enchantaholic off");
		sendCommand(ctx, "enchantaholic on");
		waitForMode(ctx, true, "world 1 after /enchantaholic on");
		leaveWorld(ctx);

		// 2. Cancel after toggling ON must not leak
		ctx.runOnClient(mc -> CreateWorldScreen.openFresh(mc, () -> mc.gui.setScreen(new TitleScreen())));
		ctx.waitForScreen(CreateWorldScreen.class);
		ctx.clickScreenButton(TOGGLE);
		if (!uiMode(ctx)) throw new AssertionError("toggle before cancel did not turn ON");
		ctx.clickScreenButton("gui.cancel");
		ctx.waitForScreen(TitleScreen.class);

		// 3. world 2: default OFF, cheats off (host is not an op)
		openCreateWorld(ctx);
		if (uiMode(ctx)) throw new AssertionError("fresh Create World screen starts ON");
		Path world2 = createWorld(ctx);
		assertMode(ctx, false, "world 2 after create");
		if (world1.equals(world2)) throw new AssertionError("same world folder twice: " + world1);
		if (hasClientCommand(ctx)) throw new AssertionError("non-op host (cheats off) sees /enchantaholic");
		sendCommand(ctx, "enchantaholic on");
		ctx.waitTicks(20);
		assertMode(ctx, false, "world 2 after non-op /enchantaholic on");
		leaveWorld(ctx);

		// 4. Re-Create world 1: the button is not copied from the old world, and the handoff works on this path
		openWorldList(ctx);
		ctx.runOnClient(mc -> worldEntry(mc, world1).recreateWorld());
		ctx.waitForScreen(CreateWorldScreen.class);
		if (uiMode(ctx)) throw new AssertionError("Re-Create screen starts ON (copied from the old world?)");
		ctx.clickScreenButton(TOGGLE);
		Path world3 = createWorld(ctx);
		assertMode(ctx, true, "re-created world");
		if (world3.equals(world1) || world3.equals(world2)) throw new AssertionError("re-create reused " + world3);
		leaveWorld(ctx);

		// 5. re-open existing worlds: the stored value is read back, nothing pending
		joinWorld(ctx, world1);
		assertMode(ctx, true, "world 1 re-opened");
		leaveWorld(ctx);
		joinWorld(ctx, world2);
		assertMode(ctx, false, "world 2 re-opened");
		leaveWorld(ctx);

		ctx.setScreen(TitleScreen::new);
		System.out.println("ENCHANTAHOLIC_CLIENT_TEST_OK world1=" + world1.getFileName() + " world2=" + world2.getFileName()
				+ " recreated=" + world3.getFileName());
	}

	private static void openCreateWorld(ClientGameTestContext ctx) {
		ctx.runOnClient(mc -> CreateWorldScreen.openFresh(mc, () -> {}));
		ctx.waitForScreen(CreateWorldScreen.class);
	}

	/** Clicks Create, waits until the player is in the world and returns the world folder. */
	private static Path createWorld(ClientGameTestContext ctx) {
		ctx.clickScreenButton("selectWorld.create");
		return waitInWorld(ctx);
	}

	private static Path waitInWorld(ClientGameTestContext ctx) {
		ctx.waitFor(mc -> mc.getSingleplayerServer() != null && mc.player != null, 20 * 60);
		return ctx.computeOnClient(mc -> mc.getSingleplayerServer().getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize());
	}

	// not server.submit(..).join(): the client-gametest framework holds the server thread while the test thread runs
	private static boolean serverMode(ClientGameTestContext ctx) {
		return ctx.computeOnClient(mc -> EnchantaholicMode.isEnabled(mc.getSingleplayerServer()));
	}

	private static void assertMode(ClientGameTestContext ctx, boolean expected, String what) {
		boolean actual = serverMode(ctx);
		if (actual != expected) throw new AssertionError(what + ": mode " + actual + ", expected " + expected);
	}

	private static void waitForMode(ClientGameTestContext ctx, boolean expected, String what) {
		try {
			ctx.waitFor(mc -> EnchantaholicMode.isEnabled(mc.getSingleplayerServer()) == expected, 100);
		} catch (RuntimeException | AssertionError e) {
			throw new AssertionError(what + ": mode never became " + expected, e);
		}
	}

	private static void sendCommand(ClientGameTestContext ctx, String command) {
		ctx.runOnClient(mc -> mc.player.connection.sendCommand(command));
	}

	/** The command tree packet arrives asynchronously after the player spawns: wait for it (/help is level 0). */
	private static boolean hasClientCommand(ClientGameTestContext ctx) {
		ctx.waitFor(mc -> mc.player.connection.getCommands().getRoot().getChild("help") != null, 20 * 10);
		return ctx.computeOnClient(mc -> mc.player.connection.getCommands().getRoot().getChild("enchantaholic") != null);
	}

	/** Leaves the world; otherwise the client-gametest framework fails ("finished while a server is still running"). */
	private static void leaveWorld(ClientGameTestContext ctx) {
		ctx.runOnClient(mc -> {
			mc.level.disconnect(Component.translatable("menu.savingLevel"));
			mc.disconnect(new GenericMessageScreen(Component.translatable("menu.savingLevel")), false);
		});
		ctx.waitFor(mc -> mc.level == null && mc.getSingleplayerServer() == null, 20 * 60);
		ctx.setScreen(TitleScreen::new);
		ctx.waitTicks(20);
	}

	private static void openWorldList(ClientGameTestContext ctx) {
		ctx.setScreen(() -> new SelectWorldScreen(new TitleScreen()));
		ctx.waitFor(mc -> worldList(mc).map(l -> !l.children().isEmpty()
				&& l.children().stream().anyMatch(e -> e instanceof WorldSelectionList.WorldListEntry)).orElse(false), 20 * 30);
	}

	private static void joinWorld(ClientGameTestContext ctx, Path world) {
		openWorldList(ctx);
		ctx.runOnClient(mc -> worldEntry(mc, world).joinWorld());
		Path joined = waitInWorld(ctx);
		if (!joined.equals(world)) throw new AssertionError("joined " + joined + " instead of " + world);
	}

	private static Optional<WorldSelectionList> worldList(Minecraft mc) {
		if (!(mc.gui.screen() instanceof SelectWorldScreen screen)) return Optional.empty();
		return screen.children().stream().filter(c -> c instanceof WorldSelectionList).map(c -> (WorldSelectionList) c).findFirst();
	}

	private static WorldSelectionList.WorldListEntry worldEntry(Minecraft mc, Path world) {
		String id = world.getFileName().toString();
		return worldList(mc).orElseThrow().children().stream()
				.filter(e -> e instanceof WorldSelectionList.WorldListEntry)
				.map(e -> (WorldSelectionList.WorldListEntry) e)
				.filter(e -> e.getLevelSummary().getLevelId().equals(id))
				.findFirst().orElseThrow(() -> new AssertionError("world " + id + " not in the world list"));
	}

	private static boolean uiMode(ClientGameTestContext ctx) {
		return ctx.computeOnClient(mc -> ((CreateWorldModeHolder) mc.gui.screen()).enchantaholic$isModeEnabled());
	}
}
