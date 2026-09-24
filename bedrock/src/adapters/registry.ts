import { EnchantmentTypes, type EnchantmentType } from "@minecraft/server";
import type { EnchantInfo } from "../core/eligibility";
import { normalizeId } from "../core/ids";

export interface EnchantRegistry {
  /** Every registered enchantment type, ids normalized. */
  readonly all: readonly EnchantInfo[];
  /** Native EnchantmentType object for a (possibly un-namespaced) id. */
  type(id: string): EnchantmentType | undefined;
  maxLevel(id: string): number | undefined;
}

let instance: EnchantRegistry | undefined;

function build(): EnchantRegistry {
  const byId = new Map<string, EnchantmentType>();
  const all: EnchantInfo[] = [];
  for (const t of EnchantmentTypes.getAll()) {
    const id = normalizeId(t.id);
    if (byId.has(id)) continue;
    byId.set(id, t);
    all.push({ id, maxLevel: t.maxLevel });
  }
  return {
    all,
    type: (id) => byId.get(normalizeId(id)),
    maxLevel: (id) => byId.get(normalizeId(id))?.maxLevel,
  };
}

/** Lazy singleton, built on first use (never during early execution). */
export function getRegistry(): EnchantRegistry {
  instance ??= build();
  return instance;
}

/** Test helper. */
export function _resetRegistry(): void {
  instance = undefined;
}
