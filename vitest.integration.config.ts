import { defineConfig } from "vitest/config";

// Opt-in config for live integration tests (real network, no API keys needed).
export default defineConfig({
  test: {
    include: ["**/*.live.test.ts"],
    exclude: ["**/node_modules/**"],
  },
});
