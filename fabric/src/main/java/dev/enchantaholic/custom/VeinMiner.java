package dev.enchantaholic.custom;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

import dev.enchantaholic.core.CustomMath;
import it.unimi.dsi.fastutil.longs.LongOpenHashSet;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Vein Miner: also breaks up to 8×L (cap 1024) connected blocks (26-neighbourhood) of the broken block's type,
 * {@link #BLOCKS_PER_TICK} per server tick (the first batch right away, in the break event).
 */
public final class VeinMiner {
	public static final int BLOCKS_PER_TICK = 64;
	private static final List<Job> JOBS = new ArrayList<>();

	private record Job(ServerLevel level, ServerPlayer player, ItemStack tool, Block block, ArrayDeque<BlockPos> targets) {
		/** Breaks up to BLOCKS_PER_TICK blocks; true when finished. */
		boolean step() {
			int budget = BLOCKS_PER_TICK;
			while (budget > 0 && !targets.isEmpty()) {
				// stop when the tool broke, was dropped (Butterfingers) or swapped, or the player left/died/changed dimension
				if (player.isRemoved() || !player.isAlive() || player.level() != level || player.getMainHandItem() != tool || tool.isEmpty()) return true;
				BlockPos pos = targets.poll();
				if (!level.getBlockState(pos).is(block)) continue;
				player.gameMode.destroyBlock(pos); // survival path: tool durability, drops (Fortune/Silk Touch), stats, protection events
				budget--;
			}
			return targets.isEmpty();
		}
	}

	private VeinMiner() {}

	static void onBlockBreak(ServerLevel level, ServerPlayer player, BlockPos origin, BlockState state) {
		ItemStack tool = player.getMainHandItem();
		int extra = CustomMath.veinMinerExtra(CustomEnchants.level(tool, CustomEnchants.VEIN_MINER));
		if (extra == 0 || state.getDestroySpeed(level, origin) < 0) return;
		for (Job job : JOBS) if (job.player() == player) return; // one vein at a time per player
		Job job = new Job(level, player, tool, state.getBlock(), new ArrayDeque<>(collect(level, origin, state.getBlock(), extra)));
		boolean[] done = {false};
		CustomEffects.guarded(() -> done[0] = job.step());
		if (!done[0]) JOBS.add(job);
	}

	/** END_SERVER_TICK, before the switch check: pending veins stop when the switch is off. */
	static void tick(boolean enabled) {
		if (JOBS.isEmpty()) return;
		if (!enabled) {
			JOBS.clear();
			return;
		}
		CustomEffects.guarded(() -> JOBS.removeIf(Job::step));
	}

	/** Pending veins (tests). */
	public static int pendingJobs() {
		return JOBS.size();
	}

	/** SERVER_STOPPED: drop references to the old server's players and levels. */
	static void clear() {
		JOBS.clear();
	}

	/** BFS in the 26-neighbourhood over loaded blocks of {@code block}, nearest first, at most {@code max} positions, origin excluded. */
	public static List<BlockPos> collect(ServerLevel level, BlockPos origin, Block block, int max) {
		List<BlockPos> result = new ArrayList<>(Math.min(max, 64));
		LongOpenHashSet seen = new LongOpenHashSet();
		ArrayDeque<BlockPos> queue = new ArrayDeque<>();
		seen.add(origin.asLong());
		queue.add(origin);
		while (!queue.isEmpty() && result.size() < max) {
			BlockPos current = queue.poll();
			for (int dx = -1; dx <= 1 && result.size() < max; dx++) {
				for (int dy = -1; dy <= 1 && result.size() < max; dy++) {
					for (int dz = -1; dz <= 1 && result.size() < max; dz++) {
						if (dx == 0 && dy == 0 && dz == 0) continue;
						BlockPos n = current.offset(dx, dy, dz);
						if (!seen.add(n.asLong()) || !level.isLoaded(n)) continue;
						BlockState s = level.getBlockState(n);
						if (!s.is(block) || s.getDestroySpeed(level, n) < 0) continue;
						result.add(n);
						queue.add(n);
					}
				}
			}
		}
		return result;
	}
}
