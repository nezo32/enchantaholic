package dev.enchantaholic.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.function.Predicate;

import dev.enchantaholic.core.EnchantSelector.Pick;
import dev.enchantaholic.core.EnchantSelector.SlotView;
import org.junit.jupiter.api.Test;

class EnchantSelectorTest {
	record FakeSlot(String name, boolean isSpear, Map<String, Integer> levels) implements SlotView<String> {
		static FakeSlot fresh(String name) {
			return new FakeSlot(name, false, Map.of());
		}

		@Override
		public int level(String enchantment) {
			return levels.getOrDefault(enchantment, 0);
		}
	}

	private static final Predicate<String> IS_LUNGE = "lunge"::equals;
	private static final List<String> ABC = List.of("a", "b", "c");

	/** Returns the scripted values in order and fails on any extra or out-of-range call. */
	private static RandomIndex scripted(int... values) {
		Deque<Integer> queue = new ArrayDeque<>();
		for (int v : values) queue.add(v);
		return bound -> {
			assertTrue(bound > 0, "bound must be > 0, was " + bound);
			Integer v = queue.poll();
			if (v == null) fail("unexpected extra random draw (bound " + bound + ")");
			assertTrue(v < bound, "scripted value " + v + " out of bound " + bound);
			return v;
		};
	}

	/** java.util.Random wrapper that asserts the bound is positive. */
	private static RandomIndex checked(Random random) {
		return bound -> {
			assertTrue(bound > 0, "bound must be > 0, was " + bound);
			return random.nextInt(bound);
		};
	}

	private static Map<String, Integer> allAt(int level, List<String> enchantments) {
		Map<String, Integer> map = new HashMap<>();
		for (String e : enchantments) map.put(e, level);
		return map;
	}

	@Test
	void emptySlotListNeverDrawsRandom() {
		RandomIndex throwing = bound -> {
			throw new AssertionError("random must not be called");
		};
		assertEquals(Optional.empty(), EnchantSelector.choose(List.<FakeSlot>of(), ABC, IS_LUNGE, throwing));
	}

	@Test
	void singleSlotScriptedPick() {
		FakeSlot slot = FakeSlot.fresh("s");
		Pick<FakeSlot, String> pick = EnchantSelector.choose(List.of(slot), ABC, IS_LUNGE, scripted(0, 2)).orElseThrow();
		assertEquals(slot, pick.slot());
		assertEquals("c", pick.enchantment());
		assertEquals(1, pick.newLevel());
	}

	@Test
	void existingLevelsIncrease() {
		FakeSlot four = new FakeSlot("s", false, Map.of("a", 4));
		assertEquals(5, EnchantSelector.choose(List.of(four), List.of("a"), IS_LUNGE, scripted(0, 0)).orElseThrow().newLevel());
		FakeSlot almost = new FakeSlot("s", false, Map.of("a", 254));
		assertEquals(255, EnchantSelector.choose(List.of(almost), List.of("a"), IS_LUNGE, scripted(0, 0)).orElseThrow().newLevel());
	}

	@Test
	void poolLungeOnlyOnSpear() {
		List<String> all = List.of("a", "lunge", "b");
		assertEquals(List.of("a", "b"), EnchantSelector.pool(FakeSlot.fresh("stick"), all, IS_LUNGE));
		assertEquals(all, EnchantSelector.pool(new FakeSlot("spear", true, Map.of()), all, IS_LUNGE));
	}

	@Test
	void poolDropsWhatTheSlotExcludes() {
		SlotView<String> silky = new SlotView<>() {
			@Override
			public boolean isSpear() {
				return false;
			}

			@Override
			public int level(String enchantment) {
				return "silk_touch".equals(enchantment) ? 1 : 0;
			}

			@Override
			public boolean excludes(String enchantment) {
				return "fortune".equals(enchantment);
			}
		};
		List<String> all = List.of("fortune", "silk_touch", "efficiency");
		assertEquals(List.of("silk_touch", "efficiency"), EnchantSelector.pool(silky, all, IS_LUNGE));
		assertEquals(all, EnchantSelector.pool(FakeSlot.fresh("plain"), all, IS_LUNGE), "default excludes nothing");
	}

	@Test
	void poolExcludesMaxedAndKeepsOrder() {
		List<String> all = List.of("d", "a", "c", "b", "e");
		FakeSlot slot = new FakeSlot("s", false, Map.of("a", 255, "b", 254, "e", 255));
		assertEquals(List.of("d", "c", "b"), EnchantSelector.pool(slot, all, IS_LUNGE));
	}

