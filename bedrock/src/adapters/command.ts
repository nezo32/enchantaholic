/**
 * Custom commands:
 *   /enchantaholic:toggle [on|off|status]                       game directors; world-wide mode switch
 *   /enchantaholic:notify <sound|message|status> [on|off]       any player; own notification settings
 *   /enchantaholic:custom <on|off|status>                       game directors; Custom Enchantments switch
 * Callbacks run in restricted execution, so every write is deferred to system.run.
 */
import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  system,
  world,
  type CustomCommandOrigin,
  type CustomCommandRegistry,
  type CustomCommandResult,
} from "@minecraft/server";
import {
  COMMAND_ENUM,
  COMMAND_NAME,
  CUSTOM_COMMAND_NAME,
  NOTIFY_COMMAND_NAME,
  NOTIFY_SWITCH_ENUM,
  NOTIFY_TARGET_ENUM,
} from "../core/config";
import { CUSTOM_MODE_OFF_HINT, customChangedText, customStatusText, statusText } from "../core/message";
import { notifySettingText, notifyStatusText } from "../core/notify";
import { safe } from "./log";
import { getNotifyPrefs, setNotifyPrefs, type PrefsHolder } from "./notify-prefs";
import { isCustomEnabled, isEnabled, setCustomEnabled, setEnabled } from "./state";

export type ToggleArg = "on" | "off" | "status";
export type NotifyTargetArg = "sound" | "message" | "status";
export type SwitchArg = "on" | "off";

const NOTIFY_USAGE = "Usage: /enchantaholic:notify <sound|message|status> [on|off]";
const NOT_A_PLAYER = "Only players can change Enchantaholic notifications.";
const CUSTOM_USAGE = "Usage: /enchantaholic:custom <on|off|status>";

/** Target state queued by a toggle but not yet persisted (world writes wait for system.run). */
let pending: boolean | undefined;
/** Same, for the Custom Enchantments setting. */
let pendingCustom: boolean | undefined;

/** Test helper. */
export function _resetPendingToggle(): void {
  pending = undefined;
  pendingCustom = undefined;
}

function toArg(raw: unknown): ToggleArg | undefined {
  return raw === "on" || raw === "off" || raw === "status" ? raw : undefined;
}

function toTarget(raw: unknown): NotifyTargetArg | undefined {
  return raw === "sound" || raw === "message" || raw === "status" ? raw : undefined;
}

function toSwitch(raw: unknown): SwitchArg | undefined {
  return raw === "on" || raw === "off" ? raw : undefined;
}

/**
 * Registers /enchantaholic:toggle [on|off|status], /enchantaholic:notify <sound|message|status> [on|off]
 * and /enchantaholic:custom <on|off|status> (last; it reuses the toggle's enum).
 * Called from system.beforeEvents.startup. The toggle's enum is registered first.
 */
export function registerCommands(registry: CustomCommandRegistry): void {
  registry.registerEnum(COMMAND_ENUM, ["on", "off", "status"]);
  registry.registerCommand(
    {
      name: COMMAND_NAME,
      description: "Toggle Enchantaholic Mode (on|off|status)",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
      optionalParameters: [{ name: COMMAND_ENUM, type: CustomCommandParamType.Enum }],
    },
    (_origin, arg?: unknown) => handleToggle(toArg(arg)),
  );
  registry.registerEnum(NOTIFY_TARGET_ENUM, ["sound", "message", "status"]);
  registry.registerEnum(NOTIFY_SWITCH_ENUM, ["on", "off"]);
  registry.registerCommand(
    {
      name: NOTIFY_COMMAND_NAME,
      description: "Turn your Enchantaholic enchant sound or actionbar message on or off (sound|message|status)",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ name: NOTIFY_TARGET_ENUM, type: CustomCommandParamType.Enum }],
      optionalParameters: [{ name: NOTIFY_SWITCH_ENUM, type: CustomCommandParamType.Enum }],
    },
    (origin, target?: unknown, value?: unknown) => handleNotify(origin, toTarget(target), toSwitch(value)),
  );
  registry.registerCommand(
    {
      name: CUSTOM_COMMAND_NAME,
      description: "Turn Enchantaholic's custom enchantments on or off for this world (on|off|status)",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      cheatsRequired: false,
      mandatoryParameters: [{ name: COMMAND_ENUM, type: CustomCommandParamType.Enum }],
    },
    (_origin, arg?: unknown) => handleCustom(toArg(arg)),
  );
}

/**
 * Runs in restricted execution: the world write is deferred to system.run.
 * No argument flips the current state.
 */
export function handleToggle(arg: ToggleArg | undefined): CustomCommandResult {
  if (arg === "status") return { status: CustomCommandStatus.Success, message: statusText(pending ?? isEnabled()) };
  // Two toggles in the same tick must cancel out, so flip the not-yet-persisted target if any.
  const target = arg ? arg === "on" : !(pending ?? isEnabled());
  pending = target;
  system.run(
    safe("toggle", () => {
      if (pending === target) pending = undefined;
      setEnabled(target);
      world.sendMessage(statusText(target));
    }),
  );
  return { status: CustomCommandStatus.Success, message: statusText(target) };
}

/**
 * Custom Enchantments switch. Runs in restricted execution: the world write and the broadcast are
 * deferred to system.run; a status in the same tick reports the queued value.
 */
export function handleCustom(arg: ToggleArg | undefined): CustomCommandResult {
  if (arg === undefined) return { status: CustomCommandStatus.Failure, message: CUSTOM_USAGE };
  if (arg === "status") {
    return { status: CustomCommandStatus.Success, message: customStatusText(pendingCustom ?? isCustomEnabled()) };
  }
  const target = arg === "on";
  pendingCustom = target;
  system.run(
    safe("custom", () => {
      if (pendingCustom === target) pendingCustom = undefined;
      setCustomEnabled(target);
      world.sendMessage(customChangedText(target));
    }),
  );
  const modeOff = target && !(pending ?? isEnabled());
  const message = modeOff ? `${customChangedText(target)}\n${CUSTOM_MODE_OFF_HINT}` : customChangedText(target);
  return { status: CustomCommandStatus.Success, message };
}

/**
 * Per-player notification settings. Replies only to the caller (no broadcast). The property write is
 * deferred to system.run; the in-memory cache is updated at once so a status or second flip in the
 * same tick sees the new value.
 */
export function handleNotify(
  origin: Pick<CustomCommandOrigin, "sourceEntity">,
  target: NotifyTargetArg | undefined,
  value: SwitchArg | undefined,
): CustomCommandResult {
  const entity = origin.sourceEntity;
  if (entity?.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: NOT_A_PLAYER };
  if (!target) return { status: CustomCommandStatus.Failure, message: NOTIFY_USAGE };
  const holder: PrefsHolder = entity;
  const prefs = getNotifyPrefs(holder);
  if (target === "status") return { status: CustomCommandStatus.Success, message: notifyStatusText(prefs) };
  const on = value ? value === "on" : !prefs[target];
  setNotifyPrefs(holder, { ...prefs, [target]: on });
  return { status: CustomCommandStatus.Success, message: notifySettingText(target, on) };
}
