/** Configuração dos testes E2E, lida das variáveis de ambiente. Ver e2e/README.md. */

export type E2eBrowser = "chrome" | "firefox";

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Os testes criam e alteram dados, então só podem rodar contra um ambiente local. */
function resolveLocalUrl(nome: string, raw: string): string {
  const url = new URL(raw);
  if (!HOSTS_LOCAIS.has(url.hostname)) {
    throw new Error(`${nome} precisa ser um endereço local; recebido: ${url.hostname}`);
  }
  return url.origin;
}

export function resolveBaseUrl(raw = "http://localhost:3000"): string {
  return resolveLocalUrl("E2E_BASE_URL", raw);
}

export function resolveApiUrl(raw = "http://localhost:8000"): string {
  return resolveLocalUrl("E2E_API_URL", raw);
}

export function resolveBrowser(raw = "chrome"): E2eBrowser {
  if (raw !== "chrome" && raw !== "firefox") {
    throw new Error(`E2E_BROWSER precisa ser chrome ou firefox; recebido: ${raw}`);
  }
  return raw;
}

export const env = {
  baseUrl: resolveBaseUrl(process.env.E2E_BASE_URL),
  apiUrl: resolveApiUrl(process.env.E2E_API_URL),
  browser: resolveBrowser(process.env.E2E_BROWSER),
  headless: process.env.E2E_HEADLESS !== "false",
  backDir: process.env.E2E_BACK_DIR ?? "../back",
  setupToken: process.env.E2E_SETUP_TOKEN ?? "",
  // Só existem no banco local de teste.
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com",
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? "e2e-senha-local-123",
};
