import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as mc from "@minecraft/server";
import { handleCustom, handleNotify, handleToggle, registerCommands } from "../../src/adapters/command";
import { isCustomEnabled, isEnabled } from "../../src/adapters/state";
import {
  COMMAND_ENUM,
  COMMAND_NAME,
  CUSTOM_COMMAND_NAME,
  NOTIFY_COMMAND_NAME,
  NOTIFY_SWITCH_ENUM,
  NOTIFY_TARGET_ENUM,
  PROP_CUSTOM_ENABLED,
  PROP_ENABLED,
  PROP_NOTIFY,
} from "../../src/core/config";
import { makePlayer } from "../fakes/builders";
import {
  asReal,
  CommandPermissionLevel,
  CustomCommandParamType,
  CustomCommandStatus,
  FakeCustomCommandRegistry,
  FakeEntity,
  FakePlayer,
  system,
  world,
} from "../fakes/minecraft-server";
import { resetAll } from "./helpers";
import { renderRaw } from "../fakes/lang";

type Result = mc.CustomCommandResult;

/** Invokes the notify command as `p`; a player's reply arrives as a chat message, so it is folded back into `message`. */
function asPlayer(reg: FakeCustomCommandRegistry, p: FakePlayer, ...args: unknown[]): Result {
  const before = p.messages.length;
  const r = reg.invoke(NOTIFY_COMMAND_NAME, { sourceEntity: p }, ...args) as Result;
  expect(r.message, "player callers get no string message").toBeUndefined();
  expect(p.messages.length).toBe(before + 1);
  return { status: r.status, message: p.texts.at(-1)! };
}

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
    expect(world.texts).toEqual(["Enchantaholic Mode: §cOFF"]);
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
    expect(world.texts).toEqual(["Enchantaholic Mode: §cOFF", "Enchantaholic Mode: §aON"]);
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

