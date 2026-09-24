import { GameMode, world, type ItemStack, type Player, type PlayerBreakBlockAfterEvent } from "@minecraft/server";
import { MAX_APPLY_ATTEMPTS } from "../core/config";
import { CUSTOM_ENCHANTS, isCustomId } from "../core/custom/roster";
import type { EnchantInfo } from "../core/eligibility";
import { isInstabreak } from "../core/instabreak";
import { appliedLevel } from "../core/levels";
import { defaultRng, type Rng } from "../core/rng";
import { iteratePlans, type EnchantPlan, type SlotCandidate } from "../core/selection";
import { notifyEnchant } from "./feedback";
import { collectSlots, type SlotHandle } from "./inventory";
import { getEnchantable, makeProbe, readCustoms, readExtras, writeCustoms, writeExtras } from "./item-levels";
import { debug, safe, warnOnce } from "./log";
import { getRegistry, type EnchantRegistry } from "./registry";
import { isCustomEnabled, isEnabled } from "./state";

export interface EnchantResult {
  item: ItemStack;
  enchant: EnchantInfo;
  level: number;
}

/** Applies a custom-enchant plan (lore/dynprop only) and writes the item back. False when the write throws. */
export function applyCustomPlan(handle: SlotHandle, item: ItemStack, plan: EnchantPlan<SlotHandle>): boolean {
  const id = plan.enchant.id;
  if (!isCustomId(id)) return false;
  const customs = readCustoms(item);
  customs.set(id, plan.toLevel);
  writeCustoms(item, customs);
  try {
    handle.write(item); // ItemStack is a copy: write-back is mandatory
  } catch (err) {
    warnOnce("write", err);
    return false;
  }
  return true;
}

/**
 * Applies one plan to `item` and writes it back to its slot. Returns false (leaving the
 * vanilla enchantments as they were) when the engine refuses the change.
 */
export function applyPlan(
  handle: SlotHandle,
  item: ItemStack,
  plan: EnchantPlan<SlotHandle>,
  reg: EnchantRegistry,
): boolean {
  if (plan.enchant.custom) return applyCustomPlan(handle, item, plan);
  const ench = getEnchantable(item);
  if (!ench) return false;
  const id = plan.enchant.id;
  const type = reg.type(id);
  if (!type) return false;
  const max = reg.maxLevel(id) ?? plan.enchant.maxLevel;

  let cur: number;
  try {
    cur = ench.getEnchantment(type)?.level ?? 0;
  } catch {
    cur = 0;
  }
  const want = appliedLevel(plan.toLevel, max);
  if (want !== cur) {
    try {
      if (cur > 0) ench.removeEnchantment(type);
      ench.addEnchantment({ type, level: want });
    } catch {
      if (cur > 0) {
        try {
          if (!ench.getEnchantment(type)) ench.addEnchantment({ type, level: cur });
        } catch (err) {
          warnOnce("restore", err);
        }
      }
      return false;
    }
  }

  const extras = readExtras(item);
  if (plan.toLevel > max) extras.set(id, plan.toLevel);
  else extras.delete(id);
  writeExtras(item, ench, extras, reg);

  try {
    handle.write(item); // ItemStack is a copy: write-back is mandatory
  } catch (err) {
    warnOnce("write", err);
    return false;
  }
  return true;
}

/** Enchants a random eligible item of `player`; undefined when nothing could be enchanted. */
export function enchantRandomItem(player: Player, rng: Rng = defaultRng): EnchantResult | undefined {
  const reg = getRegistry();
  const items = new Map<SlotHandle, ItemStack>();
  const candidates: SlotCandidate<SlotHandle>[] = [];
  for (const handle of collectSlots(player)) {
    const item = handle.read();
    if (!item) continue;
    items.set(handle, item);
    candidates.push({ key: handle, item: makeProbe(item, reg) });
  }
  if (candidates.length === 0) return undefined;

  let attempts = 0;
  const customs = isCustomEnabled() ? CUSTOM_ENCHANTS : [];
  for (const plan of iteratePlans(candidates, reg.all, rng, customs)) {
    if (++attempts > MAX_APPLY_ATTEMPTS) break;
    const item = items.get(plan.key);
    if (!item) continue;
    if (applyPlan(plan.key, item, plan, reg)) {
      return { item, enchant: plan.enchant, level: plan.toLevel };
    }
  }
  return undefined;
}

/** Gate (mode, game mode, instabreak) → enchant → feedback. */
export function onPlayerBreakBlock(ev: PlayerBreakBlockAfterEvent): void {
  if (!isEnabled()) return;
  const player = ev.player;
  const mode = player.getGameMode();
  if (mode === GameMode.Creative || mode === GameMode.Spectator) return;
  const blockId = ev.brokenBlockPermutation.type.id;
  if (isInstabreak(blockId)) {
    debug(`instabreak skipped: ${blockId}`);
    return;
  }
  const result = enchantRandomItem(player);
  if (result) notifyEnchant(player, result);
}

export function registerEnchanter(): void {
  world.afterEvents.playerBreakBlock.subscribe(safe("break", onPlayerBreakBlock));
}
