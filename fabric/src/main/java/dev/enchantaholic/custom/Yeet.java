package dev.enchantaholic.custom;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.phys.Vec3;

/** Yeet: a melee hit launches the target up (0.5 + 0.3×L, cap 3) and away (0.4 + 0.2×L, cap 3). */
public final class Yeet {
	private Yeet() {}

	static void onMeleeHit(ServerPlayer attacker, LivingEntity target) {
		int lvl = CustomEnchants.mainHand(attacker, CustomEnchants.YEET);
		if (lvl <= 0 || !target.isAlive()) return;
		Vec3 away = target.position().subtract(attacker.position()).multiply(1, 0, 1);
		if (away.lengthSqr() < 1.0E-4) away = attacker.getLookAngle().multiply(1, 0, 1);
		away = away.lengthSqr() < 1.0E-4 ? Vec3.ZERO : away.normalize();
		double h = CustomMath.yeetHorizontal(lvl);
		Motion.set(target, new Vec3(away.x * h, CustomMath.yeetVertical(lvl), away.z * h));
	}
}