describe("notify command", () => {
  beforeEach(() => void resetAll());

  const msg = (r: unknown) => (r as mc.CustomCommandResult).message;
  const ok = (message: string) => ({ status: CustomCommandStatus.Success, message });
  const bothOn = "Enchant sound: §aON§r, enchant message: §aON";

  it("registers /enchantaholic:notify for any player after the toggle", () => {
    const reg = registered();
    expect([...reg.enums.keys()]).toEqual([COMMAND_ENUM, NOTIFY_TARGET_ENUM, NOTIFY_SWITCH_ENUM]);
    expect(reg.enums.get(NOTIFY_TARGET_ENUM)).toEqual(["sound", "message", "status"]);
    expect(reg.enums.get(NOTIFY_SWITCH_ENUM)).toEqual(["on", "off"]);
    const cmd = reg.commands.get(NOTIFY_COMMAND_NAME)?.command;
    expect(cmd?.permissionLevel).toBe(CommandPermissionLevel.Any);
    expect(cmd?.cheatsRequired).toBe(false);
    expect(cmd?.mandatoryParameters).toEqual([{ name: NOTIFY_TARGET_ENUM, type: CustomCommandParamType.Enum }]);
    expect(cmd?.optionalParameters).toEqual([{ name: NOTIFY_SWITCH_ENUM, type: CustomCommandParamType.Enum }]);
    // The toggle is unchanged.
    const toggle = reg.commands.get(COMMAND_NAME)?.command;
    expect(toggle?.permissionLevel).toBe(CommandPermissionLevel.GameDirectors);
    expect(toggle?.optionalParameters).toEqual([{ name: COMMAND_ENUM, type: CustomCommandParamType.Enum }]);
  });

  it("the fake registry rejects an Enum parameter whose enum is not registered (as the engine does)", () => {
    const reg = new FakeCustomCommandRegistry();
    const cmd = {
      name: NOTIFY_COMMAND_NAME,
      description: "x",
      permissionLevel: CommandPermissionLevel.Any,
      mandatoryParameters: [{ name: NOTIFY_TARGET_ENUM, type: CustomCommandParamType.Enum }],
    };
    expect(() => reg.registerCommand(asReal<mc.CustomCommand>(cmd), () => undefined)).toThrow(/no registered enum/);
  });

  it("status for a new player shows both ON", () => {
    const reg = registered();
    const player = makePlayer();
    expect(asPlayer(reg, player, "status")).toEqual(ok(bothOn));
    expect(asPlayer(reg, player, "status", "off")).toEqual(ok(bothOn));
    system.flushRuns();
    expect(player.props.has(PROP_NOTIFY)).toBe(false);
  });

  it("sound off is cached at once and persisted after system.run", () => {
    const reg = registered();
    const player = makePlayer();
    expect(asPlayer(reg, player, "sound", "off")).toEqual(
      ok("Enchant sound: §cOFF"),
    );
    expect(player.props.has(PROP_NOTIFY)).toBe(false);
    expect(msg(asPlayer(reg, player, "status"))).toBe(
      "Enchant sound: §cOFF§r, enchant message: §aON",
    );
    system.flushRuns();
    expect(player.props.get(PROP_NOTIFY)).toBe('{"sound":false,"message":true}');
    expect(world.messages).toHaveLength(0);
    expect(player.texts).toEqual(["Enchant sound: §cOFF", "Enchant sound: §cOFF§r, enchant message: §aON"]);
  });

  it("message on/off is idempotent", () => {
    const reg = registered();
    const player = makePlayer();
    asPlayer(reg, player, "message", "off");
    expect(msg(asPlayer(reg, player, "message", "off"))).toBe(
      "Enchant message: §cOFF",
    );
    system.flushRuns();
    expect(player.props.get(PROP_NOTIFY)).toBe('{"sound":true,"message":false}');
    expect(msg(asPlayer(reg, player, "message", "on"))).toBe(
      "Enchant message: §aON",
    );
    system.flushRuns();
    expect(player.props.get(PROP_NOTIFY)).toBe('{"sound":true,"message":true}');
  });

  it("no value flips; two flips in the same tick cancel out", () => {
    const reg = registered();
    const player = makePlayer();
    expect(msg(asPlayer(reg, player, "message"))).toBe("Enchant message: §cOFF");
    system.flushRuns();
    expect(player.props.get(PROP_NOTIFY)).toBe('{"sound":true,"message":false}');
    expect(msg(asPlayer(reg, player, "sound"))).toBe("Enchant sound: §cOFF");
    expect(msg(asPlayer(reg, player, "sound"))).toBe("Enchant sound: §aON");
    system.flushRuns();
    expect(player.props.get(PROP_NOTIFY)).toBe('{"sound":true,"message":false}');
  });

  it("players are independent", () => {
    const reg = registered();
    const a = makePlayer({ name: "Alex" });
    const b = makePlayer({ name: "Steve" });
    asPlayer(reg, a, "sound", "off");
    system.flushRuns();
    expect(msg(asPlayer(reg, b, "status"))).toBe(bothOn);
    expect(b.props.has(PROP_NOTIFY)).toBe(false);
  });

  it.each([
    ["no source", {}],
    ["a zombie", { sourceEntity: new FakeEntity("minecraft:zombie") }],
    ["a command block", { sourceType: "Block", sourceBlock: { typeId: "minecraft:command_block" } }],
  ])("rejects %s", (_label, origin) => {
    const reg = registered();
    expect(reg.invoke(NOTIFY_COMMAND_NAME, origin, "sound", "off")).toEqual({
      status: CustomCommandStatus.Failure,
      message: "Only players can change Enchantaholic notifications.",
    });
    system.flushRuns();
    expect(world.messages).toHaveLength(0);
  });

  it("an undefined or unknown target returns the usage", () => {
    const reg = registered();
    const player = makePlayer();
    const usage = {
      status: CustomCommandStatus.Failure,
      message: "Usage: /enchantaholic:notify <sound|message|status> [on|off]",
    };
    expect(asPlayer(reg, player)).toEqual(usage);
    expect(asPlayer(reg, player, "volume")).toEqual(usage);
    expect(handleNotify({ sourceEntity: asReal<mc.Entity>(player) }, undefined, "off")).toEqual({
      status: CustomCommandStatus.Failure,
    });
    expect(player.texts.at(-1)).toBe(usage.message);
    system.flushRuns();
    expect(player.props.has(PROP_NOTIFY)).toBe(false);
    expect(world.messages).toHaveLength(0);
  });
});

