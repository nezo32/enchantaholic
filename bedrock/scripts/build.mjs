// Build both packs: stage pack/ and resource_pack/ with stamped manifests, bundle the script with esbuild
// → build/Enchantaholic_BP/ and build/Enchantaholic_RP/.
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { esbuildOptions } from "./lib/esbuild-options.mjs";
import { stampManifest } from "./lib/manifest.mjs";
import { BP_BUILD_DIR, BP_DIR_NAME, BUILD_DIR, ENTRY, PACK_DIR, ROOT, RP_BUILD_DIR, RP_DIR, RP_DIR_NAME } from "./lib/paths.mjs";
import { resolveVersion } from "./lib/version.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const version = resolveVersion(process.env, pkg.version);
const debug = process.env.DEBUG === "1";

const packs = [
  { src: PACK_DIR, out: BP_BUILD_DIR },
  { src: RP_DIR, out: RP_BUILD_DIR },
].map((p) => {
  const manifestSrc = path.join(p.src, "manifest.json");
  if (!fs.existsSync(manifestSrc)) throw new Error(`Missing ${manifestSrc}`);
  return { ...p, manifestSrc, manifest: JSON.parse(fs.readFileSync(manifestSrc, "utf8")) };
});
const packUuids = new Set(packs.map((p) => p.manifest.header.uuid));

fs.rmSync(BUILD_DIR, { recursive: true, force: true });
for (const p of packs) {
  fs.mkdirSync(p.out, { recursive: true });
  fs.cpSync(p.src, p.out, {
    recursive: true,
    filter: (src) => path.resolve(src) !== path.resolve(p.manifestSrc),
  });
  const stamped = stampManifest(p.manifest, version.triple, packUuids);
  fs.writeFileSync(path.join(p.out, "manifest.json"), JSON.stringify(stamped, null, 2) + "\n");
}

await build({
  ...esbuildOptions(version, debug),
  entryPoints: [ENTRY],
  outfile: path.join(BP_BUILD_DIR, "scripts", "main.js"),
  logLevel: "info",
});

console.log(`Built ${BP_DIR_NAME} + ${RP_DIR_NAME} v${version.full}${debug ? " (debug)" : ""}`);
