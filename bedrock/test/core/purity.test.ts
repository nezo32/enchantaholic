import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/core");

function tsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return tsFiles(p);
    return e.name.endsWith(".ts") ? [p] : [];
  });
}

describe("core purity", () => {
  const files = tsFiles(CORE);

  it("finds the core modules", () => {
    expect(files.length).toBeGreaterThanOrEqual(13);
  });

  it.each(files.map((f) => [path.relative(CORE, f), f]))("%s imports nothing from @minecraft/*", (_rel, file) => {
    const src = fs.readFileSync(file, "utf8");
    expect(src).not.toMatch(/from\s+["']@minecraft\//);
    expect(src).not.toMatch(/import\s*\(\s*["']@minecraft\//);
    expect(src).not.toMatch(/require\s*\(\s*["']@minecraft\//);
  });

  it("only imports relative modules", () => {
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) expect(m[1]).toMatch(/^\.\.?\//);
    }
  });
});
