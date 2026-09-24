import { beforeEach, describe, expect, it } from "vitest";
import type { EnchantResult } from "../../src/adapters/enchanter";
import { notifyEnchant } from "../../src/adapters/feedback";
import { setNotifyPrefs } from "../../src/adapters/notify-prefs";
import { FEEDBACK_SOUND, PROP_NOTIFY } from "../../src/core/config";
import { asItem, asPlayer, makePlayer, sword } from "../fakes/builders";
import { system } from "../fakes/minecraft-server";
import { resetAll } from "./helpers";

const result = (): EnchantResult => ({
  item: asItem(sword()),
  enchant: { id: "minecraft:sharpness", maxLevel: 5 },
  level: 3,
});

describe("notifyEnchant", () => {
  beforeEach(() => void resetAll());

  it("defaults: actionbar and sound, as before", () => {
    const p = makePlayer();
    notifyEnchant(asPlayer(p), result());
    expect(p.onScreenDisplay.actionBars).toHaveLength(1);
    expect(p.sounds).toEqual([{ soundId: FEEDBACK_SOUND, options: { volume: 0.25, pitch: 1.6 } }]);
  });

  it("message off: no actionbar, sound still plays", () => {
    const p = makePlayer();
    setNotifyPrefs(p, { sound: true, message: false });
    notifyEnchant(asPlayer(p), result());
    expect(p.onScreenDisplay.actionBars).toHaveLength(0);
    expect(p.sounds).toHaveLength(1);
  });

  it("sound off: actionbar shows, no sound", () => {
    const p = makePlayer();
    setNotifyPrefs(p, { sound: false, message: true });
    notifyEnchant(asPlayer(p), result());
    expect(p.onScreenDisplay.actionBars).toHaveLength(1);
    expect(p.sounds).toHaveLength(0);
  });

  it("both off: nothing", () => {
    const p = makePlayer();
    setNotifyPrefs(p, { sound: false, message: false });
    system.flushRuns();
    notifyEnchant(asPlayer(p), result());
    expect(p.onScreenDisplay.actionBars).toHaveLength(0);
    expect(p.sounds).toHaveLength(0);
  });

  it("honours a value stored in an earlier session", () => {
    const p = makePlayer();
    p.props.set(PROP_NOTIFY, '{"sound":false,"message":false}');
    notifyEnchant(asPlayer(p), result());
    expect(p.onScreenDisplay.actionBars).toHaveLength(0);
    expect(p.sounds).toHaveLength(0);
  });
});
