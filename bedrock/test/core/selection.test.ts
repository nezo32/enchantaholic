import { describe, expect, it } from "vitest";
import type { EnchantInfo } from "../../src/core/eligibility";
import { CUSTOM_ENCHANTS } from "../../src/core/custom/roster";
import { mulberry32 } from "../../src/core/rng";
import { iteratePlans, type ItemProbe, type SlotCandidate } from "../../src/core/selection";

const E = (id: string, maxLevel = 5): EnchantInfo => ({ id: `minecraft:${id}`, maxLevel });
const SHARP = E("sharpness");
const SMITE = E("smite");
const UNBREAKING = E("unbreaking", 3);
const LUNGE = E("lunge", 3);
const PROT = E("protection", 4);
const ALL = [SHARP, SMITE, UNBREAKING, LUNGE, PROT];

interface ProbeSpec {
  typeId?: string;
  enchantable?: boolean;
  levels?: Record<string, number>;
  compatible?: string[];
  throwOn?: string[];
  customs?: Record<string, number>;
}

function probe(spec: ProbeSpec = {}): ItemProbe & { canAddCalls: string[] } {
  const canAddCalls: string[] = [];
  return {
    ...(spec.customs ? { customLevel: (id: string) => spec.customs?.[id] ?? 0 } : {}),
    typeId: spec.typeId ?? "minecraft:diamond_sword",
    enchantable: spec.enchantable ?? true,
    canAddCalls,
    trueLevel: (id) => spec.levels?.[id] ?? 0,
    canAddFresh: (id) => {
      canAddCalls.push(id);
      return (spec.compatible ?? []).includes(id);
    },
  };
}

const slot = <K>(key: K, item: ItemProbe): SlotCandidate<K> => ({ key, item });

