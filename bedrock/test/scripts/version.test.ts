import { describe, expect, it } from "vitest";
import { fileSafeVersion, resolveVersion } from "../../scripts/lib/version.mjs";

describe("resolveVersion", () => {
  it("defaults to package.json version", () => {
    expect(resolveVersion({}, "1.0.0")).toEqual({ full: "1.0.0", triple: [1, 0, 0], fileSafe: "1.0.0" });
    expect(resolveVersion({ VERSION: "   " }, "2.3.4").full).toBe("2.3.4");
  });

  it("uses the VERSION env override and strips a leading v", () => {
    expect(resolveVersion({ VERSION: "1.2.3" }, "1.0.0").triple).toEqual([1, 2, 3]);
    expect(resolveVersion({ VERSION: "v1.2.3" }, "1.0.0").full).toBe("1.2.3");
    expect(resolveVersion({ VERSION: " v10.20.30\n" }, "1.0.0").triple).toEqual([10, 20, 30]);
  });

  it("keeps prerelease/build in full but not in triple", () => {
    const pre = resolveVersion({ VERSION: "1.2.3-rc.1" }, "1.0.0");
    expect(pre.triple).toEqual([1, 2, 3]);
    expect(pre.full).toBe("1.2.3-rc.1");
    const build = resolveVersion({ VERSION: "1.2.3-beta.2+build.7" }, "1.0.0");
    expect(build.triple).toEqual([1, 2, 3]);
    expect(build.fileSafe).toBe("1.2.3-beta.2_build.7");
    expect(fileSafeVersion("1.0.0+a+b")).toBe("1.0.0_a_b");
  });

  it.each(["abc", "1.2", "1.2.3.4", "1.2.x", "1.2.3-", "1.2.3+"])("rejects %j", (v) => {
    expect(() => resolveVersion({ VERSION: v }, "1.0.0")).toThrow(/Invalid VERSION/);
  });

  it("rejects an invalid package version when no env override", () => {
    expect(() => resolveVersion({}, "nope")).toThrow(/Invalid VERSION/);
  });
});
