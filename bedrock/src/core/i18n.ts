/**
 * Player-facing texts as translatable raw messages. Pure: no @minecraft/* imports.
 *
 * Every message is a `{ translate, with }` RawMessage, so each client renders it in its own language from
 * the resource pack's texts/<lang>.lang (resource_pack/texts). `EN` mirrors resource_pack/texts/en_US.lang
 * (a test keeps them identical) and renders the English fallback for callers that only take a string
 * (a custom command run from a command block or the server console).
 */
import { CUSTOM_ENCHANTS } from "./custom/roster";

/** Structurally a `@minecraft/server` RawMessage. */
export interface Msg {
  text?: string;
  translate?: string;
  with?: string[] | Msg;
  rawtext?: Msg[];
}

export const K = {
  on: "enchantaholic.state.on",
  off: "enchantaholic.state.off",
  modeStatus: "enchantaholic.mode.status",
  customStatus: "enchantaholic.custom.status",
  customChanged: "enchantaholic.custom.changed",
  customModeOffHint: "enchantaholic.custom.mode_off_hint",
  customUsage: "enchantaholic.custom.usage",
  notifySound: "enchantaholic.notify.sound",
  notifyMessage: "enchantaholic.notify.message",
  notifyStatus: "enchantaholic.notify.status",
  notifyUsage: "enchantaholic.notify.usage",
  notifyNotPlayer: "enchantaholic.notify.not_player",
} as const;

/** Lang key of a custom enchantment's name ("enchantment.enchantaholic.<key>"). */
export const customNameKey = (key: string): string => `enchantment.enchantaholic.${key}`;

/** English texts of every key the scripts use (equal to resource_pack/texts/en_US.lang minus pack.*). */
export const EN: Readonly<Record<string, string>> = Object.freeze({
  [K.on]: "§aON",
  [K.off]: "§cOFF",
  [K.modeStatus]: "Enchantaholic Mode: %s",
  [K.customStatus]: "Custom Enchantments: %s",
  [K.customChanged]: "Custom Enchantments are now %s§r for this world",
  [K.customModeOffHint]:
    "§7(Enchantaholic Mode is §cOFF§7, so nothing will roll until you turn it on with /enchantaholic:toggle on)",
  [K.customUsage]: "Usage: /enchantaholic:custom <on|off|status>",
  [K.notifySound]: "Enchant sound: %s",
  [K.notifyMessage]: "Enchant message: %s",
  [K.notifyStatus]: "Enchant sound: %s§r, enchant message: %s",
  [K.notifyUsage]: "Usage: /enchantaholic:notify <sound|message|status> [on|off]",
  [K.notifyNotPlayer]: "Only players can change Enchantaholic notifications.",
  ...Object.fromEntries(CUSTOM_ENCHANTS.map((d) => [customNameKey(d.key), d.name])),
});

/** `{ translate: key }`, with the args as nested raw messages (each arg is one %s). */
export function tr(key: string, ...args: Msg[]): Msg {
  return args.length > 0 ? { translate: key, with: { rawtext: args } } : { translate: key };
}

/** Colored ON/OFF word. */
export const onOff = (on: boolean): Msg => tr(on ? K.on : K.off);

/** Joins messages into one raw message. */
export const join = (...parts: Msg[]): Msg => ({ rawtext: parts });

/**
 * English rendering of a raw message. `lookup` resolves keys not in EN (vanilla keys such as
 * enchantment.damage.all); unknown keys render as themselves, like the client does.
 */
export function renderText(msg: Msg | string, lookup: (key: string) => string | undefined = () => undefined): string {
  if (typeof msg === "string") return msg;
  let out = msg.text ?? "";
  if (msg.translate !== undefined) {
    const template = EN[msg.translate] ?? lookup(msg.translate) ?? msg.translate;
    const w = msg.with;
    const args = w === undefined ? [] : Array.isArray(w) ? w : (w.rawtext ?? [w]).map((m) => renderText(m, lookup));
    let i = 0;
    out += template.replace(/%s/g, () => args[i++] ?? "");
  }
  for (const part of msg.rawtext ?? []) out += renderText(part, lookup);
  return out;
}