describe("iteratePlans", () => {
  it("(a) yields nothing when only non-enchantable slots exist", () => {
    const plans = [...iteratePlans([slot("dirt", probe({ enchantable: false, typeId: "minecraft:dirt" }))], ALL, mulberry32(1))];
    expect(plans).toEqual([]);
  });

  it("yields nothing for no slots or no enchants", () => {
    expect([...iteratePlans([], ALL, mulberry32(1))]).toEqual([]);
    expect([...iteratePlans([slot("s", probe({ compatible: ["minecraft:sharpness"] }))], [], mulberry32(1))]).toEqual([]);
  });

  it("(b) a dirt slot falls back to the sword slot", () => {
    for (let seed = 0; seed < 200; seed++) {
      const slots = [
        slot("dirt", probe({ enchantable: false, typeId: "minecraft:dirt" })),
        slot("sword", probe({ compatible: ["minecraft:sharpness"] })),
      ];
      const first = iteratePlans(slots, ALL, mulberry32(seed)).next();
      expect(first.done).toBe(false);
      expect(first.value?.key).toBe("sword");
    }
  });

  it("an enchantable item with nothing compatible falls through to the next slot", () => {
    for (let seed = 0; seed < 100; seed++) {
      const slots = [
        slot("full", probe({ compatible: [] })),
        slot("boots", probe({ typeId: "minecraft:iron_boots", compatible: ["minecraft:protection"] })),
      ];
      const plans = [...iteratePlans(slots, ALL, mulberry32(seed))];
      expect(plans.map((p) => [p.key, p.enchant.id])).toEqual([["boots", "minecraft:protection"]]);
    }
  });

  it("(c) a sword with only sharpness compatible always gets sharpness I", () => {
    for (let seed = 0; seed < 200; seed++) {
      const plans = [...iteratePlans([slot(0, probe({ compatible: ["minecraft:sharpness"] }))], ALL, mulberry32(seed))];
      expect(plans).toEqual([{ key: 0, enchant: SHARP, fromLevel: 0, toLevel: 1 }]);
    }
  });

  it("(d) an enchant already on the item is chosen even though canAddFresh is false", () => {
    const item = probe({ levels: { "minecraft:smite": 7 }, compatible: [] });
    const plans = [...iteratePlans([slot("s", item)], ALL, mulberry32(3))];
    expect(plans).toEqual([{ key: "s", enchant: SMITE, fromLevel: 7, toLevel: 8 }]);
    expect(item.canAddCalls).not.toContain("minecraft:smite");
  });

  it("(e) lunge is never proposed for a sword over 1k seeds, but is for a spear", () => {
    const everything = ALL.map((e) => e.id);
    let spearLunge = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const swordPlans = [...iteratePlans([slot("s", probe({ compatible: everything }))], ALL, mulberry32(seed))];
      expect(swordPlans.some((p) => p.enchant.id === LUNGE.id)).toBe(false);
      const spearFirst = iteratePlans(
        [slot("sp", probe({ typeId: "minecraft:iron_spear", compatible: everything }))],
        ALL,
        mulberry32(seed),
      ).next().value;
      if (spearFirst?.enchant.id === LUNGE.id) spearLunge++;
    }
    expect(spearLunge).toBeGreaterThan(100); // ≈ 1/5 of 1000
  });

  it("(f) visits each (slot, enchant) pair at most once and each slot contiguously", () => {
    const everything = ALL.map((e) => e.id);
    for (let seed = 0; seed < 50; seed++) {
      const slots = [0, 1, 2].map((k) => slot(k, probe({ compatible: everything })));
      const plans = [...iteratePlans(slots, ALL, mulberry32(seed))];
      const pairs = plans.map((p) => `${p.key}/${p.enchant.id}`);
      expect(new Set(pairs).size).toBe(pairs.length);
      expect(plans).toHaveLength(3 * 4); // lunge excluded for swords
      const keyOrder = plans.map((p) => p.key).filter((k, i, a) => i === 0 || a[i - 1] !== k);
      expect(keyOrder).toHaveLength(3);
    }
  });

  it("probes lazily: stopping after the first plan makes few canAddFresh calls", () => {
    const item = probe({ compatible: ALL.map((e) => e.id) });
    const gen = iteratePlans([slot("s", item)], ALL, mulberry32(5));
    gen.next();
    expect(item.canAddCalls).toHaveLength(1);
  });

  it("(g) uniform among 3 compatible enchants (≈1/3 each over 30k seeds)", () => {
    const counts = new Map<string, number>();
    const compat = [SHARP.id, UNBREAKING.id, PROT.id];
    for (let seed = 0; seed < 30_000; seed++) {
      const p = iteratePlans([slot("s", probe({ compatible: compat }))], ALL, mulberry32(seed)).next().value;
      if (p) counts.set(p.enchant.id, (counts.get(p.enchant.id) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...compat].sort());
    for (const c of counts.values()) expect(Math.abs(c / 30_000 - 1 / 3)).toBeLessThan(0.02);
  });

  it("slot choice is uniform among non-empty slots", () => {
    const counts = [0, 0, 0, 0];
    for (let seed = 0; seed < 20_000; seed++) {
      const slots = [0, 1, 2, 3].map((k) => slot(k, probe({ compatible: [SHARP.id] })));
      counts[iteratePlans(slots, ALL, mulberry32(seed)).next().value!.key]! += 1;
    }
    for (const c of counts) expect(Math.abs(c / 20_000 - 0.25)).toBeLessThan(0.02);
  });

  it("(h) same seed gives the same plan sequence", () => {
    const run = (seed: number) =>
      [...iteratePlans([0, 1, 2].map((k) => slot(k, probe({ compatible: ALL.map((e) => e.id) }))), ALL, mulberry32(seed))].map(
        (p) => `${p.key}/${p.enchant.id}`,
      );
    expect(run(77)).toEqual(run(77));
    expect(run(77)).not.toEqual(run(78));
  });

  it("does not mutate its inputs", () => {
    const slots = Object.freeze([slot("a", probe({ compatible: [SHARP.id] })), slot("b", probe({ compatible: [SHARP.id] }))]);
    const enchants = Object.freeze([...ALL]);
    Array.from(iteratePlans(slots, enchants, mulberry32(1)));
    expect(slots).toHaveLength(2);
    expect(enchants).toHaveLength(ALL.length);
  });
});

