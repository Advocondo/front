import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { carregarArquivoEnv } from "./e2e/support/arquivo-env";
import { resolveDelayMs, tempoLimiteMs } from "./e2e/support/delay";

// Antes de tudo, para o .env.e2e valer também nos tempos limite abaixo e nos arquivos de teste.
carregarArquivoEnv(fileURLToPath(new URL("./.env.e2e", import.meta.url)));

const tempoLimite = tempoLimiteMs(resolveDelayMs(process.env.E2E_DELAY_MS, Boolean(process.env.CI)));

// Testes E2E com Selenium (npm run test:e2e), no ambiente local ou na homologação. Ver e2e/README.md.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["e2e/**/*.e2e.ts"],
    exclude: ["node_modules/**"],
    globalSetup: ["e2e/support/global-setup.ts"],
    fileParallelism: false,
    testTimeout: tempoLimite,
    hookTimeout: tempoLimite,
  },
});
