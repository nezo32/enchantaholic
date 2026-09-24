package dev.enchantaholic.custom;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.ExperienceOrb;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

/** Magnet (held or worn): every 10 ticks pulls item drops and XP orbs within 3 + L (cap 24) blocks toward the player. */
public final class Magnet {
	private Magnet() {}

	static void pulse(ServerPlayer player) {
		int lvl = Math.max(CustomEnchants.hands(player, CustomEnchants.MAGNET), CustomEnchants.armor(player, CustomEnchants.MAGNET));
		double radius = CustomMath.magnetRadius(lvl);
		if (radius <= 0) return;
		AABB box = player.getBoundingBox().inflate(radius);
		Vec3 target = player.position().add(0, player.getBbHeight() / 2, 0);
		int[] budget = {CustomMath.MAGNET_ENTITY_CAP};
		for (Entity e : player.level().getEntities(player, box, e -> e instanceof ItemEntity || e instanceof ExperienceOrb)) {
			if (budget[0]-- <= 0) break;
			Vec3 d = target.subtract(e.position());
			double dist = d.length();
			if (dist < 1.0 || dist > radius) continue;
			Motion.set(e, d.scale(Math.min(0.8, 0.2 + dist * 0.05) / dist));
		}
	}
}
