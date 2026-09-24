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
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class LangFileTest {
	private static JsonObject lang;
	private static JsonObject ru;

	@BeforeAll
	static void load() throws IOException {
		lang = read("en_us");
		ru = read("ru_ru");
	}

	private static JsonObject read(String code) throws IOException {
		try (InputStream in = LangFileTest.class.getResourceAsStream("/assets/enchantaholic/lang/" + code + ".json")) {
			assertNotNull(in, code + ".json not on the test classpath");
			try (Reader reader = new InputStreamReader(in, StandardCharsets.UTF_8)) {
				return JsonParser.parseReader(reader).getAsJsonObject();
			}
		}
	}

	/** Format placeholders (%s, %1$s, %d, …) of a lang value, sorted; %% is a literal percent sign. */
	static List<String> placeholders(String value) {
		Matcher m = Pattern.compile("%(?:(\\d+)\\$)?([a-zA-Z%])").matcher(value);
		List<String> out = new ArrayList<>();
		int next = 1;
		while (m.find()) {
			if (m.group(2).equals("%")) continue;
			// unnumbered %s count as positional, so "%s %s" and "%2$s %1$s" compare equal
			out.add((m.group(1) != null ? m.group(1) : String.valueOf(next++)) + "$" + m.group(2));
		}
		out.sort(null);
		return out;
	}

	@Test
	void placeholderHelperSanity() {
		assertEquals(List.of("1$s", "2$s"), placeholders("✦ %1$s → %2$s"));
		assertEquals(List.of("1$s", "2$s"), placeholders("%2$s a %1$s"));
		assertEquals(List.of("1$s"), placeholders("Sound: %s (100%%)"));
		assertEquals(List.of(), placeholders("none"));
	}

	@Test
	void russianHasExactlyTheEnglishKeys() {
		assertEquals(new TreeSet<>(lang.keySet()), new TreeSet<>(ru.keySet()), "ru_ru.json key set differs from en_us.json");
	}

	@Test
	void russianPlaceholdersMatchEnglish() {
		for (String key : lang.keySet()) {
			if (!ru.has(key)) continue; // reported by russianHasExactlyTheEnglishKeys
			assertEquals(placeholders(lang.get(key).getAsString()), placeholders(ru.get(key).getAsString()), "placeholders of " + key);
		}
	}

	@Test
	void noEmptyValues() {
		for (JsonObject file : new JsonObject[] {lang, ru}) {
			for (String key : file.keySet()) {
				assertFalse(file.get(key).getAsString().isBlank(), "blank " + key + (file == ru ? " (ru_ru)" : " (en_us)"));
			}
		}
	}

	@Test
	void russianLevelNumeralsIdenticalToEnglish() {
		for (String key : lang.keySet()) {
			if (!key.startsWith("enchantment.level.")) continue;
			assertTrue(ru.has(key), "ru_ru missing " + key);
			assertEquals(lang.get(key).getAsString(), ru.get(key).getAsString(), "ru_ru " + key);
		}
		for (int n = 11; n <= 255; n++) {
			assertEquals(toRoman(n), ru.get("enchantment.level." + n).getAsString(), "ru_ru enchantment.level." + n);
		}
	}

	/** Custom enchantments must actually be translated (not a copy of the English name), except the mod name. */
	@Test
	void russianCustomNamesTranslated() {
		for (String id : CUSTOM_IDS) {
			String key = "enchantment.enchantaholic." + id;
			assertFalse(lang.get(key).getAsString().equals(ru.get(key).getAsString()), "untranslated " + key);
		}
		assertTrue(ru.get("enchantment.enchantaholic.butterfingers").getAsString().startsWith("Проклятие"), "butterfingers is a curse (ru)");
		assertTrue(ru.get("enchantment.enchantaholic.hiccups").getAsString().startsWith("Проклятие"), "hiccups is a curse (ru)");
		assertEquals("Режим Enchantaholic", ru.get("enchantaholic.createWorld.toggle").getAsString());
		assertTrue(ru.get("enchantaholic.createWorld.customToggle.tooltip").getAsString().contains("/enchantaholic custom"),
				"ru tooltip names the command");
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

	static final String[] CUSTOM_IDS = {"vein_miner", "barrage", "yeet", "kaboom", "party_popper", "chicken_rain",
			"midas_touch", "magnet", "moon_boots", "butterfingers", "hiccups"};

	@Test
	void customEnchantmentKeysPresent() {
		for (String id : CUSTOM_IDS) {
			for (String key : new String[] {"enchantment.enchantaholic." + id, "enchantment.enchantaholic." + id + ".desc"}) {
				assertTrue(lang.has(key), "missing " + key);
				assertFalse(lang.get(key).getAsString().isBlank(), "blank " + key);
			}
		}
		assertTrue(lang.get("enchantment.enchantaholic.butterfingers").getAsString().startsWith("Curse of"), "butterfingers is a curse");
		assertTrue(lang.get("enchantment.enchantaholic.hiccups").getAsString().startsWith("Curse of"), "hiccups is a curse");
		for (String key : new String[] {
				"enchantaholic.createWorld.customToggle",
				"enchantaholic.createWorld.customToggle.tooltip",
				"enchantaholic.command.custom.on",
				"enchantaholic.command.custom.off",
				"enchantaholic.command.custom.status.on",
				"enchantaholic.command.custom.status.off"}) {
			assertTrue(lang.has(key), "missing " + key);
			assertFalse(lang.get(key).getAsString().isBlank(), "blank " + key);
		}
		assertTrue(lang.get("enchantaholic.createWorld.customToggle.tooltip").getAsString().contains("/enchantaholic custom"),
				"tooltip names the command");
	}

	/** Every enchantment JSON in the mod datapack has a name (the ids list above is complete) and the English name as fallback. */
	@Test
	void everyEnchantmentJsonHasLang() throws IOException {
		for (String id : CUSTOM_IDS) {
			try (InputStream in = LangFileTest.class.getResourceAsStream("/data/enchantaholic/enchantment/" + id + ".json")) {
				assertNotNull(in, "missing data/enchantaholic/enchantment/" + id + ".json");
				try (Reader reader = new InputStreamReader(in, StandardCharsets.UTF_8)) {
					JsonObject json = JsonParser.parseReader(reader).getAsJsonObject();
					JsonObject description = json.getAsJsonObject("description");
					assertEquals("enchantment.enchantaholic." + id, description.get("translate").getAsString(), id);
					// clients without the mod (vanilla) have no lang file: they show the fallback
					assertEquals(lang.get("enchantment.enchantaholic." + id).getAsString(), description.get("fallback").getAsString(), id + " fallback");
				}
			}
		}
	}

	@Test
	void noGameruleKeys() {
		for (String key : lang.keySet()) {
			assertFalse(key.startsWith("gamerule."), "stale game rule key " + key);
		}
		assertFalse(lang.get("enchantaholic.createWorld.toggle.tooltip").getAsString().contains("/gamerule"), "tooltip mentions /gamerule");
	}
}
