// Build the behavior pack: stage pack/ + rendered manifest + esbuild bundle → build/Enchantaholic_BP/.
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { esbuildOptions } from "./lib/esbuild-options.mjs";
import { BP_BUILD_DIR, BP_DIR_NAME, BUILD_DIR, ENTRY, PACK_DIR, ROOT } from "./lib/paths.mjs";
import { resolveVersion } from "./lib/version.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const version = resolveVersion(process.env, pkg.version);
const debug = process.env.DEBUG === "1";

const manifestSrc = path.join(PACK_DIR, "manifest.json");
if (!fs.existsSync(manifestSrc)) throw new Error(`Missing ${manifestSrc}`);

fs.rmSync(BUILD_DIR, { recursive: true, force: true });
fs.mkdirSync(BP_BUILD_DIR, { recursive: true });

fs.cpSync(PACK_DIR, BP_BUILD_DIR, {
  recursive: true,
  filter: (src) => path.resolve(src) !== path.resolve(manifestSrc),
});

const manifest = JSON.parse(fs.readFileSync(manifestSrc, "utf8"));
manifest.header.version = [...version.triple];
for (const mod of manifest.modules ?? []) mod.version = [...version.triple];
fs.writeFileSync(path.join(BP_BUILD_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

await build({
  ...esbuildOptions(version, debug),
  entryPoints: [ENTRY],
  outfile: path.join(BP_BUILD_DIR, "scripts", "main.js"),
  logLevel: "info",
});

console.log(`Built ${BP_DIR_NAME} v${version.full}${debug ? " (debug)" : ""}`);
