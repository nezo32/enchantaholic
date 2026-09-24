package dev.enchantaholic.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** Per-level numbers and hard caps of the custom enchantment effects (spec §4.3). */
class CustomMathTest {
	private static final double EPS = 1.0E-9;
	private static final int MAX = Integer.MAX_VALUE;

	@Test
	void veinMiner() {
		assertEquals(0, CustomMath.veinMinerExtra(0));
		assertEquals(0, CustomMath.veinMinerExtra(-1));
		assertEquals(0, CustomMath.veinMinerExtra(Integer.MIN_VALUE));
		assertEquals(8, CustomMath.veinMinerExtra(1));
		assertEquals(80, CustomMath.veinMinerExtra(10));
		assertEquals(1016, CustomMath.veinMinerExtra(127));
		assertEquals(1024, CustomMath.veinMinerExtra(128));
		assertEquals(1024, CustomMath.veinMinerExtra(129));
		assertEquals(1024, CustomMath.veinMinerExtra(255));
		assertEquals(1024, CustomMath.veinMinerExtra(MAX));
		assertEquals(1024, CustomMath.VEIN_MINER_CAP);
	}

	@Test
	void barrage() {
		assertEquals(0, CustomMath.barrageCopies(0));
		assertEquals(0, CustomMath.barrageCopies(-1));
		assertEquals(10, CustomMath.barrageCopies(1));
		assertEquals(30, CustomMath.barrageCopies(3));
		assertEquals(510, CustomMath.barrageCopies(51));
		assertEquals(512, CustomMath.barrageCopies(52));
		assertEquals(512, CustomMath.barrageCopies(MAX));
		assertEquals(512, CustomMath.BARRAGE_CAP);
	}

	@Test
	void kaboom() {
		assertEquals(0.0F, CustomMath.kaboomPower(0));
		assertEquals(0.0F, CustomMath.kaboomPower(-1));
		assertEquals(1.5F, CustomMath.kaboomPower(1));
		assertEquals(2.5F, CustomMath.kaboomPower(3));
		assertEquals(7.5F, CustomMath.kaboomPower(13));
		assertEquals(8.0F, CustomMath.kaboomPower(14));
		assertEquals(8.0F, CustomMath.kaboomPower(15));
		assertEquals(8.0F, CustomMath.kaboomPower(1000));
		assertEquals(8.0F, CustomMath.kaboomPower(MAX));
		assertEquals(64, CustomMath.KABOOM_PER_TICK);
		assertEquals(20_000_000L, CustomMath.KABOOM_NANOS_PER_TICK);
	}

	@Test
	void yeet() {
		assertEquals(0.0, CustomMath.yeetVertical(0), EPS);
		assertEquals(0.0, CustomMath.yeetVertical(-1), EPS);
		assertEquals(0.0, CustomMath.yeetHorizontal(0), EPS);
		assertEquals(0.0, CustomMath.yeetHorizontal(-1), EPS);
		assertEquals(0.8, CustomMath.yeetVertical(1), EPS);
		assertEquals(0.6, CustomMath.yeetHorizontal(1), EPS);
		assertEquals(2.0, CustomMath.yeetVertical(5), EPS);
		assertEquals(1.4, CustomMath.yeetHorizontal(5), EPS);
		assertEquals(2.9, CustomMath.yeetVertical(8), EPS);
		assertEquals(3.0, CustomMath.yeetVertical(9), EPS);
		assertEquals(2.8, CustomMath.yeetHorizontal(12), EPS);
		assertEquals(3.0, CustomMath.yeetHorizontal(13), EPS);
		assertEquals(3.0, CustomMath.yeetHorizontal(14), EPS);
		assertEquals(3.0, CustomMath.yeetVertical(MAX), EPS);
		assertEquals(3.0, CustomMath.yeetHorizontal(MAX), EPS);
		assertTrue(CustomMath.yeetVertical(1000) <= CustomMath.YEET_VERTICAL_CAP);
		assertTrue(CustomMath.yeetHorizontal(1000) <= CustomMath.YEET_HORIZONTAL_CAP);
	}

