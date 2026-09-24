/**
 * Stamps a version triple into a pack manifest: the header, every module, and every dependency on one of
 * `packUuids` (the BP<->RP pairing). Script-module dependencies (module_name) are left alone.
 * @param {any} manifest parsed manifest.json (not modified)
 * @param {[number, number, number]} triple
 * @param {ReadonlySet<string>} packUuids header UUIDs of the packs built together
 * @returns {any} a new manifest object
 */
export function stampManifest(manifest, triple, packUuids) {
  const m = structuredClone(manifest);
  m.header.version = [...triple];
  for (const mod of m.modules ?? []) mod.version = [...triple];
  for (const dep of m.dependencies ?? []) {
    if (typeof dep.uuid === "string" && packUuids.has(dep.uuid)) dep.version = [...triple];
  }
  return m;
}
