package dev.enchantaholic;

import java.util.concurrent.atomic.AtomicBoolean;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/** Glue between PlayerBlockBreakEvents.AFTER and the enchanting logic. */
public final class BlockBreakHandler {
	private static final AtomicBoolean LOGGED_FAILURE = new AtomicBoolean();

	private BlockBreakHandler() {}

	/** PlayerBlockBreakEvents.After signature. {@code blockEntity} may be null. */
	public static void onAfterBreak(Level level, Player player, BlockPos pos, BlockState state, BlockEntity blockEntity) {
		if (!(level instanceof ServerLevel server) || !(player instanceof ServerPlayer serverPlayer)) return;
		if (!shouldTrigger(server, serverPlayer, state)) return;
		try {
			ItemEnchanter.enchantRandom(serverPlayer, server.getRandom())
					.ifPresent(result -> Feedback.send(serverPlayer, result));
		} catch (RuntimeException e) {
			// never let a misbehaving (e.g. datapack) enchantment crash the server tick
			if (LOGGED_FAILURE.compareAndSet(false, true)) {
				Enchantaholic.LOGGER.error("Enchantaholic failed to enchant an item; further failures are logged at debug level", e);
			} else {
				Enchantaholic.LOGGER.debug("Enchantaholic failed to enchant an item", e);
			}
		}
	}

	/** Rule on, player neither creative nor spectator, and the block is not instant-break. */
	public static boolean shouldTrigger(ServerLevel level, Player player, BlockState state) {
		if (!level.getGameRules().get(Enchantaholic.ENCHANTAHOLIC)) return false;
		GameType mode = gameModeOf(player);
		if (mode.isCreative() || mode == GameType.SPECTATOR) return false;
		return countsAsNonInstabreak(state);
	}

	/**
	 * The server-authoritative game mode. {@code Player.isCreative()/isSpectator()} go through
	 * {@code Player.gameMode()}, which gametest mock players hard-wire to CREATIVE, so a ServerPlayer
	 * is asked through its ServerPlayerGameMode instead.
	 */
	private static GameType gameModeOf(Player player) {
		return player instanceof ServerPlayer serverPlayer
				? serverPlayer.gameMode.getGameModeForPlayer()
				: player.gameMode();
	}

	/** Hardness of the block's default state is not 0 (bedrock's -1 counts). */
	public static boolean countsAsNonInstabreak(BlockState state) {
		return state.getBlock().defaultDestroyTime() != 0.0F;
	}
}
