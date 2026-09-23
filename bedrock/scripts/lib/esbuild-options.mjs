/**
 * Shared esbuild options for the script bundle (used by build.mjs and the bundle test).
 * @param {{ full: string }} version
 * @param {boolean} debug
 */
export function esbuildOptions(version, debug) {
  return {
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    external: ["@minecraft/server"],
    minify: false, // readable content-log stack traces; bundle is small
    sourcemap: false,
    legalComments: "none",
    charset: "utf8", // keep ✦ and § literal
    define: {
      __ENCHANTAHOLIC_VERSION__: JSON.stringify(version.full),
      __ENCHANTAHOLIC_DEBUG__: String(debug),
    },
  };
}
