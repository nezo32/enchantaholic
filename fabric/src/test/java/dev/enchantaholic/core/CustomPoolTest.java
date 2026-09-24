package dev.enchantaholic.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.function.Predicate;

import org.junit.jupiter.api.Test;

class CustomPoolTest {
	private static final Predicate<String> CUSTOM = s -> s.startsWith("enchantaholic:");

	private static final List<String> MIXED = List.of(
			"minecraft:sharpness", "enchantaholic:vein_miner", "minecraft:mending",
			"enchantaholic:hiccups", "enchantaholic:barrage", "minecraft:lunge");

	@Test
	void enabledReturnsTheSameList() {
		assertSame(MIXED, CustomPool.filter(MIXED, CUSTOM, true));
	}

	@Test
	void disabledDropsCustomsAndKeepsOrder() {
		assertEquals(List.of("minecraft:sharpness", "minecraft:mending", "minecraft:lunge"), CustomPool.filter(MIXED, CUSTOM, false));
		assertEquals(6, MIXED.size(), "input untouched");
	}

	@Test
	void disabledWithoutCustomsKeepsEverything() {
		List<String> vanilla = List.of("minecraft:a", "minecraft:b");
		assertEquals(vanilla, CustomPool.filter(vanilla, CUSTOM, false));
	}

	@Test
	void allCustomDisabledIsEmpty() {
		assertTrue(CustomPool.filter(List.of("enchantaholic:yeet", "enchantaholic:kaboom"), CUSTOM, false).isEmpty());
		assertEquals(List.of("enchantaholic:yeet"), CustomPool.filter(List.of("enchantaholic:yeet"), CUSTOM, true));
	}

	@Test
	void emptyInput() {
		assertTrue(CustomPool.filter(List.<String>of(), CUSTOM, false).isEmpty());
		assertTrue(CustomPool.filter(List.<String>of(), CUSTOM, true).isEmpty());
	}
}
