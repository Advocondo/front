import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { resolveDelayMs, tempoLimiteMs } from "./e2e/support/delay";

const tempoLimite = tempoLimiteMs(resolveDelayMs(process.env.E2E_DELAY_MS, Boolean(process.env.CI)));

// Testes E2E com Selenium (npm run test:e2e). Ver e2e/README.md.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.ts"],
    // A suíte de produção tem configuração própria.
    exclude: ["e2e/producao/**", "node_modules/**"],
    // Fixo aqui: esta suíte grava dados, e um E2E_TARGET ligado no terminal não pode apontá-la para produção.
    env: { E2E_TARGET: "local" },
    fileParallelism: false,
    testTimeout: tempoLimite,
    hookTimeout: tempoLimite,
  },
});
