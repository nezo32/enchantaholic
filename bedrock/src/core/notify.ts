/** Per-player notification preferences (enchant sound / actionbar message). Pure: no @minecraft/* imports. */

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

const LABEL: Record<NotifySetting, string> = { sound: "sound", message: "message" };
const onOff = (on: boolean): string => (on ? "§aON" : "§cOFF");

/** "Enchant sound: §aON" / "Enchant message: §cOFF" */
export function notifySettingText(setting: NotifySetting, on: boolean): string {
  return `Enchant ${LABEL[setting]}: ${onOff(on)}`;
}

/** "Enchant sound: §aON§r, enchant message: §cOFF" */
export function notifyStatusText(p: NotifyPrefs): string {
  return `Enchant sound: ${onOff(p.sound)}§r, enchant message: ${onOff(p.message)}`;
}
