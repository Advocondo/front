import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "./env";

const executar = promisify(execFile);

export type TestUser = { id: string; email: string; password: string };

async function chamarApi(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

async function esperarSucesso<T>(resposta: Response, acao: string): Promise<T> {
  if (!resposta.ok) throw new Error(`${acao} falhou (${resposta.status}): ${await resposta.text()}`);
  return (await resposta.json()) as T;
}

async function tokenDoAdmin(): Promise<string | null> {
  const resposta = await chamarApi("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: env.adminEmail, password: env.adminPassword }),
  });
  if (!resposta.ok) return null;
  return ((await resposta.json()) as { access_token: string }).access_token;
}

/** Garante o Administrador de teste. POST /setup só funciona com o banco sem usuários. */
export async function ensureAdmin(): Promise<string> {
  const existente = await tokenDoAdmin();
  if (existente) return existente;

  if (!env.setupToken) {
    throw new Error("Defina E2E_SETUP_TOKEN com o mesmo valor de SETUP_TOKEN do back. Ver e2e/README.md.");
  }
  const resposta = await chamarApi("/setup", {
    method: "POST",
    headers: { "X-Setup-Token": env.setupToken },
    body: JSON.stringify({ email: env.adminEmail, name: "Admin E2E", password: env.adminPassword }),
  });
  await esperarSucesso(resposta, "Criar o Administrador de teste (o banco precisa estar vazio)");

  const token = await tokenDoAdmin();
  if (!token) throw new Error("O Administrador de teste foi criado, mas o login dele falhou.");
  return token;
}

/** Sem SMTP em ambiente local, o back escreve o e-mail de convite no log (docs/auth.md do back). */
async function lerTokenDoConvite(email: string): Promise<string> {
  const { stdout } = await executar("docker", ["compose", "logs", "--no-log-prefix", "api"], {
    cwd: env.backDir,
    maxBuffer: 50 * 1024 * 1024,
  });
  const mensagem = stdout.slice(stdout.lastIndexOf(`Para: ${email}`));
  const achado = stdout.includes(`Para: ${email}`) ? /[?&]token=([^\s&]+)/.exec(mensagem) : null;
  if (!achado) throw new Error(`Convite de ${email} não encontrado em "docker compose logs api".`);
  return decodeURIComponent(achado[1]);
}

/** Cria um usuário ativo pelo fluxo real: o Administrador convida e o convidado define a senha. */
export async function createUser(role: "operator" | "client"): Promise<TestUser> {
  const admin = await ensureAdmin();
  const email = `e2e-${role}-${Date.now()}@example.com`;
  const convite = await chamarApi("/users/invites", {
    method: "POST",
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ email, name: `E2E ${role}`, role }),
  });
  const { id } = await esperarSucesso<{ id: string }>(convite, "Convidar usuário");

  const aceite = await chamarApi("/users/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token: await lerTokenDoConvite(email), password: env.userPassword }),
  });
  await esperarSucesso(aceite, "Aceitar o convite");
  return { id, email, password: env.userPassword };
}

export async function deactivateUser(id: string): Promise<void> {
  const resposta = await chamarApi(`/users/${id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await ensureAdmin()}` },
    body: JSON.stringify({ status: "inactive" }),
  });
  await esperarSucesso(resposta, "Inativar usuário");
}
