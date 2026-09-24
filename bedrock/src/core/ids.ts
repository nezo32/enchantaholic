/** "sharpness" → "minecraft:sharpness"; namespaced ids unchanged. */
export function normalizeId(id: string): string {
  return id.includes(":") ? id : `minecraft:${id}`;
}

const SPEAR_RE = /_spear$/;

export function isSpear(itemTypeId: string): boolean {
  return SPEAR_RE.test(normalizeId(itemTypeId));
}
