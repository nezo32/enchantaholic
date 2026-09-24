import { EntityComponentTypes, EquipmentSlot, type ItemStack, type Player } from "@minecraft/server";

export type EquipSlotName = "Head" | "Chest" | "Legs" | "Feet" | "Offhand";
export type SlotKey = { kind: "inv"; index: number } | { kind: "equip"; slot: EquipSlotName };

export interface SlotHandle {
  readonly key: SlotKey;
  read(): ItemStack | undefined;
  /** Writes the item back. Throws if the engine rejects it. */
  write(item: ItemStack | undefined): void;
}

/** Equipment slots that are candidates. Mainhand is excluded: it duplicates a hotbar slot (D5). */
const EQUIP_SLOTS: readonly EquipSlotName[] = ["Head", "Chest", "Legs", "Feet", "Offhand"];
const ARMOR_SLOTS: readonly EquipSlotName[] = ["Head", "Chest", "Legs", "Feet"];

function container(player: Player) {
  return player.getComponent(EntityComponentTypes.Inventory)?.container;
}

function equippable(player: Player) {
  return player.getComponent(EntityComponentTypes.Equippable);
}

/** Container slots 0..size-1 (36 for players) plus Head/Chest/Legs/Feet/Offhand. Never Mainhand. */
export function collectSlots(player: Player): SlotHandle[] {
  const out: SlotHandle[] = [];
  const c = container(player);
  if (c) {
    for (let i = 0; i < c.size; i++) {
      out.push({
        key: { kind: "inv", index: i },
        read: () => c.getItem(i),
        write: (item) => c.setItem(i, item),
      });
    }
  }
  const eq = equippable(player);
  if (eq) {
    for (const name of EQUIP_SLOTS) {
      const slot = EquipmentSlot[name];
      out.push({
        key: { kind: "equip", slot: name },
        read: () => eq.getEquipment(slot),
        write: (item) => {
          if (!eq.setEquipment(slot, item)) throw new Error(`setEquipment(${name}) rejected`);
        },
      });
    }
  }
  return out;
}

export function mainhandItem(player: Player): ItemStack | undefined {
  return container(player)?.getItem(player.selectedSlotIndex);
}

/** Non-empty Head/Chest/Legs/Feet items. */
export function armorItems(player: Player): ItemStack[] {
  const eq = equippable(player);
  if (!eq) return [];
  const out: ItemStack[] = [];
  for (const name of ARMOR_SLOTS) {
    const item = eq.getEquipment(EquipmentSlot[name]);
    if (item) out.push(item);
  }
  return out;
}

export function offhandItem(player: Player): ItemStack | undefined {
  return equippable(player)?.getEquipment(EquipmentSlot.Offhand);
}
