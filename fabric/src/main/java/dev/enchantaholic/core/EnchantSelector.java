package dev.enchantaholic.core;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

/**
 * Pure selection logic: pick a random candidate slot, then a random enchantment from that slot's pool.
 * Slots whose pool is empty are dropped and the pick is retried among the remaining slots.
 */
public final class EnchantSelector {
	private EnchantSelector() {}

	/** A non-empty candidate slot, as seen by the selector. E = enchantment handle type. */
	public interface SlotView<E> {
		boolean isSpear();

		/** Current level of e on this stack (0 if absent). */
		int level(E enchantment);

		/** True if e may not be added to this stack at all (e.g. Fortune when it already has Silk Touch). */
		default boolean excludes(E enchantment) {
			return false;
		}
	}

	public record Pick<S, E>(S slot, E enchantment, int newLevel) {}

	/**
	 * Enchantments allowed on this slot: drop lunge-like (isLunge) unless slot.isSpear(); drop any at MAX_LEVEL;
	 * drop any the slot excludes. Preserves input order.
	 */
	public static <E> List<E> pool(SlotView<E> slot, List<E> enchantments, Predicate<E> isLunge) {
		boolean spear = slot.isSpear();
		List<E> result = new ArrayList<>(enchantments.size());
		for (E e : enchantments) {
			if (!spear && isLunge.test(e)) continue;
			if (!Levels.canIncrease(slot.level(e))) continue;
			if (slot.excludes(e)) continue;
			result.add(e);
		}
		return result;
	}

	/**
	 * Chooses a slot and an enchantment. Per attempt: one slot draw, then one enchantment draw.
	 * Does not mutate {@code slots}; never calls {@code random.nextInt} with a bound &lt;= 0.
	 */
	public static <S extends SlotView<E>, E> Optional<Pick<S, E>> choose(
			List<S> slots, List<E> enchantments, Predicate<E> isLunge, RandomIndex random) {
		List<S> remaining = new ArrayList<>(slots);
		while (!remaining.isEmpty()) {
			S slot = remaining.remove(random.nextInt(remaining.size()));
			List<E> p = pool(slot, enchantments, isLunge);
			if (p.isEmpty()) continue;
			E e = p.get(random.nextInt(p.size()));
			return Optional.of(new Pick<>(slot, e, Levels.next(slot.level(e))));
		}
		return Optional.empty();
	}
}
