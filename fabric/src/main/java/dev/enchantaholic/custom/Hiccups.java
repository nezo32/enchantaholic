package dev.enchantaholic.custom;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.phys.Vec3;

/** Curse of Hiccups (anywhere in slots 0..40): every 200 ticks, 3×L % (cap 60 %) chance of a small involuntary hop. */
public final class Hiccups {
	public static final double HOP_VELOCITY = 0.42;

	private Hiccups() {}

	static void roll(ServerPlayer player) {
		int percent = CustomMath.hiccupsPercent(CustomEnchants.inventory(player, CustomEnchants.HICCUPS));
		if (!CustomMath.roll(percent, player.getRandom().nextInt(100))) return;
		hiccup(player);
	}

	public static void hiccup(ServerPlayer player) {
		Vec3 v = player.getDeltaMovement();
		Motion.set(player, new Vec3(v.x, Math.max(v.y, 0) + HOP_VELOCITY, v.z));
		ServerLevel level = player.level();
		level.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.PLAYER_BURP, SoundSource.PLAYERS, 0.8F, 1.6F);
		level.sendParticles(ParticleTypes.POOF, player.getX(), player.getEyeY() - 0.2, player.getZ(), 4, 0.1, 0.1, 0.1, 0.01);
	}
}
