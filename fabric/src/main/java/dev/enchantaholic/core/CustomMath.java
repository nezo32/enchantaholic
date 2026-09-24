package dev.enchantaholic.core;

/**
 * Pure per-level numbers and hard safety caps of the custom enchantment effects. Every function
 * accepts any int level (&lt;= 0 means "not enchanted") and never exceeds its documented cap.
 */
public final class CustomMath {
	public static final int VEIN_MINER_CAP = 1024;
	public static final int BARRAGE_CAP = 512;
	public static final float KABOOM_POWER_CAP = 8.0F;
	/** Kaboom explosions per server tick (whole server); further impacts that tick fizzle. */
	public static final int KABOOM_PER_TICK = 64;
	/** Kaboom explosion work per server tick (whole server), 20 ms; further impacts that tick fizzle. */
	public static final long KABOOM_NANOS_PER_TICK = 20_000_000L;
	public static final double YEET_VERTICAL_CAP = 3.0;
	public static final double YEET_HORIZONTAL_CAP = 3.0;
	public static final int PARTY_POPPER_CAP = 16;
	public static final double MAGNET_RADIUS_CAP = 24.0;
	/** Entities moved per player per magnet pulse. */
	public static final int MAGNET_ENTITY_CAP = 256;
	public static final int MOON_BOOTS_AMPLIFIER_CAP = 10;
	public static final int BUTTERFINGERS_PERCENT_CAP = 50;
	public static final int HICCUPS_PERCENT_CAP = 60;
	/** Server ticks between magnet / moon boots pulses and between hiccup rolls. */
	public static final int PULSE_TICKS = 10;
	public static final int HICCUP_TICKS = 200;

	private CustomMath() {}

	/** Extra blocks: 8×L, cap 1024. */
	public static int veinMinerExtra(int level) {
		return level <= 0 ? 0 : (int) Math.min(8L * level, VEIN_MINER_CAP);
	}

	/** Extra projectiles per shot: 10×L, cap 512. */
	public static int barrageCopies(int level) {
		return level <= 0 ? 0 : (int) Math.min(10L * level, BARRAGE_CAP);
	}

	/** Explosion power 1 + 0.5×L, cap 8; 0 if not enchanted. */
	public static float kaboomPower(int level) {
		return level <= 0 ? 0.0F : Math.min(1.0F + 0.5F * level, KABOOM_POWER_CAP);
	}

	/** Upward velocity (blocks/tick): 0.5 + 0.3×L, cap 3. */
	public static double yeetVertical(int level) {
		return level <= 0 ? 0.0 : Math.min(0.5 + 0.3 * level, YEET_VERTICAL_CAP);
	}

	/** Horizontal velocity away from the attacker: 0.4 + 0.2×L, cap 3. */
	public static double yeetHorizontal(int level) {
		return level <= 0 ? 0.0 : Math.min(0.4 + 0.2 * level, YEET_HORIZONTAL_CAP);
	}

	/** Fireworks per kill: L, cap 16. */
	public static int partyPopperFireworks(int level) {
		return Math.max(0, Math.min(level, PARTY_POPPER_CAP));
	}

	/** Percent chance of a chicken per break: 5×L, cap 100. */
	public static int chickenRainPercent(int level) {
		return level <= 0 ? 0 : (int) Math.min(5L * level, 100);
	}

	/** Percent chance of a gold nugget per break: 3×L, cap 100. */
	public static int midasNuggetPercent(int level) {
		return level <= 0 ? 0 : (int) Math.min(3L * level, 100);
	}

	/** Percent chance that the drop is a gold ingot instead of a nugget: 0 below L34, then 3×L − 99 (L34 = 3 %), cap 100. */
	public static int midasIngotPercent(int level) {
		return level < 34 ? 0 : (int) Math.min(3L * level - 99, 100);
	}

	/** Pull radius 3 + L, cap 24. */
	public static double magnetRadius(int level) {
		return level <= 0 ? 0.0 : Math.min(3.0 + level, MAGNET_RADIUS_CAP);
	}

	/** Jump Boost amplifier (0 = Jump Boost I) for level L: L − 1, cap 10; −1 if not enchanted. */
	public static int moonBootsAmplifier(int level) {
		return level <= 0 ? -1 : Math.min(level - 1, MOON_BOOTS_AMPLIFIER_CAP);
	}

	/** Percent chance to drop the held item per hit/break: 2×L, cap 50. */
	public static int butterfingersPercent(int level) {
		return level <= 0 ? 0 : (int) Math.min(2L * level, BUTTERFINGERS_PERCENT_CAP);
	}

	/** Percent chance of a hiccup per 200-tick roll: 3×L, cap 60. */
	public static int hiccupsPercent(int level) {
		return level <= 0 ? 0 : (int) Math.min(3L * level, HICCUPS_PERCENT_CAP);
	}

	/** true with probability percent/100, given a uniform draw in [0,100). */
	public static boolean roll(int percent, int draw0to99) {
		return draw0to99 < percent;
	}
}
