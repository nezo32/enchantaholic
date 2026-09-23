import { describe, expect, it } from "vitest";
import { isSpear, normalizeId } from "../../src/core/ids";

describe("ids", () => {
  it("normalizeId adds the minecraft namespace only when missing", () => {
    expect(normalizeId("sharpness")).toBe("minecraft:sharpness");
    expect(normalizeId("minecraft:sharpness")).toBe("minecraft:sharpness");
    expect(normalizeId("custom:thing")).toBe("custom:thing");
  });

  it("isSpear matches *_spear only", () => {
    expect(isSpear("minecraft:iron_spear")).toBe(true);
    expect(isSpear("netherite_spear")).toBe(true);
    expect(isSpear("minecraft:diamond_sword")).toBe(false);
    expect(isSpear("minecraft:spear_head")).toBe(false);
    expect(isSpear("minecraft:spearmint")).toBe(false);
  });
});
