import { defineConfig } from "vitest/config";

// Testes E2E com Selenium (npm run test:e2e). Ver e2e/README.md.
export default defineConfig({
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
