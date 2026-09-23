import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import { esbuildOptions } from "../../scripts/lib/esbuild-options.mjs";
import { ENTRY } from "../../scripts/lib/paths.mjs";

describe("script bundle", () => {
  it("imports only @minecraft/server, excludes vanilla-data, and stays small", async () => {
    const result = await build({
      ...esbuildOptions({ full: "0.0.0-test" }, false),
      entryPoints: [ENTRY],
      outfile: "main.js",
      write: false,
      logLevel: "silent",
    });
    expect(result.errors).toEqual([]);
    const file = result.outputFiles?.[0];
    expect(file).toBeDefined();
    const code = file!.text;
    const imports = [...code.matchAll(/\bimport\s*(?:[^"';]*?\s*from\s*)?["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    expect(new Set(imports)).toEqual(new Set(["@minecraft/server"]));
    expect(code).not.toMatch(/import\s*\(/);
    expect(code).not.toContain("vanilla-data");
    expect(code).not.toContain("__ENCHANTAHOLIC_VERSION__");
    expect(code).toContain("0.0.0-test");
    expect(code).toContain("✦"); // charset utf8 keeps literals
    expect(file!.contents.byteLength).toBeLessThan(200 * 1024);
  });
});
