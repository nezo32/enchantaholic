package dev.enchantaholic.custom;

import dev.enchantaholic.core.CustomMath;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.tags.DamageTypeTags;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;

/** Moon Boots (worn, any armor slot): Jump Boost L (amplifier cap 10) and no fall damage. */
public final class MoonBoots {
	/** Refreshed every 10 ticks; lapses within 1.5 s after the boots come off or the switch goes off. */
	public static final int EFFECT_TICKS = 30;

	private MoonBoots() {}

	static void pulse(ServerPlayer player) {
		int amplifier = CustomMath.moonBootsAmplifier(CustomEnchants.armor(player, CustomEnchants.MOON_BOOTS));
		if (amplifier < 0) return;
		// ambient, no particles, icon shown
		player.addEffect(new MobEffectInstance(MobEffects.JUMP_BOOST, EFFECT_TICKS, amplifier, true, false, true));
	}

	/** false = cancel: fall damage to anyone wearing Moon Boots. */
	static boolean allowDamage(LivingEntity entity, DamageSource source) {
		return !(source.is(DamageTypeTags.IS_FALL) && CustomEnchants.armor(entity, CustomEnchants.MOON_BOOTS) > 0);
	}
}
