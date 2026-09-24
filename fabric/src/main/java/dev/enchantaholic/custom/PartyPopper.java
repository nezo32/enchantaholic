package dev.enchantaholic.custom;

import java.util.List;

import dev.enchantaholic.core.CustomMath;
import it.unimi.dsi.fastutil.ints.IntList;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.RandomSource;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.FireworkRocketEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.FireworkExplosion;
import net.minecraft.world.item.component.Fireworks;

/** Party Popper: killing a mob sets off L (cap 16) harmless firework bursts plus confetti at the body. */
public final class PartyPopper {
	/** Entity tag of the rockets; their explosion damage is cancelled in {@link #allowDamage}. */
	public static final String TAG = "enchantaholic.party_popper";

	private PartyPopper() {}

	static void onKill(ServerPlayer killer, LivingEntity victim) {
		int n = CustomMath.partyPopperFireworks(CustomEnchants.mainHand(killer, CustomEnchants.PARTY_POPPER));
		if (n == 0 || !(victim.level() instanceof ServerLevel level)) return;
		RandomSource r = level.getRandom();
		CustomEffects.guarded(() -> {
			for (int i = 0; i < n; i++) {
				ItemStack rocket = new ItemStack(Items.FIREWORK_ROCKET);
				FireworkExplosion.Shape shape = FireworkExplosion.Shape.values()[r.nextInt(FireworkExplosion.Shape.values().length)];
				rocket.set(DataComponents.FIREWORKS, new Fireworks(0, List.of(new FireworkExplosion(shape,
						IntList.of(r.nextInt(0xFFFFFF), r.nextInt(0xFFFFFF)), IntList.of(r.nextInt(0xFFFFFF)), r.nextBoolean(), r.nextBoolean()))));
				FireworkRocketEntity entity = new FireworkRocketEntity(level, victim.getX() + r.nextGaussian() * 0.5,
						victim.getY() + victim.getBbHeight(), victim.getZ() + r.nextGaussian() * 0.5, rocket);
				entity.addTag(TAG);
				level.addFreshEntity(entity);
			}
		});
		level.sendParticles(ParticleTypes.HAPPY_VILLAGER, victim.getX(), victim.getY() + victim.getBbHeight() / 2, victim.getZ(), 20, 0.6, 0.6, 0.6, 0.1);
		level.sendParticles(ParticleTypes.TOTEM_OF_UNDYING, victim.getX(), victim.getY() + victim.getBbHeight() / 2, victim.getZ(), 30, 0.4, 0.4, 0.4, 0.5);
		level.playSound(null, victim.getX(), victim.getY(), victim.getZ(), SoundEvents.FIREWORK_ROCKET_TWINKLE, SoundSource.PLAYERS, 1.0F, 1.0F);
	}

	/** Party Popper rockets never hurt anyone. */
	static boolean allowDamage(DamageSource source) {
		return source.getDirectEntity() == null || !source.getDirectEntity().entityTags().contains(TAG);
	}
}
