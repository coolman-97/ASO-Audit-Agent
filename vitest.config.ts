import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Hermetic unit tests run by default; *.live.test.ts hit real network APIs
    // and are opt-in via `npm run test:integration`.
    exclude: ["**/node_modules/**", "**/*.live.test.ts"],
  },
});
