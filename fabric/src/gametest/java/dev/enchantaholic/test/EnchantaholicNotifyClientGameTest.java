package dev.enchantaholic.test;

import java.lang.reflect.Field;

import dev.enchantaholic.Feedback;
import dev.enchantaholic.ItemEnchanter;
import dev.enchantaholic.client.NotifyConfig;
import dev.enchantaholic.client.NotifySettingsScreen;
import dev.enchantaholic.core.NotifySettings;
import dev.enchantaholic.net.EnchantedPayload;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestSingleplayerContext;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Hud;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.enchantment.Enchantments;

/**
 * Client gametest for the notification settings (run with {@code ./gradlew runClientGameTest} under Xvfb).
 * <ol>
 * <li>The settings screen: each ON/OFF click updates {@link NotifyConfig} and writes {@code config/enchantaholic.json}.</li>
 * <li>In a singleplayer world the {@code enchantaholic:enchanted} channel is negotiated, so the server takes the
 *     payload path.</li>
 * <li>With "Enchant message" OFF the actionbar is left alone; with it ON the message appears.</li>
 * </ol>
 * The sound branch is not asserted: there is no test seam worth adding for it, and it mirrors the message branch in
 * {@link dev.enchantaholic.client.NotifyClient#handle}.
 */
public class EnchantaholicNotifyClientGameTest implements FabricClientGameTest {
	private static final String SOUND = "enchantaholic.settings.notifySound";
	private static final String MESSAGE = "enchantaholic.settings.notifyMessage";
	private static final String SENTINEL = "sentinel";

	@Override
	public void runTest(ClientGameTestContext ctx) {
		NotifySettings original = NotifyConfig.get();
		try {
			settingsScreen(ctx);
			inWorld(ctx);
		} finally {
			NotifyConfig.set(original);
		}
		System.out.println("ENCHANTAHOLIC_NOTIFY_CLIENT_TEST_OK");
	}

	private static void settingsScreen(ClientGameTestContext ctx) {
		NotifyConfig.set(NotifySettings.DEFAULT);
		ctx.setScreen(() -> new NotifySettingsScreen(new TitleScreen()));
		ctx.waitForScreen(NotifySettingsScreen.class);

		ctx.clickScreenButton(SOUND);
		if (NotifyConfig.get().sound()) throw new AssertionError("sound still ON in memory after click");
		expectSaved(new NotifySettings(false, true), "after sound click");
		ctx.clickScreenButton(MESSAGE);
		expectSaved(new NotifySettings(false, false), "after message click");
		ctx.clickScreenButton(SOUND);
		ctx.clickScreenButton(MESSAGE);
		expectSaved(new NotifySettings(true, true), "after clicking both again");

		ctx.takeScreenshot("notify_settings");
		ctx.clickScreenButton("gui.done");
		ctx.waitForScreen(TitleScreen.class);
	}

	private static void expectSaved(NotifySettings expected, String what) {
		if (!NotifyConfig.get().equals(expected)) throw new AssertionError(what + ": memory " + NotifyConfig.get());
		NotifySettings onDisk = NotifySettings.load(NotifyConfig.path());
		if (!onDisk.equals(expected)) throw new AssertionError(what + ": file " + onDisk + ", expected " + expected);
	}

	private static void inWorld(ClientGameTestContext ctx) {
		try (TestSingleplayerContext sp = ctx.worldBuilder().create()) {
			ctx.waitFor(mc -> mc.player != null, 20 * 60);
			// channel registration is exchanged right after join: give it a moment, then it must be there
			// (polled from the test thread: computeOnServer must not be called from inside a client-thread predicate)
			boolean negotiated = false;
			for (int i = 0; i < 20 * 10 && !negotiated; i++) {
				negotiated = sp.getServer().computeOnServer(EnchantaholicNotifyClientGameTest::canSend);
				if (!negotiated) ctx.waitTick();
			}
			if (!negotiated) {
				throw new AssertionError("server cannot send enchantaholic:enchanted to the modded client");
			}

			// message OFF: the actionbar is untouched
			NotifyConfig.set(new NotifySettings(true, false));
			setSentinel(ctx);
			sendFeedback(sp);
			ctx.waitTicks(5);
			String off = ctx.computeOnClient(EnchantaholicNotifyClientGameTest::overlay);
			if (!SENTINEL.equals(off)) throw new AssertionError("message OFF but the overlay changed to: " + off);

			// message ON (defaults): today's message appears
			NotifyConfig.set(NotifySettings.DEFAULT);
			setSentinel(ctx);
			sendFeedback(sp);
			ctx.waitFor(mc -> !SENTINEL.equals(overlay(mc)), 20 * 5);
			String on = ctx.computeOnClient(EnchantaholicNotifyClientGameTest::overlay);
			if (!on.contains("Stick") || !on.contains("Sharpness III")) throw new AssertionError("unexpected overlay: " + on);
		}
	}

	private static boolean canSend(MinecraftServer s) {
		var players = s.getPlayerList().getPlayers();
		return !players.isEmpty() && ServerPlayNetworking.canSend(players.get(0), EnchantedPayload.TYPE);
	}

	private static void setSentinel(ClientGameTestContext ctx) {
		ctx.runOnClient(mc -> mc.gui.hud.setOverlayMessage(Component.literal(SENTINEL), false));
	}

	private static void sendFeedback(TestSingleplayerContext sp) {
		sp.getServer().runOnServer(s -> {
			var sharpness = s.registryAccess().lookupOrThrow(Registries.ENCHANTMENT).getOrThrow(Enchantments.SHARPNESS);
			Feedback.send(s.getPlayerList().getPlayers().get(0), new ItemEnchanter.Result(0, new ItemStack(Items.STICK), sharpness, 3));
		});
	}

	/** The private Hud.overlayMessageString (Mojang names at runtime on 26.x). */
	private static String overlay(Minecraft mc) {
		try {
			Field f = Hud.class.getDeclaredField("overlayMessageString");
			f.setAccessible(true);
			Component c = (Component) f.get(mc.gui.hud);
			return c == null ? null : c.getString();
		} catch (ReflectiveOperationException e) {
			throw new AssertionError("cannot read Hud.overlayMessageString", e);
		}
	}
}
