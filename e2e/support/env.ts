/** Configuração dos testes E2E, lida das variáveis de ambiente. Ver e2e/README.md. */

import { resolveDelayMs } from "./delay";

export type E2eBrowser = "chrome" | "firefox";

const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type E2eAlvo = "local" | "homologacao";

/** `E2E_TARGET` escolhe onde a suíte roda. Sem ela, no ambiente local. */
export function resolveAlvo(raw: string | undefined): E2eAlvo {
  if (raw === undefined || raw === "" || raw === "local") return "local";
  if (raw === "homologacao") return raw;
  throw new Error(`E2E_TARGET precisa ser local ou homologacao; recebido: ${raw}`);
}

export const alvo = resolveAlvo(process.env.E2E_TARGET);

/**
 * Na homologação, a suíte não lê e-mail nem o log do back, e entra com contas fixas em vez de convidar
 * usuários novos. Os testes que dependem disso usam `it.skipIf(emHomologacao)`. Ver e2e/README.md.
 */
export const emHomologacao = alvo === "homologacao";

/**
 * No ambiente local, só endereços locais: um E2E_BASE_URL esquecido no terminal não pode levar a suíte,
 * que grava dados, a outro lugar sem que se peça E2E_TARGET=homologacao.
 */
function resolveUrl(nome: string, raw: string, alvoDaSuite: E2eAlvo): string {
  const url = new URL(raw);
  if (alvoDaSuite === "local" && !HOSTS_LOCAIS.has(url.hostname)) {
    throw new Error(`${nome} precisa ser um endereço local; recebido: ${url.hostname}. Para a homologação, defina E2E_TARGET=homologacao.`);
  }
  return url.origin;
}

export function resolveBaseUrl(raw = "http://localhost:3000", alvoDaSuite: E2eAlvo = "local"): string {
  return resolveUrl("E2E_BASE_URL", raw, alvoDaSuite);
}

export function resolveApiUrl(raw = "http://localhost:8000", alvoDaSuite: E2eAlvo = "local"): string {
  return resolveUrl("E2E_API_URL", raw, alvoDaSuite);
}

/** Na homologação, os padrões locais não servem: sem isto, a suíte testaria o endereço errado sem avisar. */
export function exigirDaHomologacao(variaveis: Record<string, string | undefined>): void {
  const faltando = Object.entries(variaveis)
    .filter(([, valor]) => !valor)
    .map(([nome]) => nome);
  if (faltando.length > 0) throw new Error(`Defina para rodar na homologação: ${faltando.join(", ")}. Ver .env.e2e.example.`);
}

export function resolveBrowser(raw = "chrome"): E2eBrowser {
  if (raw !== "chrome" && raw !== "firefox") {
    throw new Error(`E2E_BROWSER precisa ser chrome ou firefox; recebido: ${raw}`);
  }
  return raw;
}

if (emHomologacao) {
  exigirDaHomologacao({
    E2E_BASE_URL: process.env.E2E_BASE_URL,
    E2E_API_URL: process.env.E2E_API_URL,
    E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
    E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
    E2E_OPERADOR_EMAIL: process.env.E2E_OPERADOR_EMAIL,
    E2E_OPERADOR_PASSWORD: process.env.E2E_OPERADOR_PASSWORD,
    E2E_CLIENTE_EMAIL: process.env.E2E_CLIENTE_EMAIL,
    E2E_CLIENTE_PASSWORD: process.env.E2E_CLIENTE_PASSWORD,
    E2E_CLIENTE2_EMAIL: process.env.E2E_CLIENTE2_EMAIL,
    E2E_CLIENTE2_PASSWORD: process.env.E2E_CLIENTE2_PASSWORD,
  });
}

export const env = {
  baseUrl: resolveBaseUrl(process.env.E2E_BASE_URL, alvo),
  apiUrl: resolveApiUrl(process.env.E2E_API_URL, alvo),
  browser: resolveBrowser(process.env.E2E_BROWSER),
  headless: process.env.E2E_HEADLESS !== "false",
  delayMs: resolveDelayMs(process.env.E2E_DELAY_MS, Boolean(process.env.CI)),
  backDir: process.env.E2E_BACK_DIR ?? "../back",
  setupToken: process.env.E2E_SETUP_TOKEN ?? "",
  // Os padrões só existem no banco local de teste.
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com",
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? "e2e-senha-local-123",
  /** Contas fixas da homologação, que entram no lugar dos usuários convidados. Ver `createUser`. */
  contasFixas: {
    operator: [{ email: process.env.E2E_OPERADOR_EMAIL ?? "", password: process.env.E2E_OPERADOR_PASSWORD ?? "" }],
    client: [
      { email: process.env.E2E_CLIENTE_EMAIL ?? "", password: process.env.E2E_CLIENTE_PASSWORD ?? "" },
      { email: process.env.E2E_CLIENTE2_EMAIL ?? "", password: process.env.E2E_CLIENTE2_PASSWORD ?? "" },
    ],
  },
};
