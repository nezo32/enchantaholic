/**
 * Fidelity of the fake @minecraft/server against the real 2.10.0 typings (index.d.ts), plus
 * privilege checks: we cannot run the game, so the fake must not be more permissive than it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { PROTECTION_EXCLUDED_CAUSES, PROTECTION_RULES } from "../../src/core/overcap-math";
import * as fake from "../fakes/minecraft-server";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DTS = path.join(ROOT, "node_modules/@minecraft/server/index.d.ts");
const dtsText = fs.readFileSync(DTS, "utf8");
const sf = ts.createSourceFile("index.d.ts", dtsText, ts.ScriptTarget.Latest, true);

interface Member {
  privileges: string[];
}
const members = new Map<string, Member>();
const enums = new Map<string, Map<string, string | number>>();

sf.forEachChild((node) => {
  if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name) {
    for (const m of node.members) {
      if (!m.name) continue;
      const doc = m.getFullText(sf).slice(0, m.getLeadingTriviaWidth(sf));
      const privileges = [...doc.matchAll(/@privilege ([\w-]+)/g)].map((x) => x[1] as string);
      members.set(`${node.name.text}.${m.name.getText(sf).replace(/'/g, "")}`, { privileges });
    }
  }
  if (ts.isEnumDeclaration(node)) {
    const values = new Map<string, string | number>();
    for (const m of node.members) {
      const init = m.initializer;
      let v: string | number = m.name.getText(sf);
      if (init && ts.isStringLiteral(init)) v = init.text;
      else if (init && ts.isNumericLiteral(init)) v = Number(init.text);
      values.set(m.name.getText(sf), v);
    }
    enums.set(node.name.text, values);
  }
});

function srcFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? srcFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}
const adapterSrc = [...srcFiles(path.join(ROOT, "src/adapters")), path.join(ROOT, "src/main.ts")]
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");

describe("fake @minecraft/server vs real 2.10.0 typings", () => {
  it("parses the real typings", () => {
    expect(dtsText).toMatch(/"module_name": "@minecraft\/server",[\s*]*"version": "2\.10\.0"/);
    expect(members.size).toBeGreaterThan(1000);
    expect(dtsText).not.toMatch(/@beta/);
  });

  const FAKE_ENUMS: Record<string, Record<string, string | number>> = {
    EquipmentSlot: fake.EquipmentSlot,
    GameMode: fake.GameMode,
    EntityComponentTypes: fake.EntityComponentTypes,
    ItemComponentTypes: fake.ItemComponentTypes,
    CommandPermissionLevel: fake.CommandPermissionLevel,
    CustomCommandStatus: fake.CustomCommandStatus,
    CustomCommandParamType: fake.CustomCommandParamType,
    CustomCommandSource: fake.CustomCommandSource,
    EntityDamageCause: fake.EntityDamageCause,
    EntityInitializationCause: fake.EntityInitializationCause,
  };
  for (const [name, values] of Object.entries(FAKE_ENUMS)) {
    it(`enum ${name}: every fake member exists with the same value`, () => {
      const real = enums.get(name);
      expect(real, name).toBeDefined();
      for (const [k, v] of Object.entries(values)) {
        if (/^\d+$/.test(k)) continue; // TS numeric reverse mapping
        expect(real!.get(k), `${name}.${k}`).toBe(v);
      }
    });
  }

  it("damage causes used by the protection rules are real EntityDamageCause values", () => {
    const real = new Set(enums.get("EntityDamageCause")!.values());
    const used = [
      ...PROTECTION_EXCLUDED_CAUSES,
      ...PROTECTION_RULES.flatMap((r) => (r.causes === "all" ? [] : [...r.causes])),
      "entityAttack",
      "projectile",
    ];
    for (const c of used) expect(real.has(c), c).toBe(true);
  });

  it("every enum member referenced by adapters exists in the real typings", () => {
    const refs = [...adapterSrc.matchAll(/\b(EquipmentSlot|GameMode|EntityComponentTypes|ItemComponentTypes|CommandPermissionLevel|CustomCommandStatus|CustomCommandParamType|EntityDamageCause)\.(\w+)/g)];
    expect(refs.length).toBeGreaterThan(5);
    for (const [, e, m] of refs) expect(enums.get(e as string)?.has(m as string), `${e}.${m}`).toBe(true);
  });

  it("fake privilege lists match the real @privilege tags", () => {
    for (const api of fake.NO_RESTRICTED_APIS) {
      expect(members.get(api)?.privileges, api).toContain("no-restricted-execution");
    }
    for (const api of fake.EARLY_FORBIDDEN_APIS) {
      const m = members.get(api);
      expect(m, api).toBeDefined();
      expect(m!.privileges, api).not.toContain("early-execution-allowed");
    }
  });

  it("the fake enforces every no-restricted-execution method the adapters call", () => {
    const called = new Set([...adapterSrc.matchAll(/\.(\w+)\s*\(/g)].map((m) => m[1] as string));
    const restrictedNames = new Set(
      [...members].filter(([, m]) => m.privileges.includes("no-restricted-execution")).map(([k]) => k.split(".")[1] as string),
    );
    const enforced = new Set([...fake.NO_RESTRICTED_APIS].map((k) => k.split(".")[1] as string));
    enforced.add("subscribe").add("unsubscribe"); // enforced generically by FakeSignal
    const missing = [...called].filter((n) => restrictedNames.has(n) && !enforced.has(n));
    // Same-named methods exist on unrelated restricted classes (or are JS builtins: Map/Set/Array/
    // iterator); allow-list those that are not restricted on the object the adapters call them on.
    const notRestrictedOnOurClass = new Set(["get", "getItem", "run", "runInterval", "getComponent", "set", "has", "delete", "add", "setDynamicProperty", "next", "clear", "push"]);
    expect(missing.filter((n) => !notRestrictedOnOurClass.has(n))).toEqual([]);
  });

  it("world/system APIs used during early execution are early-execution-allowed", () => {
    for (const api of [
      "SystemBeforeEvents.startup",
      "WorldAfterEvents.worldLoad",
      "StartupBeforeEventSignal.subscribe",
      "WorldLoadAfterEventSignal.subscribe",
      "CustomCommandRegistry.registerCommand",
      "CustomCommandRegistry.registerEnum",
    ]) {
      const p = members.get(api)?.privileges ?? [];
      expect(p.some((x) => x.startsWith("early-execution")), api).toBe(true);
    }
  });

  it("the APIs the adapters rely on exist in 2.10.0", () => {
    for (const api of [
      "WorldAfterEvents.playerBreakBlock",
      "WorldAfterEvents.entitySpawn",
      "WorldAfterEvents.entityRemove",
      "WorldBeforeEvents.entityHurt",
      "EntityHurtBeforeEvent.damage",
      "EntityDamageSource.damagingProjectile",
      "PlayerBreakBlockAfterEvent.brokenBlockPermutation",
      "BlockPermutation.type",
      "EnchantmentTypes.getAll",
      "ItemEnchantableComponent.canAddEnchantment",
      "EntityProjectileComponent.owner",
      "EntityTypeFamilyComponent.hasTypeFamily",
      "EntityRemoveAfterEvent.removedEntityId",
      "EntityEventOptions.entityTypes",
      "Player.selectedSlotIndex",
      "ItemStack.isStackable",
      "Dimension.getBlock",
      "Dimension.getEntities",
      "Dimension.runCommand",
      "Dimension.spawnEntity",
      "Dimension.spawnItem",
      "Dimension.createExplosion",
      "Block.center",
      "Block.isLiquid",
      "Entity.applyKnockback",
      "Entity.getHeadLocation",
      "EntityItemComponent.itemStack",
      "EntityProjectileComponent.shoot",
      "ItemDurabilityComponent.damage",
      "ItemDurabilityComponent.maxDurability",
      "PlayerBreakBlockAfterEvent.itemStackBeforeBreak",
      "WorldAfterEvents.projectileHitBlock",
      "WorldAfterEvents.projectileHitEntity",
      "WorldAfterEvents.entityHitEntity",
      "WorldAfterEvents.entityDie",
      "World.getDimension",
    ]) {
      expect(members.has(api), api).toBe(true);
    }
  });
});

describe("fake privilege simulation", () => {
  it("rejects restricted APIs inside before-events and command callbacks", () => {
    fake.resetFakes();
    const item = new fake.FakeItemStack("minecraft:diamond_sword");
    const errors: unknown[] = [];
    fake.world.beforeEvents.entityHurt.subscribe(() => {
      try {
        item.setLore(["x"]);
      } catch (e) {
        errors.push(e);
      }
    });
    fake.world.beforeEvents.entityHurt.emit({});
    expect(errors[0]).toBeInstanceOf(fake.FakePrivilegeError);
    expect(fake._execMode()).toBe("normal");
  });

  it("rejects world reads during early execution", () => {
    fake.resetFakes();
    expect(() => fake._withExecMode("early", () => fake.world.getDynamicProperty("x"))).toThrow(fake.FakePrivilegeError);
    expect(() => fake._withExecMode("early", () => fake.EnchantmentTypes.getAll())).toThrow(fake.FakePrivilegeError);
  });
});

describe("fake world simulation (custom enchantment support)", () => {
  it("dimensions: blocks, setblock destroy drops, entity spawn events and queries", () => {
    fake.resetFakes();
    const dim = fake.world.getDimension("overworld");
    expect(fake.world.getDimension("minecraft:overworld")).toBe(dim);
    dim.setBlock({ x: 1, y: 10, z: 1 }, "minecraft:iron_ore");
    expect(dim.getBlock({ x: 1.7, y: 10.2, z: 1 })?.typeId).toBe("minecraft:iron_ore");
    expect(dim.getBlock({ x: 0, y: -65, z: 0 })).toBeUndefined();
    dim.unloaded.add("5,5,5");
    expect(dim.getBlock({ x: 5, y: 5, z: 5 })).toBeUndefined();
    const spawned: unknown[] = [];
    fake.world.afterEvents.entitySpawn.subscribe((ev: { entity: unknown }) => spawned.push(ev.entity));
    expect(dim.runCommand("setblock 1 10 1 air destroy").successCount).toBe(1);
    expect(dim.typeAt({ x: 1, y: 10, z: 1 })).toBe("minecraft:air");
    const drop = spawned[0] as fake.FakeEntity;
    expect(drop.typeId).toBe("minecraft:item");
    expect((drop.getComponent("minecraft:item") as fake.FakeItemEntityComponent).itemStack.typeId).toBe("minecraft:iron_ore");
    expect(() => dim.runCommand("setblock 1 x 1 air")).toThrow();
    const arrow = dim.spawnEntity("minecraft:arrow", { x: 0, y: 64, z: 0 });
    expect(arrow.getComponent("minecraft:projectile")).toBeInstanceOf(fake.FakeProjectileComponent);
    expect(dim.getEntities({ type: "minecraft:arrow", location: { x: 0, y: 64, z: 3 }, maxDistance: 3 })).toEqual([arrow]);
    arrow.remove();
    expect(dim.getEntities({ type: "minecraft:arrow" })).toEqual([]);
  });

  it("new NR APIs are guarded, players reject impulses, and advance() runs timeouts/intervals by period", () => {
    fake.resetFakes();
    const dim = fake.world.getDimension("overworld");
    fake.world.beforeEvents.entityHurt.subscribe(() => {
      expect(() => dim.runCommand("say hi")).toThrow(fake.FakePrivilegeError);
      expect(() => new fake.FakeEntity("minecraft:cow").addTag("x")).toThrow(fake.FakePrivilegeError);
    });
    fake.world.beforeEvents.entityHurt.emit({});
    expect(() => new fake.FakePlayer().applyImpulse({ x: 0, y: 1, z: 0 })).toThrow(fake.FakeUnsupportedError);
    const log: string[] = [];
    fake.system.runTimeout(() => log.push("t3"), 3);
    fake.system.runInterval(() => log.push("i2"), 2);
    fake.system.run(() => log.push("r"));
    fake.system.advance(4);
    expect(log).toEqual(["r", "i2", "t3", "i2"]);
    expect(fake.system.currentTick).toBe(4);
  });
});

