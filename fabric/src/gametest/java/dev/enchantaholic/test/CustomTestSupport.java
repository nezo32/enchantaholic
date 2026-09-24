package dev.enchantaholic.test;

import dev.enchantaholic.mode.EnchantaholicMode;
import java.util.List;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

/**
 * Helpers for the custom enchantment gametests.
 *
 * <p>Shared-switch rule (spec §6.1): the Custom Enchantments switch is server-global and gametests run in parallel.
 * Every effect test turns it ON at its start and never leaves it OFF; a test that needs it OFF does synchronous work
 * only, inside {@link #withCustomsOff}, which restores ON in {@code finally}.
 */
public final class CustomTestSupport {
	private CustomTestSupport() {}

	public static MinecraftServer server(GameTestHelper h) {
		return h.getLevel().getServer();
	}

	public static void customsOn(GameTestHelper h) {
		EnchantaholicMode.setCustomEnchants(server(h), true);
	}

	/** Runs {@code body} synchronously with the switch OFF, then turns it back ON (even if {@code body} throws). */
	public static void withCustomsOff(GameTestHelper h, Runnable body) {
		EnchantaholicMode.setCustomEnchants(server(h), false);
		try {
			body.run();
		} finally {
			EnchantaholicMode.setCustomEnchants(server(h), true);
		}
	}

	/**
	 * Runs {@code body} synchronously with Enchantaholic Mode OFF (so breaks by this test roll nothing onto its items),
	 * then restores the previous mode.
	 */
	public static void withModeOff(GameTestHelper h, Runnable body) {
		boolean previous = EnchantaholicMode.isEnabled(server(h));
		EnchantaholicMode.set(server(h), false);
		try {
			body.run();
		} finally {
			EnchantaholicMode.set(server(h), previous);
		}
	}

	/** {@code stack} with {@code key} set to exactly {@code level}; returns the same stack. */
	public static ItemStack ench(GameTestHelper h, ItemStack stack, ResourceKey<Enchantment> key, int level) {
		TestSupport.setLevel(stack, h.getLevel().registryAccess().lookupOrThrow(Registries.ENCHANTMENT).getOrThrow(key), level);
		return stack;
	}

	public static ItemStack ench(GameTestHelper h, Item item, ResourceKey<Enchantment> key, int level) {
		return ench(h, new ItemStack(item), key, level);
	}

	/**
	 * Absolute position {@code dy} blocks above the test structure's origin. World-space tests work up there so they
	 * can't touch neighbouring tests (spec §6.1).
	 */
	public static BlockPos sky(GameTestHelper h, int dy) {
		return h.absolutePos(new BlockPos(0, dy, 0));
	}

	/** Survival mock player at {@code pos} (absolute) looking at yaw/pitch. */
	public static ServerPlayer player(GameTestHelper h, Vec3 pos, float yaw, float pitch) {
		ServerPlayer p = TestSupport.survivalPlayer(h);
		p.snapTo(pos.x, pos.y, pos.z, yaw, pitch);
		p.setYHeadRot(yaw);
		p.setDeltaMovement(Vec3.ZERO);
		return p;
	}

	/** Empties the player's inventory, clears effects and removes it from the level (no leftover Magnet/Hiccups holder). */
	public static void cleanup(ServerPlayer p) {
		p.getInventory().clearContent();
		p.removeAllEffects();
		p.discard();
	}

	public static void fill(ServerLevel level, BlockPos from, BlockPos to, BlockState state) {
		for (BlockPos pos : BlockPos.betweenClosed(from, to)) level.setBlockAndUpdate(pos, state);
	}

	public static void clear(ServerLevel level, BlockPos from, BlockPos to) {
		fill(level, from, to, Blocks.AIR.defaultBlockState());
	}

	public static int count(ServerLevel level, BlockPos from, BlockPos to, Block block) {
		int n = 0;
		for (BlockPos pos : BlockPos.betweenClosed(from, to)) if (level.getBlockState(pos).is(block)) n++;
		return n;
	}

	public static <T extends Entity> List<T> entities(GameTestHelper h, Class<T> type, AABB box) {
		return h.getLevel().getEntitiesOfClass(type, box, e -> !e.isRemoved());
	}

	public static void discardAll(GameTestHelper h, Class<? extends Entity> type, AABB box) {
		h.getLevel().getEntitiesOfClass(type, box).forEach(Entity::discard);
	}

	/** A still mob (no AI) at {@code pos} (absolute), already added to the level. */
	public static <T extends Mob> T mob(GameTestHelper h, EntityType<T> type, Vec3 pos) {
		T mob = type.create(h.getLevel(), EntitySpawnReason.TRIGGERED);
		if (mob == null) throw new IllegalStateException("could not create " + type);
		mob.snapTo(pos.x, pos.y, pos.z, 0.0F, 0.0F);
		mob.setNoAi(true);
		mob.setPersistenceRequired();
		h.getLevel().addFreshEntity(mob);
		return mob;
	}

	/**
	 * A server tick number at which {@code p} gets every periodic effect at once in
	 * {@link dev.enchantaholic.custom.CustomEffects#tickPlayer}: Magnet and Moon Boots pulse and Hiccups rolls.
	 */
	public static int allPulsesTick(ServerPlayer p) {
		return Math.floorMod(-p.getId(), 200) + 200;
	}
}
