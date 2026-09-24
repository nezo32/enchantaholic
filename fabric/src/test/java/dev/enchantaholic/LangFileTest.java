package dev.enchantaholic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class LangFileTest {
	private static JsonObject lang;

	@BeforeAll
	static void load() throws IOException {
		try (InputStream in = LangFileTest.class.getResourceAsStream("/assets/enchantaholic/lang/en_us.json")) {
			assertNotNull(in, "en_us.json not on the test classpath");
			try (Reader reader = new InputStreamReader(in, StandardCharsets.UTF_8)) {
				lang = JsonParser.parseReader(reader).getAsJsonObject();
			}
		}
	}

	static String toRoman(int n) {
		int[] values = {1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1};
		String[] symbols = {"M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"};
		StringBuilder sb = new StringBuilder();
		for (int i = 0; i < values.length; i++) {
			while (n >= values[i]) {
				sb.append(symbols[i]);
				n -= values[i];
			}
		}
		return sb.toString();
	}

	@Test
	void romanHelperSanity() {
		assertEquals("XI", toRoman(11));
		assertEquals("XLIX", toRoman(49));
		assertEquals("CCLV", toRoman(255));
	}

	@Test
	void levelNumeralsUpTo255() {
		for (int n = 11; n <= 255; n++) {
			String key = "enchantment.level." + n;
			assertTrue(lang.has(key), "missing " + key);
			assertEquals(toRoman(n), lang.get(key).getAsString(), key);
		}
	}

	@Test
	void requiredKeysPresent() {
		for (String key : new String[] {
				"enchantaholic.command.on",
				"enchantaholic.command.off",
				"enchantaholic.command.status.on",
				"enchantaholic.command.status.off",
				"enchantaholic.createWorld.toggle",
				"enchantaholic.createWorld.toggle.tooltip",
				"enchantaholic.message.enchanted",
				"enchantaholic.settings.title",
				"enchantaholic.settings.notifySound",
				"enchantaholic.settings.notifySound.tooltip",
				"enchantaholic.settings.notifyMessage",
				"enchantaholic.settings.notifyMessage.tooltip",
				"enchantaholic.command.notify.sound",
				"enchantaholic.command.notify.message"}) {
			assertTrue(lang.has(key), "missing " + key);
			assertFalse(lang.get(key).getAsString().isBlank(), "blank " + key);
		}
		String message = lang.get("enchantaholic.message.enchanted").getAsString();
		assertTrue(message.contains("%1$s") && message.contains("%2$s"), "message placeholders: " + message);
	}

	@Test
	void noGameruleKeys() {
		for (String key : lang.keySet()) {
			assertFalse(key.startsWith("gamerule."), "stale game rule key " + key);
		}
		assertFalse(lang.get("enchantaholic.createWorld.toggle.tooltip").getAsString().contains("/gamerule"), "tooltip mentions /gamerule");
	}
}