describe("custom command", () => {
  beforeEach(() => void resetAll());

  const msg = (r: unknown) => (r as mc.CustomCommandResult).message;
  const ON = "Custom Enchantments are now §aON§r for this world";
  const OFF = "Custom Enchantments are now §cOFF§r for this world";

  it("is registered last, for game directors, cheats off, with a mandatory state enum (no new enum)", () => {
    const reg = registered();
    expect([...reg.commands.keys()]).toEqual([COMMAND_NAME, NOTIFY_COMMAND_NAME, CUSTOM_COMMAND_NAME]);
    expect([...reg.enums.keys()]).toEqual([COMMAND_ENUM, NOTIFY_TARGET_ENUM, NOTIFY_SWITCH_ENUM]);
    const cmd = reg.commands.get(CUSTOM_COMMAND_NAME)?.command;
    expect(cmd?.permissionLevel).toBe(CommandPermissionLevel.GameDirectors);
    expect(cmd?.cheatsRequired).toBe(false);
    expect(cmd?.mandatoryParameters).toEqual([{ name: COMMAND_ENUM, type: CustomCommandParamType.Enum }]);
    expect(cmd?.optionalParameters ?? []).toEqual([]);
  });

  it("status is OFF by default and does not write", () => {
    const reg = registered();
    expect(reg.invoke(CUSTOM_COMMAND_NAME, {}, "status")).toEqual({
      status: CustomCommandStatus.Success,
      message: "Custom Enchantments: §cOFF",
    });
    system.flushRuns();
    expect(world.props.has(PROP_CUSTOM_ENABLED)).toBe(false);
    expect(world.messages).toHaveLength(0);
  });

  it("on is deferred to system.run (restricted-safe) and broadcast afterwards", () => {
    const reg = registered();
    expect(reg.invoke(CUSTOM_COMMAND_NAME, {}, "on")).toEqual({ status: CustomCommandStatus.Success, message: ON });
    expect(world.props.has(PROP_CUSTOM_ENABLED)).toBe(false);
    expect(world.messages).toHaveLength(0);
    expect(msg(reg.invoke(CUSTOM_COMMAND_NAME, {}, "status"))).toBe("Custom Enchantments: §aON");
    system.flushRuns();
    expect(world.getDynamicProperty(PROP_CUSTOM_ENABLED)).toBe(true);
    expect(isCustomEnabled()).toBe(true);
    expect(world.texts).toEqual([ON]);
    expect(isEnabled()).toBe(true); // the mode is untouched
  });

  it("off after on in the same tick: status reflects the pending value, last write wins", () => {
    const reg = registered();
    reg.invoke(CUSTOM_COMMAND_NAME, {}, "on");
    expect(msg(reg.invoke(CUSTOM_COMMAND_NAME, {}, "off"))).toBe(OFF);
    expect(msg(reg.invoke(CUSTOM_COMMAND_NAME, {}, "status"))).toBe("Custom Enchantments: §cOFF");
    system.flushRuns();
    expect(isCustomEnabled()).toBe(false);
    expect(world.getDynamicProperty(PROP_CUSTOM_ENABLED)).toBe(false);
    expect(world.texts).toEqual([ON, OFF]);
  });

  it("undefined or unknown argument → Failure with usage, nothing written", () => {
    const reg = registered();
    const usage = { status: CustomCommandStatus.Failure, message: "Usage: /enchantaholic:custom <on|off|status>" };
    expect(reg.invoke(CUSTOM_COMMAND_NAME, {})).toEqual(usage);
    expect(reg.invoke(CUSTOM_COMMAND_NAME, {}, "maybe")).toEqual(usage);
    expect(handleCustom(undefined)).toEqual(usage);
    system.flushRuns();
    expect(world.props.has(PROP_CUSTOM_ENABLED)).toBe(false);
    expect(world.messages).toHaveLength(0);
  });

  it("turning customs on while the mode is off adds a hint to the reply only", () => {
    const reg = registered();
    reg.invoke(COMMAND_NAME, {}, "off");
    const m = msg(reg.invoke(CUSTOM_COMMAND_NAME, {}, "on")) ?? "";
    expect(m.startsWith(`${ON}\n`)).toBe(true);
    expect(m).toContain("/enchantaholic:toggle on");
    system.flushRuns();
    expect(world.texts).toEqual(["Enchantaholic Mode: §cOFF", ON]);
    expect(msg(reg.invoke(CUSTOM_COMMAND_NAME, {}, "off"))).toBe(OFF);
  });
});


