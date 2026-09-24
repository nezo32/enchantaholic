package dev.enchantaholic.custom;

import dev.enchantaholic.Enchantaholic;
import net.fabricmc.fabric.api.entity.FakePlayer;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Registers the event hooks of all custom enchantment effects and dispatches to one class per
 * enchantment. Everything is gated by the per-world Custom Enchantments switch and runs on the server thread.
 */
public final class CustomEffects {
	/** &gt; 0 while an effect is breaking blocks / spawning entities. Server thread only. */
	private static int depth;

	private CustomEffects() {}

	public static void register() {
		PlayerBlockBreakEvents.AFTER.register(CustomEffects::onBlockBreak);
		ServerLivingEntityEvents.AFTER_DAMAGE.register(CustomEffects::afterDamage);
		ServerLivingEntityEvents.ALLOW_DAMAGE.register(CustomEffects::allowDamage);
		ServerLivingEntityEvents.AFTER_DEATH.register(CustomEffects::afterDeath);
		ServerTickEvents.END_SERVER_TICK.register(CustomEffects::endServerTick);
		ServerLifecycleEvents.SERVER_STOPPED.register(server -> VeinMiner.clear());
	}

	/** True while a custom effect is running: its block breaks must not roll enchantments or re-trigger effects. */
	public static boolean inEffect() {
		return depth > 0;
	}

	/** Runs {@code action} with {@link #inEffect()} true. Re-entrant. */
	public static void guarded(Runnable action) {
		depth++;
		try {
			action.run();
		} finally {
			depth--;
		}
	}

	/** A real (non-fake) server player in a world with the switch on, outside of any effect. */
	static boolean active(Player player) {
		return player instanceof ServerPlayer && !(player instanceof FakePlayer) && !inEffect()
				&& CustomEnchants.enabled(player.level());
	}

	private static void onBlockBreak(Level level, Player player, BlockPos pos, BlockState state, BlockEntity blockEntity) {
		if (!(level instanceof ServerLevel server) || !active(player)) return;
		ServerPlayer p = (ServerPlayer) player;
		safely("block break", () -> {
			VeinMiner.onBlockBreak(server, p, pos, state);
			ChickenRain.onBlockBreak(server, p, pos);
			MidasTouch.onBlockBreak(server, p, pos);
			Butterfingers.onAction(p); // last: may take the tool out of the hand
		});
	}

	private static void afterDamage(LivingEntity entity, DamageSource source, float baseDamage, float damageTaken, boolean blocked) {
		if (blocked || !(source.getEntity() instanceof ServerPlayer p) || source.getDirectEntity() != p || !active(p)) return;
		safely("melee hit", () -> {
			Yeet.onMeleeHit(p, entity);
			Butterfingers.onAction(p);
		});
	}

	private static boolean allowDamage(LivingEntity entity, DamageSource source, float amount) {
		if (!CustomEnchants.enabled(entity.level())) return true;
		return MoonBoots.allowDamage(entity, source) && PartyPopper.allowDamage(source);
	}

	private static void afterDeath(LivingEntity entity, DamageSource source) {
		if (!(source.getEntity() instanceof ServerPlayer p) || p == entity || !active(p)) return;
		safely("kill", () -> PartyPopper.onKill(p, entity));
	}

	private static void endServerTick(MinecraftServer server) {
		Kaboom.resetBudget();
		boolean enabled = CustomEnchants.enabled(server);
		safely("vein miner", () -> VeinMiner.tick(enabled));
		if (!enabled) return;
		int tick = server.getTickCount();
		safely("tick", () -> {
			for (ServerPlayer p : server.getPlayerList().getPlayers()) {
				if (p.isSpectator() || !p.isAlive()) continue;
				int phase = tick + p.getId();
				if (phase % dev.enchantaholic.core.CustomMath.PULSE_TICKS == 0) {
					Magnet.pulse(p);
					MoonBoots.pulse(p);
				}
				if (phase % dev.enchantaholic.core.CustomMath.HICCUP_TICKS == 0) Hiccups.roll(p);
			}
		});
	}

	private static boolean loggedFailure;

	/** Effects must never crash the server tick; the first failure is logged at error level. */
	static void safely(String what, Runnable action) {
		try {
			action.run();
		} catch (RuntimeException e) {
			if (!loggedFailure) {
				loggedFailure = true;
				Enchantaholic.LOGGER.error("Enchantaholic custom enchantment effect failed ({}); further failures are logged at debug level", what, e);
			} else {
				Enchantaholic.LOGGER.debug("Enchantaholic custom enchantment effect failed ({})", what, e);
			}
		}
	}
}
