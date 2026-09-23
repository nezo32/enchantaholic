import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@minecraft/server": fileURLToPath(new URL("./test/fakes/minecraft-server.ts", import.meta.url)),
    },
  },
  define: { __ENCHANTAHOLIC_VERSION__: JSON.stringify("0.0.0-test"), __ENCHANTAHOLIC_DEBUG__: "false" },
  test: { include: ["test/**/*.test.ts"], environment: "node", restoreMocks: true },
});