	@Test
	void retriesOtherSlotWhenPoolEmpty() {
		FakeSlot maxed = new FakeSlot("A", false, allAt(255, ABC));
		FakeSlot fresh = FakeSlot.fresh("B");
		List<FakeSlot> slots = List.of(maxed, fresh);
		// draw A (0 of 2), its pool is empty -> draw index 0 of remaining [B] -> enchant index 1
		Pick<FakeSlot, String> pick = EnchantSelector.choose(slots, ABC, IS_LUNGE, scripted(0, 0, 1)).orElseThrow();
		assertEquals(fresh, pick.slot());
		assertEquals("b", pick.enchantment());
		assertEquals(1, pick.newLevel());

		for (int seed = 0; seed < 1000; seed++) {
			var result = EnchantSelector.choose(slots, ABC, IS_LUNGE, checked(new Random(seed))).orElseThrow();
			assertEquals(fresh, result.slot(), "seed " + seed);
		}
	}

	@Test
	void allMaxedOrOnlyLungeGivesEmpty() {
		List<FakeSlot> slots = List.of(new FakeSlot("A", false, allAt(255, ABC)), new FakeSlot("B", false, allAt(255, ABC)));
		for (int seed = 0; seed < 50; seed++) {
			assertEquals(Optional.empty(), EnchantSelector.choose(slots, ABC, IS_LUNGE, checked(new Random(seed))));
		}
		assertEquals(Optional.empty(),
				EnchantSelector.choose(List.of(FakeSlot.fresh("stick")), List.of("lunge"), IS_LUNGE, checked(new Random(1))));
	}

	@Test
	void spearWithEverythingElseMaxedGetsLunge() {
		List<String> all = List.of("a", "lunge", "b", "c");
		FakeSlot spear = new FakeSlot("spear", true, allAt(255, ABC));
		for (int seed = 0; seed < 50; seed++) {
			Pick<FakeSlot, String> pick = EnchantSelector.choose(List.of(spear), all, IS_LUNGE, checked(new Random(seed))).orElseThrow();
			assertEquals("lunge", pick.enchantment());
			assertEquals(1, pick.newLevel());
		}
	}

	@Test
	void uniformOverSlotsAndEnchantments() {
		List<FakeSlot> slots = List.of(FakeSlot.fresh("A"), FakeSlot.fresh("B"), FakeSlot.fresh("C"));
		List<String> enchantments = List.of("w", "x", "y", "z");
		Map<String, Integer> slotCounts = new HashMap<>();
		Map<String, Integer> enchCounts = new HashMap<>();
		RandomIndex random = checked(new Random(42));
		int draws = 30_000;
		for (int i = 0; i < draws; i++) {
			Pick<FakeSlot, String> pick = EnchantSelector.choose(slots, enchantments, IS_LUNGE, random).orElseThrow();
			slotCounts.merge(pick.slot().name(), 1, Integer::sum);
			enchCounts.merge(pick.enchantment(), 1, Integer::sum);
		}
		for (FakeSlot s : slots) {
			double share = slotCounts.getOrDefault(s.name(), 0) / (double) draws;
			assertTrue(Math.abs(share - 1.0 / 3) <= 0.02, "slot " + s.name() + " share " + share);
		}
		for (String e : enchantments) {
			double share = enchCounts.getOrDefault(e, 0) / (double) draws;
			assertTrue(Math.abs(share - 0.25) <= 0.02, "enchant " + e + " share " + share);
		}
	}

	@Test
	void doesNotMutateInputs() {
		List<FakeSlot> slots = new ArrayList<>(List.of(new FakeSlot("A", false, allAt(255, ABC)), FakeSlot.fresh("B"), FakeSlot.fresh("C")));
		List<String> enchantments = new ArrayList<>(List.of("a", "b", "c", "lunge"));
		List<FakeSlot> slotsBefore = List.copyOf(slots);
		List<String> enchBefore = List.copyOf(enchantments);
		Random random = new Random(7);
		for (int i = 0; i < 500; i++) {
			EnchantSelector.choose(slots, enchantments, IS_LUNGE, checked(random));
		}
		assertEquals(slotsBefore, slots);
		assertEquals(enchBefore, enchantments);
	}
}
