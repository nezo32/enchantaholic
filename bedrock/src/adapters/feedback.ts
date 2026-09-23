import type { Player } from "@minecraft/server";
import { FEEDBACK_SOUND, FEEDBACK_SOUND_PITCH, FEEDBACK_SOUND_VOLUME } from "../core/config";
import { buildEnchantMessage } from "../core/message";
import type { EnchantResult } from "./enchanter";
import { warnOnce } from "./log";

/** Actionbar line plus a quiet chime for the player who was enchanted. */
export function notifyEnchant(player: Player, r: EnchantResult): void {
  player.onScreenDisplay.setActionBar({ rawtext: buildEnchantMessage(r.item, r.enchant, r.level) });
  try {
    player.playSound(FEEDBACK_SOUND, { volume: FEEDBACK_SOUND_VOLUME, pitch: FEEDBACK_SOUND_PITCH });
  } catch (err) {
    warnOnce("sound", err);
  }
}
