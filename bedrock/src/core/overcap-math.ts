import { HASTE_MAX_AMPLIFIER } from "./config";

/** All bonuses scale with overcap levels only (true level − maxLevel). */
export const SHARPNESS_PER_LEVEL = 1.25;
export const SMITE_PER_LEVEL = 2.5;
export const BANE_PER_LEVEL = 2.5;
export const POWER_REL_PER_LEVEL = 0.1;
export const EPF_TO_REDUCTION = 0.04;

export interface MeleeOver {
  sharpness: number;
  smite: number;
  bane: number;
}

const pos = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

export function meleeBonus(over: MeleeOver, target: { undead: boolean; arthropod: boolean }): number {
  let bonus = pos(over.sharpness) * SHARPNESS_PER_LEVEL;
  if (target.undead) bonus += pos(over.smite) * SMITE_PER_LEVEL;
  if (target.arthropod) bonus += pos(over.bane) * BANE_PER_LEVEL;
  return bonus;
}

/** 1 + 0.10 × over. */
export function powerMultiplier(over: number): number {
  return 1 + POWER_REL_PER_LEVEL * pos(over);
}

/** over ≤ 0 → undefined; else min(over − 1, HASTE_MAX_AMPLIFIER). */
export function hasteAmplifier(over: number): number | undefined {
  if (!(over > 0)) return undefined;
  return Math.max(0, Math.min(Math.floor(over) - 1, HASTE_MAX_AMPLIFIER));
}

export interface ProtectionRule {
  id: string;
  epfPerLevel: number;
  causes: ReadonlySet<string> | "all";
}

export const PROTECTION_RULES: readonly ProtectionRule[] = [
  { id: "minecraft:protection", epfPerLevel: 1, causes: "all" },
  {
    id: "minecraft:fire_protection",
    epfPerLevel: 2,
    causes: new Set(["fire", "fireTick", "lava", "campfire", "soulCampfire", "magma"]),
  },
  {
    id: "minecraft:blast_protection",
    epfPerLevel: 2,
    causes: new Set(["blockExplosion", "entityExplosion", "fireworks"]),
  },
  { id: "minecraft:projectile_protection", epfPerLevel: 2, causes: new Set(["projectile"]) },
  { id: "minecraft:feather_falling", epfPerLevel: 3, causes: new Set(["fall"]) },
];

export const PROTECTION_EXCLUDED_CAUSES: ReadonlySet<string> = new Set([
  "override",
  "selfDestruct",
  "starve",
  "none",
  "sonicBoom",
]);

/** Σ over × epf of matching rules; 0 if the cause is excluded. */
export function overEpfForCause(cause: string, overById: ReadonlyMap<string, number>): number {
  if (PROTECTION_EXCLUDED_CAUSES.has(cause)) return 0;
  let total = 0;
  for (const rule of PROTECTION_RULES) {
    if (rule.causes !== "all" && !rule.causes.has(cause)) continue;
    total += pos(overById.get(rule.id) ?? 0) * rule.epfPerLevel;
  }
  return total;
}

/** 1 / (1 + 0.04 × overEpf): smooth, never 0. */
export function protectionFactor(overEpf: number): number {
  return 1 / (1 + EPF_TO_REDUCTION * pos(overEpf));
}
