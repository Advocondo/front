/** Configuração dos testes E2E, lida das variáveis de ambiente. Ver e2e/README.md. */

import { resolveDelayMs } from "./delay";

export type E2eBrowser = "chrome" | "firefox";

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Quem define o alvo é a configuração do Vitest, não uma variável que se possa esquecer ligada:
 * `npm run test:e2e` é sempre local, e `npm run test:e2e:prod` só coleta a suíte de leitura.
 */
export const emProducao = process.env.E2E_TARGET === "prod";

/** A suíte comum cria e altera dados, então só pode rodar contra um ambiente local. */
function resolveUrl(nome: string, raw: string, producao: boolean): string {
  const url = new URL(raw);
  if (!producao && !HOSTS_LOCAIS.has(url.hostname)) {
    throw new Error(`${nome} precisa ser um endereço local; recebido: ${url.hostname}. Para produção, use npm run test:e2e:prod, que só faz leitura.`);
  }
  return url.origin;
}

export function resolveBaseUrl(raw = "http://localhost:3000", producao = false): string {
  return resolveUrl("E2E_BASE_URL", raw, producao);
}

export function resolveApiUrl(raw = "http://localhost:8000", producao = false): string {
  return resolveUrl("E2E_API_URL", raw, producao);
}

export function resolveBrowser(raw = "chrome"): E2eBrowser {
  if (raw !== "chrome" && raw !== "firefox") {
    throw new Error(`E2E_BROWSER precisa ser chrome ou firefox; recebido: ${raw}`);
  }
  return raw;
}

/** Em produção, os padrões locais não servem: sem isto, a suíte testaria o endereço errado sem avisar. */
export function exigirDeProducao(variaveis: Record<string, string | undefined>): void {
  const faltando = Object.entries(variaveis)
    .filter(([, valor]) => !valor)
    .map(([nome]) => nome);
  if (faltando.length > 0) throw new Error(`Defina para rodar em produção: ${faltando.join(", ")}. Ver e2e/README.md.`);
}

if (emProducao) {
  exigirDeProducao({
    E2E_BASE_URL: process.env.E2E_BASE_URL,
    E2E_API_URL: process.env.E2E_API_URL,
    E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
    E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
  });
}

export const env = {
  baseUrl: resolveBaseUrl(process.env.E2E_BASE_URL, emProducao),
  apiUrl: resolveApiUrl(process.env.E2E_API_URL, emProducao),
  browser: resolveBrowser(process.env.E2E_BROWSER),
  headless: process.env.E2E_HEADLESS !== "false",
  delayMs: resolveDelayMs(process.env.E2E_DELAY_MS, Boolean(process.env.CI)),
  backDir: process.env.E2E_BACK_DIR ?? "../back",
  setupToken: process.env.E2E_SETUP_TOKEN ?? "",
  // Os padrões só existem no banco local de teste.
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com",
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? "e2e-senha-local-123",
};
