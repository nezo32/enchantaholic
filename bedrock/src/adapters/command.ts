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
  type Player,
} from "@minecraft/server";
import {
  COMMAND_ENUM,
  COMMAND_NAME,
  CUSTOM_COMMAND_NAME,
  NOTIFY_COMMAND_NAME,
  NOTIFY_SWITCH_ENUM,
  NOTIFY_TARGET_ENUM,
} from "../core/config";
import { K, tr, type Msg } from "../core/i18n";
import { customChangedText, customStatusText, englishText, statusText, withHint } from "../core/message";
import { notifySettingText, notifyStatusText } from "../core/notify";
import { safe, warnOnce } from "./log";
import { getNotifyPrefs, setNotifyPrefs, type PrefsHolder } from "./notify-prefs";
import { isCustomEnabled, isEnabled, setCustomEnabled, setEnabled } from "./state";

export type ToggleArg = "on" | "off" | "status";
export type NotifyTargetArg = "sound" | "message" | "status";
export type SwitchArg = "on" | "off";

const NOTIFY_USAGE = tr(K.notifyUsage);
const NOT_A_PLAYER = tr(K.notifyNotPlayer);
const CUSTOM_USAGE = tr(K.customUsage);

type Origin = Pick<CustomCommandOrigin, "sourceEntity">;

/**
 * CustomCommandResult.message is a plain string (no RawMessage in 2.10.0), so a player caller gets the
 * reply as a translated chat message instead (Player.sendMessage has no restricted-execution tag) and the
 * result carries no text. Other callers (command blocks, console) or a failed send get the English text.
 */
function reply(origin: Origin | undefined, status: CustomCommandStatus, msg: Msg): CustomCommandResult {
  const entity = origin?.sourceEntity;
  if (entity?.typeId === "minecraft:player") {
    try {
      (entity as Player).sendMessage(msg);
      return { status };
    } catch (err) {
      warnOnce("reply", err);
    }
  }
  return { status, message: englishText(msg) };
}

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
    (origin, arg?: unknown) => handleToggle(toArg(arg), origin),
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
    (origin, arg?: unknown) => handleCustom(toArg(arg), origin),
  );
}

/**
 * Runs in restricted execution: the world write is deferred to system.run.
 * No argument flips the current state.
 */
export function handleToggle(arg: ToggleArg | undefined, origin?: Origin): CustomCommandResult {
  if (arg === "status") return reply(origin, CustomCommandStatus.Success, statusText(pending ?? isEnabled()));
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
  return reply(origin, CustomCommandStatus.Success, statusText(target));
}

/**
 * Custom Enchantments switch. Runs in restricted execution: the world write and the broadcast are
 * deferred to system.run; a status in the same tick reports the queued value.
 */
export function handleCustom(arg: ToggleArg | undefined, origin?: Origin): CustomCommandResult {
  if (arg === undefined) return reply(origin, CustomCommandStatus.Failure, CUSTOM_USAGE);
  if (arg === "status") {
    return reply(origin, CustomCommandStatus.Success, customStatusText(pendingCustom ?? isCustomEnabled()));
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
  return reply(origin, CustomCommandStatus.Success, modeOff ? withHint(customChangedText(target)) : customChangedText(target));
}

/**
 * Per-player notification settings. Replies only to the caller (no broadcast). The property write is
 * deferred to system.run; the in-memory cache is updated at once so a status or second flip in the
 * same tick sees the new value.
 */
export function handleNotify(
  origin: Origin,
  target: NotifyTargetArg | undefined,
  value: SwitchArg | undefined,
): CustomCommandResult {
  const entity = origin.sourceEntity;
  if (entity?.typeId !== "minecraft:player") return reply(origin, CustomCommandStatus.Failure, NOT_A_PLAYER);
  if (!target) return reply(origin, CustomCommandStatus.Failure, NOTIFY_USAGE);
  const holder: PrefsHolder = entity;
  const prefs = getNotifyPrefs(holder);
  if (target === "status") return reply(origin, CustomCommandStatus.Success, notifyStatusText(prefs));
  const on = value ? value === "on" : !prefs[target];
  setNotifyPrefs(holder, { ...prefs, [target]: on });
  return reply(origin, CustomCommandStatus.Success, notifySettingText(target, on));
}
