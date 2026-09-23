import {
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  system,
  world,
  type CustomCommandRegistry,
  type CustomCommandResult,
} from "@minecraft/server";
import { COMMAND_ENUM, COMMAND_NAME } from "../core/config";
import { statusText } from "../core/message";
import { safe } from "./log";
import { isEnabled, setEnabled } from "./state";

export type ToggleArg = "on" | "off" | "status";

function toArg(raw: unknown): ToggleArg | undefined {
  return raw === "on" || raw === "off" || raw === "status" ? raw : undefined;
}

/** Registers /enchantaholic:toggle [on|off|status]. Called from system.beforeEvents.startup. */
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
}

/**
 * Runs in restricted execution: the world write is deferred to system.run.
 * No argument flips the current state.
 */
export function handleToggle(arg: ToggleArg | undefined): CustomCommandResult {
  if (arg === "status") return { status: CustomCommandStatus.Success, message: statusText(isEnabled()) };
  const target = arg ? arg === "on" : !isEnabled();
  system.run(
    safe("toggle", () => {
      setEnabled(target);
      world.sendMessage(statusText(target));
    }),
  );
  return { status: CustomCommandStatus.Success, message: statusText(target) };
}
