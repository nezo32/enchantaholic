package dev.enchantaholic.core;

/** Pure enchantment level math. */
public final class Levels {
	/** Hard cap of vanilla ItemEnchantments (its codec accepts levels 1..255). */
	public static final int MAX_LEVEL = 255;

	private Levels() {}

	/** Level after one more application: absent (current &lt;= 0) becomes 1, otherwise +1, capped at {@link #MAX_LEVEL}. */
	public static int next(int current) {
		if (current <= 0) return 1;
		return Math.min(MAX_LEVEL, current + 1);
	}

	/** True iff another application would raise the level (absent/0 counts as increasable). */
	public static boolean canIncrease(int current) {
		return current < MAX_LEVEL;
	}
}
