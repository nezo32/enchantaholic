import data from "./data/instabreak-blocks.json";
import { normalizeId } from "./ids";

/** Blocks with hardness 0 (vanilla ∪ education elements): breaking them never enchants. */
export const INSTABREAK: ReadonlySet<string> = new Set<string>([...data.vanilla, ...data.education_elements]);

export function isInstabreak(blockTypeId: string): boolean {
  return INSTABREAK.has(normalizeId(blockTypeId));
}
