package dev.enchantaholic.custom;

import java.util.ArrayList;
import java.util.List;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.phys.Vec3;

/**
 * Yeet: a melee hit launches the target up (0.5 + 0.3×L, cap 3) and away (0.4 + 0.2×L, cap 3).
 *
 * <p>The damage event fires inside the hit, before vanilla's extra knockback (Knockback enchantment, sprint hit),
 * which would flatten the launch of a target standing on the ground. The launch is therefore applied right away
 * and applied again when the attack returns ({@link #afterAttack}).
 */
public final class Yeet {
	private record Launch(LivingEntity target, Vec3 velocity) {}

	/** Launches of the attack in progress. Server thread only. */
	private static final List<Launch> PENDING = new ArrayList<>();

	private Yeet() {}

	static void onMeleeHit(ServerPlayer attacker, LivingEntity target) {
		int lvl = CustomEnchants.mainHand(attacker, CustomEnchants.YEET);
		if (lvl <= 0 || !target.isAlive()) return;
		Vec3 away = target.position().subtract(attacker.position()).multiply(1, 0, 1);
		if (away.lengthSqr() < 1.0E-4) away = attacker.getLookAngle().multiply(1, 0, 1);
		away = away.lengthSqr() < 1.0E-4 ? Vec3.ZERO : away.normalize();
		double h = CustomMath.yeetHorizontal(lvl);
		Vec3 velocity = new Vec3(away.x * h, CustomMath.yeetVertical(lvl), away.z * h);
		Motion.set(target, velocity);
		PENDING.add(new Launch(target, velocity));
	}

	/** Player#attack (RETURN) on the server: re-applies this attack's launches after vanilla's extra knockback. */
	public static void afterAttack(ServerPlayer attacker) {
		if (PENDING.isEmpty()) return;
		List<Launch> launches = List.copyOf(PENDING);
		PENDING.clear();
		CustomEffects.safely("yeet", () -> {
			for (Launch l : launches) if (l.target().isAlive()) Motion.set(l.target(), l.velocity());
		});
	}

	/** END_SERVER_TICK: launches never outlive the tick (e.g. a hit that did not come from Player#attack). */
	static void clear() {
		PENDING.clear();
	}
}