	@Test
	void partyPopper() {
		assertEquals(0, CustomMath.partyPopperFireworks(0));
		assertEquals(0, CustomMath.partyPopperFireworks(-1));
		assertEquals(0, CustomMath.partyPopperFireworks(Integer.MIN_VALUE));
		assertEquals(1, CustomMath.partyPopperFireworks(1));
		assertEquals(3, CustomMath.partyPopperFireworks(3));
		assertEquals(16, CustomMath.partyPopperFireworks(16));
		assertEquals(16, CustomMath.partyPopperFireworks(17));
		assertEquals(16, CustomMath.partyPopperFireworks(MAX));
	}

	@Test
	void chickenRain() {
		assertEquals(0, CustomMath.chickenRainPercent(0));
		assertEquals(0, CustomMath.chickenRainPercent(-1));
		assertEquals(5, CustomMath.chickenRainPercent(1));
		assertEquals(95, CustomMath.chickenRainPercent(19));
		assertEquals(100, CustomMath.chickenRainPercent(20));
		assertEquals(100, CustomMath.chickenRainPercent(21));
		assertEquals(100, CustomMath.chickenRainPercent(MAX));
	}

	@Test
	void midasTouch() {
		assertEquals(0, CustomMath.midasNuggetPercent(0));
		assertEquals(0, CustomMath.midasNuggetPercent(-1));
		assertEquals(3, CustomMath.midasNuggetPercent(1));
		assertEquals(99, CustomMath.midasNuggetPercent(33));
		assertEquals(100, CustomMath.midasNuggetPercent(34));
		assertEquals(100, CustomMath.midasNuggetPercent(MAX));

		assertEquals(0, CustomMath.midasIngotPercent(-1));
		assertEquals(0, CustomMath.midasIngotPercent(0));
		assertEquals(0, CustomMath.midasIngotPercent(1));
		assertEquals(0, CustomMath.midasIngotPercent(33));
		assertEquals(3, CustomMath.midasIngotPercent(34));
		assertEquals(99, CustomMath.midasIngotPercent(66));
		assertEquals(100, CustomMath.midasIngotPercent(67));
		assertEquals(100, CustomMath.midasIngotPercent(68));
		assertEquals(100, CustomMath.midasIngotPercent(MAX));
	}

	@Test
	void magnet() {
		assertEquals(0.0, CustomMath.magnetRadius(0), EPS);
		assertEquals(0.0, CustomMath.magnetRadius(-1), EPS);
		assertEquals(4.0, CustomMath.magnetRadius(1), EPS);
		assertEquals(8.0, CustomMath.magnetRadius(5), EPS);
		assertEquals(23.0, CustomMath.magnetRadius(20), EPS);
		assertEquals(24.0, CustomMath.magnetRadius(21), EPS);
		assertEquals(24.0, CustomMath.magnetRadius(22), EPS);
		assertEquals(24.0, CustomMath.magnetRadius(MAX), EPS);
		assertEquals(256, CustomMath.MAGNET_ENTITY_CAP);
	}

	@Test
	void moonBoots() {
		assertEquals(-1, CustomMath.moonBootsAmplifier(0));
		assertEquals(-1, CustomMath.moonBootsAmplifier(-1));
		assertEquals(0, CustomMath.moonBootsAmplifier(1));
		assertEquals(2, CustomMath.moonBootsAmplifier(3));
		assertEquals(9, CustomMath.moonBootsAmplifier(10));
		assertEquals(10, CustomMath.moonBootsAmplifier(11));
		assertEquals(10, CustomMath.moonBootsAmplifier(12));
		assertEquals(10, CustomMath.moonBootsAmplifier(50));
		assertEquals(10, CustomMath.moonBootsAmplifier(MAX));
	}

