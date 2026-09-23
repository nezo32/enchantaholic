import { beforeEach, describe, expect, it } from "vitest";
import { armorItems, collectSlots, mainhandItem, offhandItem } from "../../src/adapters/inventory";
import { asPlayer, boots, dirt, helmet, makePlayer, shield, sword } from "../fakes/builders";
import { EquipmentSlot } from "../fakes/minecraft-server";
import { resetAll } from "./helpers";

describe("inventory", () => {
  beforeEach(() => void resetAll());

  it("exposes 36 inventory + 5 equipment handles and never Mainhand", () => {
    const handles = collectSlots(asPlayer(makePlayer()));
    expect(handles).toHaveLength(41);
    expect(handles.filter((h) => h.key.kind === "inv")).toHaveLength(36);
    const equip = handles.flatMap((h) => (h.key.kind === "equip" ? [h.key.slot] : []));
    expect(equip).toEqual(["Head", "Chest", "Legs", "Feet", "Offhand"]);
    expect(equip).not.toContain("Mainhand");
  });

  it("reads copies and writes inventory handles through container.setItem", () => {
    const p = makePlayer({ inv: { 7: sword() } });
    const h = collectSlots(asPlayer(p)).find((x) => x.key.kind === "inv" && x.key.index === 7);
    const item = h?.read();
    expect(item?.typeId).toBe("minecraft:diamond_sword");
    item!.nameTag = "Renamed";
    expect(p.container.peek(7)?.nameTag).toBeUndefined(); // copy semantics
    h?.write(item);
    expect(p.container.writes).toEqual([{ slot: 7, item }]);
    expect(p.container.peek(7)?.nameTag).toBe("Renamed");
  });

  it("writes equipment handles through setEquipment and throws when rejected", () => {
    const p = makePlayer({ equip: { Feet: boots() } });
    const h = collectSlots(asPlayer(p)).find((x) => x.key.kind === "equip" && x.key.slot === "Feet");
    const item = h?.read();
    h?.write(item);
    expect(p.equippable.writes).toEqual([{ slot: EquipmentSlot.Feet, item }]);
    p.equippable.rejectWrites = true;
    expect(() => h?.write(item)).toThrow(/rejected/);
  });

  it("mainhandItem uses selectedSlotIndex", () => {
    const p = makePlayer({ selected: 3, inv: { 0: dirt(), 3: sword() } });
    expect(mainhandItem(asPlayer(p))?.typeId).toBe("minecraft:diamond_sword");
    p.selectedSlotIndex = 0;
    expect(mainhandItem(asPlayer(p))?.typeId).toBe("minecraft:dirt");
  });

  it("armorItems returns non-empty armor only; offhandItem reads Offhand", () => {
    const p = makePlayer({ equip: { Head: helmet(), Feet: boots(), Offhand: shield() } });
    expect(armorItems(asPlayer(p)).map((i) => i.typeId)).toEqual(["minecraft:diamond_helmet", "minecraft:diamond_boots"]);
    expect(offhandItem(asPlayer(p))?.typeId).toBe("minecraft:shield");
  });
});
