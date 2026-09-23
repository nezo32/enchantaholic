package dev.enchantaholic.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class LevelsTest {
	@Test
	void next() {
		assertEquals(1, Levels.next(0));
		assertEquals(1, Levels.next(-3));
		assertEquals(2, Levels.next(1));
		assertEquals(255, Levels.next(254));
		assertEquals(255, Levels.next(255));
	}

	@Test
	void canIncrease() {
		assertTrue(Levels.canIncrease(0));
		assertTrue(Levels.canIncrease(254));
		assertFalse(Levels.canIncrease(255));
		assertEquals(255, Levels.MAX_LEVEL);
	}
}
