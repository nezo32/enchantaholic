import { fileURLToPath } from "node:url";
import path from "node:path";

/** bedrock/ project root. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const BP_DIR_NAME = "Enchantaholic_BP";
export const RP_DIR_NAME = "Enchantaholic_RP";
/** Behavior pack sources (manifest, icon, pack name texts). */
export const PACK_DIR = path.join(ROOT, "pack");
/** Resource pack sources (manifest, icon, texts for every script message). */
export const RP_DIR = path.join(ROOT, "resource_pack");
export const BUILD_DIR = path.join(ROOT, "build");
export const BP_BUILD_DIR = path.join(BUILD_DIR, BP_DIR_NAME);
export const RP_BUILD_DIR = path.join(BUILD_DIR, RP_DIR_NAME);
export const DIST_DIR = path.join(ROOT, "dist");
export const ENTRY = path.join(ROOT, "src", "main.ts");
