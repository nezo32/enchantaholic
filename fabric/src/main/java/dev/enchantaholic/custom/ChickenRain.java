package dev.enchantaholic.custom;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.animal.chicken.Chicken;

/** Chicken Rain: 5×L % (cap 100 %) chance per break to spawn one chicken (half of them babies) at the block. */
public final class ChickenRain {
	private ChickenRain() {}

	static void onBlockBreak(ServerLevel level, ServerPlayer player, BlockPos pos) {
		int percent = CustomMath.chickenRainPercent(CustomEnchants.mainHand(player, CustomEnchants.CHICKEN_RAIN));
		if (!CustomMath.roll(percent, level.getRandom().nextInt(100))) return;
		Chicken chicken = EntityTypes.CHICKEN.create(level, EntitySpawnReason.TRIGGERED);
		if (chicken == null) return;
		chicken.snapTo(pos.getX() + 0.5, pos.getY(), pos.getZ() + 0.5, level.getRandom().nextFloat() * 360.0F, 0.0F);
		if (level.getRandom().nextBoolean()) chicken.setBaby(true);
		CustomEffects.guarded(() -> level.addFreshEntity(chicken));
	}
}
