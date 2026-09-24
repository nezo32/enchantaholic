/**
 * Resolve the release version from env.VERSION (optional leading "v") or package.json.
 * @param {Record<string, string | undefined>} env
 * @param {string} pkgVersion
 * @returns {{ full: string, triple: [number, number, number], fileSafe: string }}
 */
export function resolveVersion(env, pkgVersion) {
  const raw = (env.VERSION ?? "").trim().replace(/^v/, "") || pkgVersion;
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(raw);
  if (!m) throw new Error(`Invalid VERSION "${raw}" (expected semver)`);
  return {
    full: raw,
    triple: [Number(m[1]), Number(m[2]), Number(m[3])],
    fileSafe: fileSafeVersion(raw),
  };
}

/** Version string usable in file names ("+" → "_"). */
export function fileSafeVersion(full) {
  return full.replace(/\+/g, "_");
}
