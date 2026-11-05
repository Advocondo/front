import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { resolveDelayMs, tempoLimiteMs } from "./e2e/support/delay";

const tempoLimite = tempoLimiteMs(resolveDelayMs(process.env.E2E_DELAY_MS, Boolean(process.env.CI)));

// Só a suíte de leitura, contra o ambiente real (npm run test:e2e:prod). Ver e2e/README.md.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["e2e/producao/**/*.e2e.ts"],
    env: { E2E_TARGET: "prod" },
    fileParallelism: false,
    testTimeout: tempoLimite,
    hookTimeout: tempoLimite,
  },
});
