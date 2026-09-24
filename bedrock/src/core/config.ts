/** All constants shared by core and adapters. Pure: no @minecraft/* imports. */
export const NS = "enchantaholic";
/** World dynamic property (boolean). `undefined` counts as ON. */
export const PROP_ENABLED = "enchantaholic:enabled";
/** Item dynamic property (JSON string) holding true levels above vanilla max. */
export const PROP_LEVELS = "enchantaholic:levels";
/** Invisible sentinel ("eh") prefixing managed lore lines, reset by §r. */
export const LORE_TAG = "§e§h§r";
export const LORE_MAX_LINES = 20;
export const LORE_MAX_CHARS = 50;
/** Safety bound in the enchanter loop. */
export const MAX_APPLY_ATTEMPTS = 64;
export const EFFECT_INTERVAL_TICKS = 20;
/** Longer than two intervals so the effect never flickers. */
export const HASTE_DURATION_TICKS = 60;
/** Haste X. */
export const HASTE_MAX_AMPLIFIER = 9;
export const FEEDBACK_SOUND = "random.orb";
export const FEEDBACK_SOUND_VOLUME = 0.25;
export const FEEDBACK_SOUND_PITCH = 1.6;
export const COMMAND_NAME = "enchantaholic:toggle";
/** Enum values: on | off | status. */
export const COMMAND_ENUM = "enchantaholic:state";
export const MODE_LABEL = "Enchantaholic Mode";
/** Above this, levels are rendered as decimal digits. */
export const ROMAN_MAX = 3999;
/** Item ids forced non-enchantable (see spec §9.5). */
export const NON_ENCHANTABLE_OVERRIDE: ReadonlySet<string> = new Set<string>();
/** Player dynamic property (JSON string) with notification prefs. `undefined` = both ON. */
export const PROP_NOTIFY = "enchantaholic:notify";
export const NOTIFY_COMMAND_NAME = "enchantaholic:notify";
/** Enum values: sound | message | status. */
export const NOTIFY_TARGET_ENUM = "enchantaholic:notify_target";
/** Enum values: on | off. */
export const NOTIFY_SWITCH_ENUM = "enchantaholic:notify_switch";
/** World dynamic property (boolean). Missing/anything but true = OFF. */
export const PROP_CUSTOM_ENABLED = "enchantaholic:custom";
/** Item dynamic property (JSON {id: level}) with custom enchant levels; non-stackable items only. */
export const PROP_CUSTOM_LEVELS = "enchantaholic:custom_levels";
export const CUSTOM_COMMAND_NAME = "enchantaholic:custom";
export const CUSTOM_LABEL = "Custom Enchantments";
