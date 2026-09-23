#!/usr/bin/env bash
# Dry-run tests for scripts/curseforge-upload.sh against the fixture JSON in scripts/test/fixtures/.
# No network, no token. Needs bash, jq. Usage: bash scripts/test/curseforge-upload.test.sh
set -euo pipefail
shopt -s extglob # must be on at parse time for the glob checks at the end

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/../curseforge-upload.sh"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

failures=0
pass() { echo "ok   - $*"; }
fail() { echo "FAIL - $*"; failures=$((failures + 1)); }

# dummy build outputs
printf 'jar' > "$tmp/enchantaholic-1.2.0-beta.1.jar"
printf 'src' > "$tmp/enchantaholic-1.2.0-beta.1-sources.jar"

run_upload() { # runs the script in dry-run mode; combined output -> $tmp/out, exit code -> $rc
  rc=0
  env -u CF_TOKEN \
    CF_DRY_RUN=true CF_PROJECT_ID=1 \
    CF_VERSIONS_JSON="$here/fixtures/versions.json" CF_TYPES_JSON="$here/fixtures/types.json" \
    CF_RELEASE_TYPE=beta CF_CHANGELOG='## Changes' \
    GITHUB_OUTPUT="$tmp/github_output" \
    "$@" > "$tmp/out" 2>&1 || rc=$?
}

meta() { # $1 = n: the n-th (1-based) dry-run metadata JSON object printed by the script
  awk -v n="$1" '
    /^\[dry-run\] POST / { c++; grab = (c == n); next }
    grab { print; if ($0 == "}") exit }' "$tmp/out"
}

# --- main case: Fabric mod with a sources jar ---------------------------------------------
: > "$tmp/github_output"
run_upload \
  CF_GAME_VERSIONS='26.2,26.3,Fabric,Java 25,Client,Server' \
  CF_RELATIONS='fabric-api:requiredDependency' \
  bash "$script" "$tmp/enchantaholic-1.2.0-beta.1.jar" "$tmp/enchantaholic-1.2.0-beta.1-sources.jar"
if [[ $rc -ne 0 ]]; then
  fail "dry-run exited $rc"; cat "$tmp/out"; exit 1
fi
primary="$(meta 1)"; child="$(meta 2)"

# (a) names resolve to the Minecraft/loader/java/environment ids; the Bukkit "26.2" (id 200) is excluded
if jq -e '.gameVersions == [100,101,300,7499,9638,9639]' <<<"$primary" >/dev/null; then
  pass "(a) game versions resolve, Bukkit 26.2 excluded"
else
  fail "(a) unexpected gameVersions: $(jq -c .gameVersions <<<"$primary")"
fi

# (b) relations
if jq -e '.relations.projects == [{"slug":"fabric-api","type":"requiredDependency"}]' <<<"$primary" >/dev/null; then
  pass "(b) relations contain fabric-api requiredDependency"
else
  fail "(b) unexpected relations: $(jq -c .relations <<<"$primary")"
fi

# primary metadata basics
if jq -e '.releaseType == "beta" and .changelog == "## Changes" and .changelogType == "markdown"
          and .displayName == "enchantaholic-1.2.0-beta.1.jar"' <<<"$primary" >/dev/null; then
  pass "primary metadata (releaseType, changelog, displayName)"
else
  fail "primary metadata: $primary"
fi

# (c) the child file is attached via parentFileID and carries no gameVersions
if jq -e 'has("parentFileID") and (has("gameVersions") | not)
          and .displayName == "enchantaholic-1.2.0-beta.1-sources.jar"' <<<"$child" >/dev/null; then
  pass "(c) child file has parentFileID and no gameVersions"
else
  fail "(c) unexpected child metadata: ${child:-<none>}"
fi

if grep -qx 'file-id=0' "$tmp/github_output"; then
  pass "file-id written to GITHUB_OUTPUT"
else
  fail "GITHUB_OUTPUT: $(cat "$tmp/github_output")"
fi

# --- (d) unknown version fails with suggestions ---------------------------------------------
run_upload CF_GAME_VERSIONS='26.9,Fabric' bash "$script" "$tmp/enchantaholic-1.2.0-beta.1.jar"
if [[ $rc -ne 0 ]] && grep -q "Similar:" "$tmp/out" && grep -q "'26.9' not found" "$tmp/out"; then
  pass "(d) unknown 26.9 exits $rc with 'Similar:'"
else
  fail "(d) expected failure with 'Similar:', got rc=$rc: $(cat "$tmp/out")"
fi

# --- guards ---------------------------------------------------------------------------------
run_upload CF_DRY_RUN=false CF_GAME_VERSIONS='26.2' bash "$script" "$tmp/enchantaholic-1.2.0-beta.1.jar"
if [[ $rc -ne 0 ]] && grep -q "CF_TOKEN is required" "$tmp/out"; then
  pass "real upload without CF_TOKEN is refused"
else
  fail "missing token not rejected: rc=$rc $(cat "$tmp/out")"
fi

run_upload CF_GAME_VERSIONS='26.2' CF_RELATIONS='fabric-api:needed' bash "$script" "$tmp/enchantaholic-1.2.0-beta.1.jar"
if [[ $rc -ne 0 ]] && grep -q "bad relation type" "$tmp/out"; then
  pass "bad relation type is rejected"
else
  fail "bad relation type not rejected: rc=$rc"
fi

# --- file globs used by the callers (release.yml / release-caller.yml) ------------------------
if (
  shopt -s nullglob
  cd "$tmp"
  primary_glob=( enchantaholic-!(*-sources).jar )
  template_glob=( !(*-sources).jar )
  [[ "${primary_glob[*]}" == "enchantaholic-1.2.0-beta.1.jar" && "${template_glob[*]}" == "enchantaholic-1.2.0-beta.1.jar" ]]
); then
  pass "primary-file globs match exactly the main jar"
else
  fail "primary-file globs"
fi

echo
if [[ $failures -gt 0 ]]; then
  echo "$failures test(s) failed"; exit 1
fi
echo "all tests passed"
