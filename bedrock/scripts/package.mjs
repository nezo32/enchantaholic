// Zip build/Enchantaholic_BP + build/Enchantaholic_RP (run build.mjs first) →
//   dist/enchantaholic-<ver>.mcaddon            both packs (Enchantaholic_BP/, Enchantaholic_RP/): the release file
//   dist/enchantaholic-<ver>.mcpack             behavior pack only
//   dist/enchantaholic-<ver>-resources.mcpack   resource pack only (texts/translations the BP depends on)
import fs from "node:fs";
import path from "node:path";
import { BP_BUILD_DIR, BP_DIR_NAME, DIST_DIR, ROOT, RP_BUILD_DIR, RP_DIR_NAME } from "./lib/paths.mjs";
import { resolveVersion } from "./lib/version.mjs";
import { collectFiles, makeZip } from "./lib/zip.mjs";

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const version = resolveVersion(process.env, pkg.version);

for (const dir of [BP_BUILD_DIR, RP_BUILD_DIR]) {
  const builtManifest = path.join(dir, "manifest.json");
  if (!fs.existsSync(builtManifest)) throw new Error(`Missing ${builtManifest}; run "npm run build" first`);
  const manifest = JSON.parse(fs.readFileSync(builtManifest, "utf8"));
  if (JSON.stringify(manifest.header?.version) !== JSON.stringify(version.triple)) {
    throw new Error(
      `Built manifest ${builtManifest} version ${JSON.stringify(manifest.header?.version)} != ${JSON.stringify(version.triple)}; rebuild with the same VERSION`,
    );
  }
}
if (!fs.existsSync(path.join(BP_BUILD_DIR, "scripts", "main.js"))) throw new Error("Missing scripts/main.js in build");
if (!fs.existsSync(path.join(RP_BUILD_DIR, "texts", "en_US.lang"))) throw new Error("Missing texts/en_US.lang in the resource pack");

const bp = collectFiles(BP_BUILD_DIR);
const rp = collectFiles(RP_BUILD_DIR);
fs.mkdirSync(DIST_DIR, { recursive: true });

const base = `enchantaholic-${version.fileSafe}`;
const mcaddon = path.join(DIST_DIR, `${base}.mcaddon`);
const mcpack = path.join(DIST_DIR, `${base}.mcpack`);
const rpMcpack = path.join(DIST_DIR, `${base}-resources.mcpack`);
fs.writeFileSync(
  mcaddon,
  makeZip([...bp.map(([p, d]) => [`${BP_DIR_NAME}/${p}`, d]), ...rp.map(([p, d]) => [`${RP_DIR_NAME}/${p}`, d])]),
);
fs.writeFileSync(mcpack, makeZip(bp));
fs.writeFileSync(rpMcpack, makeZip(rp));

console.log(mcaddon);
console.log(mcpack);
console.log(rpMcpack);