describe("iteratePlans with custom enchants", () => {
  const everything = ALL.map((e) => e.id);
  const seq = (plans: Iterable<{ key: unknown; enchant: EnchantInfo; fromLevel: number }>) =>
    [...plans].map((p) => `${String(p.key)}/${p.enchant.id}/${p.fromLevel}`);

  it("empty customs gives the same outputs as without the argument (golden)", () => {
    for (const seed of [1, 7, 77, 1234]) {
      const slots = (): SlotCandidate<string>[] => [
        slot("dirt", probe({ enchantable: false, typeId: "minecraft:dirt" })),
        ...["0", "1", "2"].map((k) => slot(k, probe({ compatible: everything, levels: { "minecraft:smite": 6 } }))),
      ];
      expect(seq(iteratePlans(slots(), ALL, mulberry32(seed), []))).toEqual(seq(iteratePlans(slots(), ALL, mulberry32(seed))));
    }
    const golden = seq(iteratePlans([0, 1].map((k) => slot(k, probe({ compatible: [SHARP.id, PROT.id] }))), ALL, mulberry32(42), []));
    expect(golden).toHaveLength(4);
    expect(golden.every((s) => /^[01]\/minecraft:(sharpness|protection)\/0$/.test(s))).toBe(true);
  });

  it("a dirt-only inventory yields custom plans only (every custom, once)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const plans = [
        ...iteratePlans([slot("dirt", probe({ enchantable: false, typeId: "minecraft:dirt" }))], ALL, mulberry32(seed), CUSTOM_ENCHANTS),
      ];
      expect(plans).toHaveLength(CUSTOM_ENCHANTS.length);
      expect(plans.every((p) => p.enchant.custom === true && p.key === "dirt")).toBe(true);
      expect(new Set(plans.map((p) => p.enchant.id)).size).toBe(CUSTOM_ENCHANTS.length);
    }
  });

  it("fromLevel comes from customLevel (missing customLevel = 0)", () => {
    const withLevels = probe({ enchantable: false, customs: { "enchantaholic:magnet": 4 } });
    const plans = [...iteratePlans([slot("s", withLevels)], [], mulberry32(3), CUSTOM_ENCHANTS)];
    const magnet = plans.find((p) => p.enchant.id === "enchantaholic:magnet");
    expect(magnet).toMatchObject({ fromLevel: 4, toLevel: 5 });
    expect(plans.filter((p) => p.enchant.id !== "enchantaholic:magnet").every((p) => p.fromLevel === 0 && p.toLevel === 1)).toBe(true);
    const bare = probe({ enchantable: false });
    const first = iteratePlans([slot("b", bare)], [], mulberry32(3), CUSTOM_ENCHANTS).next().value;
    expect(first).toMatchObject({ fromLevel: 0, toLevel: 1 });
  });

  it("customs are yielded without canAddFresh calls", () => {
    const item = probe({ compatible: [] });
    const plans = [...iteratePlans([slot("s", item)], ALL, mulberry32(9), CUSTOM_ENCHANTS)];
    expect(plans.every((p) => p.enchant.custom)).toBe(true);
    expect(item.canAddCalls.some((id) => id.startsWith("enchantaholic:"))).toBe(false);
  });

  it("customs and vanilla share the pool with equal weight (mulberry32)", () => {
    const compat = [SHARP.id, UNBREAKING.id, PROT.id];
    let custom = 0;
    const N = 20_000;
    for (let seed = 0; seed < N; seed++) {
      const p = iteratePlans([slot("s", probe({ compatible: compat }))], ALL, mulberry32(seed), CUSTOM_ENCHANTS).next().value;
      if (p?.enchant.custom) custom++;
    }
    // Pool: 4 vanilla (smite is not addable → skipped) + 11 customs, equally weighted, so the first
    // yielded plan is custom with probability 11 / (3 addable vanilla + 11 customs).
    expect(Math.abs(custom / N - 11 / 14)).toBeLessThan(0.02);
  });
});

