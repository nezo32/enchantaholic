import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PACK_DIR, ROOT } from "../../scripts/lib/paths.mjs";

const read = (p: string) => fs.readFileSync(path.join(PACK_DIR, p));
const manifest = JSON.parse(read("manifest.json").toString("utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("pack/manifest.json", () => {
  it("uses format_version 2", () => {
    expect(manifest.format_version).toBe(2);
  });

  it("has three unique v4 UUIDs", () => {
    const uuids: string[] = [manifest.header.uuid, ...manifest.modules.map((m: { uuid: string }) => m.uuid)];
    expect(uuids).toHaveLength(3);
    for (const u of uuids) expect(u).toMatch(V4);
    expect(new Set(uuids).size).toBe(3);
  });

  it("depends on the same @minecraft/server version as package.json", () => {
    const dep = manifest.dependencies.find((d: { module_name?: string }) => d.module_name === "@minecraft/server");
    expect(dep?.version).toBe(pkg.devDependencies["@minecraft/server"]);
    expect(manifest.dependencies.some((d: { module_name?: string }) => d.module_name?.includes("vanilla-data"))).toBe(false);
  });

  it("targets engine 1.26.50 and has a script entry scripts/main.js", () => {
    expect(manifest.header.min_engine_version).toEqual([1, 26, 50]);
    const script = manifest.modules.find((m: { type: string }) => m.type === "script");
    expect(script).toMatchObject({ language: "javascript", entry: "scripts/main.js" });
    expect(manifest.modules.some((m: { type: string }) => m.type === "data")).toBe(true);
  });

  it("uses localized name/description keys defined in en_US.lang", () => {
    const lang = read("texts/en_US.lang").toString("utf8");
    expect(manifest.header.name).toBe("pack.name");
    expect(manifest.header.description).toBe("pack.description");
    expect(lang).toMatch(/^pack\.name=Enchantaholic\s*$/m);
    expect(lang).toMatch(/^pack\.description=.+$/m);
  });

  it("pack_icon.png is a 256×256 PNG", () => {
    const png = read("pack_icon.png");
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    expect(png.readUInt32BE(16)).toBe(256);
    expect(png.readUInt32BE(20)).toBe(256);
  });

  it("texts/languages.json includes en_US", () => {
    expect(JSON.parse(read("texts/languages.json").toString("utf8"))).toContain("en_US");
  });
});