	@Test
	void butterfingers() {
		assertEquals(0, CustomMath.butterfingersPercent(0));
		assertEquals(0, CustomMath.butterfingersPercent(-1));
		assertEquals(2, CustomMath.butterfingersPercent(1));
		assertEquals(48, CustomMath.butterfingersPercent(24));
		assertEquals(50, CustomMath.butterfingersPercent(25));
		assertEquals(50, CustomMath.butterfingersPercent(26));
		assertEquals(50, CustomMath.butterfingersPercent(MAX));
	}

	@Test
	void hiccups() {
		assertEquals(0, CustomMath.hiccupsPercent(0));
		assertEquals(0, CustomMath.hiccupsPercent(-1));
		assertEquals(3, CustomMath.hiccupsPercent(1));
		assertEquals(57, CustomMath.hiccupsPercent(19));
		assertEquals(60, CustomMath.hiccupsPercent(20));
		assertEquals(60, CustomMath.hiccupsPercent(21));
		assertEquals(60, CustomMath.hiccupsPercent(MAX));
	}

	@Test
	void roll() {
		assertFalse(CustomMath.roll(0, 0));
		assertTrue(CustomMath.roll(1, 0));
		assertFalse(CustomMath.roll(1, 1));
		assertTrue(CustomMath.roll(50, 49));
		assertFalse(CustomMath.roll(50, 50));
		assertTrue(CustomMath.roll(100, 99));
		for (int draw = 0; draw < 100; draw++) {
			assertFalse(CustomMath.roll(0, draw), "0 % never");
			assertTrue(CustomMath.roll(100, draw), "100 % always");
		}
		// exactly `percent` of the 100 possible draws succeed
		for (int percent = 0; percent <= 100; percent++) {
			int hits = 0;
			for (int draw = 0; draw < 100; draw++) if (CustomMath.roll(percent, draw)) hits++;
			assertEquals(percent, hits, "percent " + percent);
		}
	}

	@Test
	void everyFunctionIsMonotonicAndCapped() {
		for (int l = 0; l < 1000; l++) {
			assertTrue(CustomMath.veinMinerExtra(l) <= CustomMath.veinMinerExtra(l + 1));
			assertTrue(CustomMath.barrageCopies(l) <= CustomMath.barrageCopies(l + 1));
			assertTrue(CustomMath.kaboomPower(l) <= CustomMath.kaboomPower(l + 1));
			assertTrue(CustomMath.yeetVertical(l) <= CustomMath.yeetVertical(l + 1));
			assertTrue(CustomMath.yeetHorizontal(l) <= CustomMath.yeetHorizontal(l + 1));
			assertTrue(CustomMath.magnetRadius(l) <= CustomMath.magnetRadius(l + 1));
			assertTrue(CustomMath.moonBootsAmplifier(l) <= CustomMath.moonBootsAmplifier(l + 1));
			assertTrue(CustomMath.veinMinerExtra(l) <= CustomMath.VEIN_MINER_CAP);
			assertTrue(CustomMath.barrageCopies(l) <= CustomMath.BARRAGE_CAP);
			assertTrue(CustomMath.kaboomPower(l) <= CustomMath.KABOOM_POWER_CAP);
			assertTrue(CustomMath.partyPopperFireworks(l) <= CustomMath.PARTY_POPPER_CAP);
			assertTrue(CustomMath.chickenRainPercent(l) <= 100);
			assertTrue(CustomMath.midasNuggetPercent(l) <= 100);
			assertTrue(CustomMath.midasIngotPercent(l) <= 100);
			assertTrue(CustomMath.magnetRadius(l) <= CustomMath.MAGNET_RADIUS_CAP);
			assertTrue(CustomMath.moonBootsAmplifier(l) <= CustomMath.MOON_BOOTS_AMPLIFIER_CAP);
			assertTrue(CustomMath.butterfingersPercent(l) <= CustomMath.BUTTERFINGERS_PERCENT_CAP);
			assertTrue(CustomMath.hiccupsPercent(l) <= CustomMath.HICCUPS_PERCENT_CAP);
		}
	}
}
