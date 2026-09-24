package dev.enchantaholic.custom;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Block;

/** Midas Touch: 3×L % chance per break to drop a gold nugget; from level 34 that drop is sometimes an ingot. */
public final class MidasTouch {
	private MidasTouch() {}

	static void onBlockBreak(ServerLevel level, ServerPlayer player, BlockPos pos) {
		int lvl = CustomEnchants.mainHand(player, CustomEnchants.MIDAS_TOUCH);
		if (!CustomMath.roll(CustomMath.midasNuggetPercent(lvl), level.getRandom().nextInt(100))) return;
		boolean ingot = CustomMath.roll(CustomMath.midasIngotPercent(lvl), level.getRandom().nextInt(100));
		Block.popResource(level, pos, new ItemStack(ingot ? Items.GOLD_INGOT : Items.GOLD_NUGGET));
	}
}
