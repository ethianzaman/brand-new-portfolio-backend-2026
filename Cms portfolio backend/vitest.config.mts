import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/setup.ts"],
    // The files share one in-memory database, and each one resets it.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    silent: "passed-only",
  },
});
