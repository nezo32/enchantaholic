import type { Player } from "@minecraft/server";
import { FEEDBACK_SOUND, FEEDBACK_SOUND_PITCH, FEEDBACK_SOUND_VOLUME } from "../core/config";
import { buildEnchantMessage } from "../core/message";
import type { EnchantResult } from "./enchanter";
import { warnOnce } from "./log";
import { getNotifyPrefs } from "./notify-prefs";

/**
 * Actionbar line plus a quiet chime for the player who was enchanted. Each part can be turned
 * off per player with /enchantaholic:notify.
 */
export function notifyEnchant(player: Player, r: EnchantResult): void {
  const prefs = getNotifyPrefs(player);
  if (prefs.message) {
    player.onScreenDisplay.setActionBar({ rawtext: buildEnchantMessage(r.item, r.enchant, r.level) });
  }
  if (prefs.sound) {
    try {
      player.playSound(FEEDBACK_SOUND, { volume: FEEDBACK_SOUND_VOLUME, pitch: FEEDBACK_SOUND_PITCH });
    } catch (err) {
      warnOnce("sound", err);
    }
  }
}