describe("localized replies", () => {
  beforeEach(() => void resetAll());

  it("a player caller gets translatable RawMessages (rendered per client language), no string message", () => {
    const reg = registered();
    const p = makePlayer();
    const r = reg.invoke(COMMAND_NAME, { sourceEntity: p }, "status") as mc.CustomCommandResult;
    expect(r).toEqual({ status: CustomCommandStatus.Success });
    expect(p.messages).toEqual([
      { translate: "enchantaholic.mode.status", with: { rawtext: [{ translate: "enchantaholic.state.on" }] } },
    ]);
    expect(renderRaw(p.messages[0], "ru")).toBe("Режим Enchantaholic: §aВкл");
    reg.invoke(NOTIFY_COMMAND_NAME, { sourceEntity: p }, "sound", "off");
    expect(renderRaw(p.messages[1], "ru")).toBe("Звук зачарования: §cВыкл");
    reg.invoke(NOTIFY_COMMAND_NAME, { sourceEntity: p });
    expect(renderRaw(p.messages[2], "ru")).toBe("Использование: /enchantaholic:notify <sound|message|status> [on|off]");
  });

  it("toggle and custom by a player: reply to the player, translatable broadcast to everyone", () => {
    const reg = registered();
    const p = makePlayer();
    reg.invoke(COMMAND_NAME, { sourceEntity: p }, "off");
    expect(p.texts).toEqual(["Enchantaholic Mode: §cOFF"]);
    const r = reg.invoke(CUSTOM_COMMAND_NAME, { sourceEntity: p }, "on") as mc.CustomCommandResult;
    expect(r.message).toBeUndefined();
    expect(p.texts[1]).toMatch(/^Custom Enchantments are now §aON§r for this world\n§7\(Enchantaholic Mode is §cOFF/);
    expect(renderRaw(p.messages[1], "ru")).toMatch(/^Особые зачарования теперь §aВкл§r в этом мире\n§7\(Режим Enchantaholic §cВыкл/);
    system.flushRuns();
    expect(world.messages.every((m) => typeof m === "object")).toBe(true);
    expect(world.messages.map((m) => renderRaw(m, "ru"))).toEqual([
      "Режим Enchantaholic: §cВыкл",
      "Особые зачарования теперь §aВкл§r в этом мире",
    ]);
  });

  it("falls back to the English string when sending to the player throws", () => {
    const reg = registered();
    const p = makePlayer();
    vi.spyOn(p, "sendMessage").mockImplementation(() => {
      throw new Error("gone");
    });
    expect(reg.invoke(COMMAND_NAME, { sourceEntity: p }, "status")).toEqual({
      status: CustomCommandStatus.Success,
      message: "Enchantaholic Mode: §aON",
    });
  });
});
