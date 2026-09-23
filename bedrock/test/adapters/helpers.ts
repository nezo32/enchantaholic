import { vi } from "vitest";
import { _resetWarnings } from "../../src/adapters/log";
import { _resetRegistry } from "../../src/adapters/registry";
import { _resetStateCache } from "../../src/adapters/state";
import { _resetShots } from "../../src/adapters/effects/power";
import { _resetPendingToggle } from "../../src/adapters/command";
import { PROP_LEVELS } from "../../src/core/config";
import { displayName } from "../../src/core/enchant-names";
import { encodeLoreLine } from "../../src/core/lore";
import { makeItem, type ItemSpec } from "../fakes/builders";
import { resetFakes, type FakeItemStack } from "../fakes/minecraft-server";

/** Reset every fake and adapter cache; silence (and expose) content-log warnings. */
export function resetAll() {
  resetFakes();
  _resetStateCache();
  _resetRegistry();
  _resetWarnings();
  _resetShots();
  _resetPendingToggle();
  return vi.spyOn(console, "warn").mockImplementation(() => undefined);
}

export const levelsProp = (levels: Record<string, number>): Record<string, string> => ({
  [PROP_LEVELS]: JSON.stringify(levels),
});

export const loreLine = (id: string, level: number): string => encodeLoreLine(displayName(id), level);

/** A non-stackable item with `id` at vanilla max and a stored true level (dynprop + lore). */
export function overcapped(
  typeId: string,
  enchantId: string,
  max: number,
  trueLevel: number,
  spec: ItemSpec = {},
): FakeItemStack {
  return makeItem(typeId, {
    enchantable: { compatible: "all" },
    ...spec,
    levels: { [enchantId]: max, ...(spec.levels ?? {}) },
    props: levelsProp({ [enchantId]: trueLevel }),
    lore: [loreLine(enchantId, trueLevel)],
  });
}
