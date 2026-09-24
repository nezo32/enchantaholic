package dev.enchantaholic.core;

import java.util.List;
import java.util.function.Predicate;

/** Pure: which enchantments may be rolled, given the per-world Custom Enchantments switch. */
public final class CustomPool {
	private CustomPool() {}

	/** customsEnabled: all (same list instance). Otherwise a new list without the custom ones, order kept. */
	public static <E> List<E> filter(List<E> all, Predicate<E> isCustom, boolean customsEnabled) {
		if (customsEnabled) return all;
		return all.stream().filter(isCustom.negate()).toList();
	}
}
