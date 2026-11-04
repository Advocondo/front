/** Configuração dos testes E2E, lida das variáveis de ambiente. Ver e2e/README.md. */

export type E2eBrowser = "chrome" | "firefox";

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Os testes criam e alteram dados, então só podem rodar contra um ambiente local. */
export function resolveBaseUrl(raw = "http://localhost:3000"): string {
  const url = new URL(raw);
  if (!HOSTS_LOCAIS.has(url.hostname)) {
    throw new Error(`E2E_BASE_URL precisa ser um endereço local; recebido: ${url.hostname}`);
  }
  return url.origin;
}

export function resolveBrowser(raw = "chrome"): E2eBrowser {
  if (raw !== "chrome" && raw !== "firefox") {
    throw new Error(`E2E_BROWSER precisa ser chrome ou firefox; recebido: ${raw}`);
  }
  return raw;
}

export const env = {
  baseUrl: resolveBaseUrl(process.env.E2E_BASE_URL),
  browser: resolveBrowser(process.env.E2E_BROWSER),
  headless: process.env.E2E_HEADLESS !== "false",
};
