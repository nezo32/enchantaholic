import { beforeEach, describe, expect, it } from "vitest";
import type * as mc from "@minecraft/server";
import { handleToggle, registerCommands } from "../../src/adapters/command";
import { isEnabled } from "../../src/adapters/state";
import { COMMAND_ENUM, COMMAND_NAME, PROP_ENABLED } from "../../src/core/config";
import {
  asReal,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  FakeCustomCommandRegistry,
  system,
  world,
} from "../fakes/minecraft-server";
import { resetAll } from "./helpers";

function registered() {
  const reg = new FakeCustomCommandRegistry();
  registerCommands(asReal<mc.CustomCommandRegistry>(reg));
  return reg;
}

describe("command", () => {
  beforeEach(() => void resetAll());

  it("registers /enchantaholic:toggle with an optional on|off|status enum", () => {
    const reg = registered();
    expect(reg.enums.get(COMMAND_ENUM)).toEqual(["on", "off", "status"]);
    const cmd = reg.commands.get(COMMAND_NAME)?.command;
    expect(cmd?.permissionLevel).toBe(CommandPermissionLevel.GameDirectors);
    expect(cmd?.cheatsRequired).toBe(false);
    expect(cmd?.mandatoryParameters ?? []).toEqual([]);
    expect(cmd?.optionalParameters).toEqual([{ name: COMMAND_ENUM, type: CustomCommandParamType.Enum }]);
  });

  it("status reports without mutating", () => {
    const r = handleToggle("status");
    expect(r).toEqual({ status: CustomCommandStatus.Success, message: "Enchantaholic Mode: §aON" });
    system.flushRuns();
    expect(world.props.has(PROP_ENABLED)).toBe(false);
    expect(world.messages).toHaveLength(0);
  });

  it("no argument flips the state (deferred to system.run) and broadcasts", () => {
    const reg = registered();
    const r = reg.invoke(COMMAND_NAME, {}, undefined) as mc.CustomCommandResult;
    expect(r.message).toBe("Enchantaholic Mode: §cOFF");
    expect(isEnabled()).toBe(true); // not yet: restricted execution
    system.flushRuns();
    expect(isEnabled()).toBe(false);
    expect(world.getDynamicProperty(PROP_ENABLED)).toBe(false);
    expect(world.messages).toEqual(["Enchantaholic Mode: §cOFF"]);
    reg.invoke(COMMAND_NAME, {});
    system.flushRuns();
    expect(isEnabled()).toBe(true);
  });

  it("two toggles in the same tick cancel out (pending target is flipped, not the stale state)", () => {
    const reg = registered();
    expect((reg.invoke(COMMAND_NAME, {}) as mc.CustomCommandResult).message).toBe("Enchantaholic Mode: §cOFF");
    expect((reg.invoke(COMMAND_NAME, {}) as mc.CustomCommandResult).message).toBe("Enchantaholic Mode: §aON");
    expect((reg.invoke(COMMAND_NAME, {}, "status") as mc.CustomCommandResult).message).toBe("Enchantaholic Mode: §aON");
    system.flushRuns();
    expect(isEnabled()).toBe(true);
    expect(world.getDynamicProperty(PROP_ENABLED)).toBe(true);
    expect(world.messages).toEqual(["Enchantaholic Mode: §cOFF", "Enchantaholic Mode: §aON"]);
  });

  it("on/off are idempotent", () => {
    handleToggle("off");
    handleToggle("off");
    system.flushRuns();
    expect(isEnabled()).toBe(false);
    handleToggle("on");
    handleToggle("on");
    system.flushRuns();
    expect(isEnabled()).toBe(true);
    expect(world.messages).toHaveLength(4);
  });

  it("passes enum values from the registry callback", () => {
    const reg = registered();
    reg.invoke(COMMAND_NAME, {}, "off");
    system.flushRuns();
    expect(isEnabled()).toBe(false);
    expect((reg.invoke(COMMAND_NAME, {}, "status") as mc.CustomCommandResult).message).toBe(
      "Enchantaholic Mode: §cOFF",
    );
  });
});
