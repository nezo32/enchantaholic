import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stampManifest } from "../../scripts/lib/manifest.mjs";
import { PACK_DIR, ROOT, RP_DIR } from "../../scripts/lib/paths.mjs";

const read = (p: string) => fs.readFileSync(path.join(PACK_DIR, p));
const manifest = JSON.parse(read("manifest.json").toString("utf8"));
const rpRead = (p: string) => fs.readFileSync(path.join(RP_DIR, p));
const rp = JSON.parse(rpRead("manifest.json").toString("utf8"));
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

  it("depends on the resource pack (pairing) by its header UUID", () => {
    const deps = manifest.dependencies.filter((d: { uuid?: string }) => d.uuid !== undefined);
    expect(deps).toEqual([{ uuid: rp.header.uuid, version: manifest.header.version }]);
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

  it("texts/languages.json includes en_US and ru_RU", () => {
    expect(JSON.parse(read("texts/languages.json").toString("utf8"))).toEqual(["en_US", "ru_RU"]);
  });
});

describe("resource_pack/manifest.json", () => {
  it("is a format 2 resources pack for the same engine, with localized name keys", () => {
    expect(rp.format_version).toBe(2);
    expect(rp.header).toMatchObject({ name: "pack.name", description: "pack.description" });
    expect(rp.header.min_engine_version).toEqual(manifest.header.min_engine_version);
    expect(rp.header.version).toEqual(manifest.header.version);
    expect(rp.modules).toEqual([{ type: "resources", uuid: rp.modules[0].uuid, version: rp.header.version }]);
    expect(rp.metadata).toEqual(manifest.metadata);
  });

  it("depends back on the behavior pack and has no script dependencies", () => {
    expect(rp.dependencies).toEqual([{ uuid: manifest.header.uuid, version: manifest.header.version }]);
  });

  it("all five UUIDs across both packs are unique v4", () => {
    const uuids: string[] = [
      manifest.header.uuid,
      ...manifest.modules.map((m: { uuid: string }) => m.uuid),
      rp.header.uuid,
      ...rp.modules.map((m: { uuid: string }) => m.uuid),
    ];
    expect(uuids).toHaveLength(5);
    for (const u of uuids) expect(u).toMatch(V4);
    expect(new Set(uuids).size).toBe(5);
  });

  it("ships the same 256×256 icon", () => {
    expect(rpRead("pack_icon.png").equals(read("pack_icon.png"))).toBe(true);
  });
});

describe("stampManifest", () => {
  it("stamps header, modules and pack dependencies, leaving script module dependencies alone", () => {
    const uuids = new Set([manifest.header.uuid, rp.header.uuid]);
    const bp = stampManifest(manifest, [0, 3, 1], uuids);
    expect(bp.header.version).toEqual([0, 3, 1]);
    expect(bp.modules.every((m: { version: number[] }) => JSON.stringify(m.version) === "[0,3,1]")).toBe(true);
    expect(bp.dependencies).toEqual([
      { module_name: "@minecraft/server", version: pkg.devDependencies["@minecraft/server"] },
      { uuid: rp.header.uuid, version: [0, 3, 1] },
    ]);
    const r = stampManifest(rp, [0, 3, 1], uuids);
    expect(r.header.version).toEqual([0, 3, 1]);
    expect(r.modules[0].version).toEqual([0, 3, 1]);
    expect(r.dependencies).toEqual([{ uuid: manifest.header.uuid, version: [0, 3, 1] }]);
    expect(manifest.header.version).toEqual([1, 0, 0]); // input untouched
  });
});
