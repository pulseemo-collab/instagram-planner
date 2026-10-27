import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests (no browser). Playwright owns tests/e2e and tests/live. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
    // A fixed zone with DST, so local-time date helpers are deterministic.
    env: { TZ: "Europe/Rome" },
  },
});
