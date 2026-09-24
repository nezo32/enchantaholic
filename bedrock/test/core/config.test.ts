import { describe, expect, it } from "vitest";
import * as cfg from "../../src/core/config";

describe("config", () => {
  it("has the documented constants", () => {
    expect(cfg.PROP_ENABLED).toBe("enchantaholic:enabled");
    expect(cfg.PROP_LEVELS).toBe("enchantaholic:levels");
    expect(cfg.COMMAND_NAME).toBe("enchantaholic:toggle");
    expect(cfg.COMMAND_NAME.startsWith(`${cfg.NS}:`)).toBe(true);
    expect(cfg.LORE_TAG).toBe("§e§h§r");
    expect(cfg.HASTE_DURATION_TICKS).toBeGreaterThan(2 * cfg.EFFECT_INTERVAL_TICKS);
    expect(cfg.NON_ENCHANTABLE_OVERRIDE.size).toBe(0);
  });

  it("namespaces the notification constants", () => {
    expect(cfg.PROP_NOTIFY).toBe("enchantaholic:notify");
    expect(cfg.NOTIFY_COMMAND_NAME).toBe("enchantaholic:notify");
    expect(cfg.NOTIFY_TARGET_ENUM).toBe("enchantaholic:notify_target");
    expect(cfg.NOTIFY_SWITCH_ENUM).toBe("enchantaholic:notify_switch");
    for (const c of [cfg.PROP_NOTIFY, cfg.NOTIFY_COMMAND_NAME, cfg.NOTIFY_TARGET_ENUM, cfg.NOTIFY_SWITCH_ENUM]) {
      expect(c.startsWith(`${cfg.NS}:`)).toBe(true);
    }
    expect(cfg.NOTIFY_TARGET_ENUM).not.toBe(cfg.COMMAND_ENUM);
  });
});
