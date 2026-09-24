import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectFiles, makeZip } from "../../scripts/lib/zip.mjs";

let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "enchantaholic-zip-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "texts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), '{"format_version":2}\n');
  fs.writeFileSync(path.join(dir, "scripts", "main.js"), "console.log('✦ §d');\n");
  fs.writeFileSync(path.join(dir, "texts", "en_US.lang"), "pack.name=Enchantaholic\n");
  fs.writeFileSync(path.join(dir, "pack_icon.png"), new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 255]));
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("zip", () => {
  it("collects files sorted with / separators", () => {
    const files = collectFiles(dir);
    expect(files.map(([p]) => p)).toEqual(["manifest.json", "pack_icon.png", "scripts/main.js", "texts/en_US.lang"]);
    expect(collectFiles(dir, "X/").map(([p]) => p)[0]).toBe("X/manifest.json");
  });

  it("round-trips bytes through makeZip/unzipSync", () => {
    const files = collectFiles(dir);
    const out = unzipSync(makeZip(files));
    expect(Object.keys(out).sort()).toEqual(files.map(([p]) => p));
    for (const [p, d] of files) expect(Buffer.from(out[p]!).equals(Buffer.from(d))).toBe(true);
  });

  it("is reproducible (byte-identical across runs and input order)", () => {
    const files = collectFiles(dir);
    const a = makeZip(files);
    const b = makeZip([...files].reverse());
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("supports the mcaddon Enchantaholic_BP/ prefix", () => {
    const files = collectFiles(dir).map(([p, d]) => [`Enchantaholic_BP/${p}`, d] as [string, Uint8Array]);
    const names = Object.keys(unzipSync(makeZip(files)));
    expect(names.every((n) => n.startsWith("Enchantaholic_BP/"))).toBe(true);
    expect(names).toContain("Enchantaholic_BP/manifest.json");
  });
});
