/** Per-player notification preferences (enchant sound / actionbar message). Pure: no @minecraft/* imports. */
import { K, onOff, tr, type Msg } from "./i18n";

export interface NotifyPrefs {
  readonly sound: boolean;
  readonly message: boolean;
}

export type NotifySetting = "sound" | "message";

export const DEFAULT_NOTIFY: NotifyPrefs = Object.freeze({ sound: true, message: true });

/**
 * Accepts the raw dynamic property value; never throws.
 * Non-string / bad JSON / non-object -> DEFAULT; missing or non-boolean key -> true.
 */
export function parseNotifyPrefs(raw: unknown): NotifyPrefs {
  if (typeof raw !== "string") return DEFAULT_NOTIFY;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_NOTIFY;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return DEFAULT_NOTIFY;
  const o = parsed as Record<string, unknown>;
  return { sound: o["sound"] !== false, message: o["message"] !== false };
}

export function encodeNotifyPrefs(p: NotifyPrefs): string {
  return JSON.stringify({ sound: p.sound, message: p.message });
}

/** "Enchant sound: §aON" / "Enchant message: §cOFF" */
export function notifySettingText(setting: NotifySetting, on: boolean): Msg {
  return tr(setting === "sound" ? K.notifySound : K.notifyMessage, onOff(on));
}

/** "Enchant sound: §aON§r, enchant message: §cOFF" */
export function notifyStatusText(p: NotifyPrefs): Msg {
  return tr(K.notifyStatus, onOff(p.sound), onOff(p.message));
}
