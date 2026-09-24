package dev.enchantaholic.custom;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.item.ItemStack;

/** Curse of Butterfingers: on a melee hit or block break, 2×L % (cap 50 %) chance to drop the held item. */
public final class Butterfingers {
	private Butterfingers() {}

	static void onAction(ServerPlayer player) {
		ItemStack held = player.getMainHandItem();
		int percent = CustomMath.butterfingersPercent(CustomEnchants.level(held, CustomEnchants.BUTTERFINGERS));
		if (!CustomMath.roll(percent, player.getRandom().nextInt(100))) return;
		player.setItemInHand(InteractionHand.MAIN_HAND, ItemStack.EMPTY);
		// not Player#drop: its signature differs between 26.2 and 26.3
		ItemEntity item = new ItemEntity(player.level(), player.getX(), player.getEyeY() - 0.3, player.getZ(), held);
		item.setPickUpDelay(40);
		item.setThrower(player);
		item.setDeltaMovement(player.getLookAngle().scale(0.3).add(0, 0.1, 0));
		player.level().addFreshEntity(item);
		player.containerMenu.broadcastChanges();
	}
}
