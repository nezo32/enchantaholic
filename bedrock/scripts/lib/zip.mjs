import fs from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";

/** Fixed mtime so zips are byte-for-byte reproducible. */
export const FIXED_MTIME = new Date("2026-01-01T00:00:00Z");

/**
 * Recursively collect regular files under dir.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Array<[string, Uint8Array]>} sorted by zip path, "/" separators
 */
export function collectFiles(dir, prefix = "") {
  /** @type {Array<[string, Uint8Array]>} */
  const out = [];
  const walk = (abs, rel) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const childAbs = path.join(abs, ent.name);
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(childAbs, childRel);
      else if (ent.isFile()) out.push([prefix + childRel, new Uint8Array(fs.readFileSync(childAbs))]);
    }
  };
  walk(dir, "");
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

/**
 * @param {Array<[string, Uint8Array]>} entries
 * @returns {Uint8Array}
 */
export function makeZip(entries) {
  const sorted = [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  /** @type {Record<string, [Uint8Array, { mtime: Date }]>} */
  const tree = {};
  for (const [p, d] of sorted) tree[p] = [d, { mtime: FIXED_MTIME }];
  return zipSync(tree, { level: 9, mtime: FIXED_MTIME });
}
