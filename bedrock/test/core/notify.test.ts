import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFY,
  encodeNotifyPrefs,
  notifySettingText,
  notifyStatusText,
  parseNotifyPrefs,
} from "../../src/core/notify";
import { renderRaw } from "../fakes/lang";

describe("notify prefs", () => {
  it("DEFAULT is both ON and frozen", () => {
    expect(DEFAULT_NOTIFY).toEqual({ sound: true, message: true });
    expect(Object.isFrozen(DEFAULT_NOTIFY)).toBe(true);
  });

  it.each([undefined, 42, true, "", "nope", "[]", "null", "42", '"str"', '{"sound":'])(
    "parse(%j) falls back to DEFAULT",
    (raw) => {
      expect(parseNotifyPrefs(raw)).toEqual(DEFAULT_NOTIFY);
    },
  );

  it("parses partial objects; missing or non-boolean keys count as ON", () => {
    expect(parseNotifyPrefs('{"sound":false}')).toEqual({ sound: false, message: true });
    expect(parseNotifyPrefs('{"message":false}')).toEqual({ sound: true, message: false });
    expect(parseNotifyPrefs('{"sound":"no"}')).toEqual({ sound: true, message: true });
    expect(parseNotifyPrefs('{"sound":0,"message":null}')).toEqual({ sound: true, message: true });
    expect(parseNotifyPrefs('{"sound":false,"message":false,"extra":1,"volume":"x"}')).toEqual({
      sound: false,
      message: false,
    });
  });

  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])("encode round-trips sound=%s message=%s", (sound, message) => {
    const json = encodeNotifyPrefs({ sound, message });
    expect(json).toBe(JSON.stringify({ sound, message }));
    expect(parseNotifyPrefs(json)).toEqual({ sound, message });
  });

  it("formats setting and status texts", () => {
    const en = (m: unknown) => renderRaw(m);
    const ru = (m: unknown) => renderRaw(m, "ru");
    expect(en(notifySettingText("sound", true))).toBe("Enchant sound: §aON");
    expect(en(notifySettingText("sound", false))).toBe("Enchant sound: §cOFF");
    expect(en(notifySettingText("message", true))).toBe("Enchant message: §aON");
    expect(en(notifySettingText("message", false))).toBe("Enchant message: §cOFF");
    expect(en(notifyStatusText({ sound: true, message: false }))).toBe("Enchant sound: §aON§r, enchant message: §cOFF");
    expect(en(notifyStatusText({ sound: false, message: true }))).toBe("Enchant sound: §cOFF§r, enchant message: §aON");
    expect(ru(notifySettingText("sound", true))).toBe("Звук зачарования: §aВкл");
    expect(ru(notifySettingText("message", false))).toBe("Сообщение о зачаровании: §cВыкл");
    expect(ru(notifyStatusText({ sound: true, message: false }))).toBe(
      "Звук зачарования: §aВкл§r, сообщение о зачаровании: §cВыкл",
    );
  });
});
