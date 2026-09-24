// Zip build/Enchantaholic_BP → dist/enchantaholic-<ver>.mcpack and .mcaddon (run build.mjs first).
import fs from "node:fs";
import path from "node:path";
import { BP_BUILD_DIR, BP_DIR_NAME, DIST_DIR, ROOT } from "./lib/paths.mjs";
import { resolveVersion } from "./lib/version.mjs";
import { collectFiles, makeZip } from "./lib/zip.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const version = resolveVersion(process.env, pkg.version);

const builtManifest = path.join(BP_BUILD_DIR, "manifest.json");
if (!fs.existsSync(builtManifest)) throw new Error(`Missing ${builtManifest}; run "npm run build" first`);
const manifest = JSON.parse(fs.readFileSync(builtManifest, "utf8"));
if (JSON.stringify(manifest.header?.version) !== JSON.stringify(version.triple)) {
  throw new Error(
    `Built manifest version ${JSON.stringify(manifest.header?.version)} != ${JSON.stringify(version.triple)}; rebuild with the same VERSION`,
  );
}
if (!fs.existsSync(path.join(BP_BUILD_DIR, "scripts", "main.js"))) throw new Error("Missing scripts/main.js in build");

const files = collectFiles(BP_BUILD_DIR);
fs.mkdirSync(DIST_DIR, { recursive: true });

const base = `enchantaholic-${version.fileSafe}`;
const mcpack = path.join(DIST_DIR, `${base}.mcpack`);
const mcaddon = path.join(DIST_DIR, `${base}.mcaddon`);
fs.writeFileSync(mcpack, makeZip(files));
fs.writeFileSync(mcaddon, makeZip(files.map(([p, d]) => [`${BP_DIR_NAME}/${p}`, d])));

console.log(mcaddon);
console.log(mcpack);
