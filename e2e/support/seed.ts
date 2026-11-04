import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
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

/** Sem SMTP em ambiente local, o back escreve os e-mails no log (docs/auth.md do back). */
async function logDaApi(): Promise<string> {
  const { stdout } = await executar("docker", ["compose", "logs", "--no-log-prefix", "api"], {
    cwd: env.backDir,
    maxBuffer: 50 * 1024 * 1024,
  });
  return stdout;
}

export async function contactEmailWasLogged(texto: string): Promise<boolean> {
  return (await logDaApi()).includes(texto);
}

export async function readInviteToken(email: string): Promise<string> {
  const stdout = await logDaApi();
  const mensagem = stdout.slice(stdout.lastIndexOf(`Para: ${email}`));
  const achado = stdout.includes(`Para: ${email}`) ? /[?&]token=([^\s&]+)/.exec(mensagem) : null;
  if (!achado) throw new Error(`Convite de ${email} não encontrado em "docker compose logs api".`);
  return decodeURIComponent(achado[1]);
}

/** Cria um usuário ativo pelo fluxo real: o Administrador convida e o convidado define a senha. */
export async function createUser(role: "operator" | "client", extras: Record<string, unknown> = {}): Promise<TestUser> {
  const admin = await ensureAdmin();
  const email = `e2e-${role}-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
  const convite = await chamarApi("/users/invites", {
    method: "POST",
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ email, name: `E2E ${role}`, role, ...extras }),
  });
  const { id } = await esperarSucesso<{ id: string }>(convite, "Convidar usuário");

  const password = randomUUID();
  const aceite = await chamarApi("/users/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token: await readInviteToken(email), password }),
  });
  await esperarSucesso(aceite, "Aceitar o convite");
  return { id, email, password };
}

export type TestCondominium = { id: string; name: string };

export async function createCondominium(name: string): Promise<TestCondominium> {
  const resposta = await chamarApi("/condominiums", {
    method: "POST",
    headers: { Authorization: `Bearer ${await ensureAdmin()}` },
    body: JSON.stringify({ name }),
  });
  return esperarSucesso<TestCondominium>(resposta, "Criar condomínio");
}

export type TestDebtor = { id: string; name: string; unit: string };

export async function createDebtor(condominiumId: string, name: string, unit: string): Promise<TestDebtor> {
  const resposta = await chamarApi("/debtors", {
    method: "POST",
    headers: { Authorization: `Bearer ${await ensureAdmin()}` },
    body: JSON.stringify({ condominium_id: condominiumId, name, unit, phone: "61912345678" }),
  });
  return esperarSucesso<TestDebtor>(resposta, "Criar devedor");
}

export type TestLawyer = TestUser & { name: string };

async function tokenDe(usuario: TestUser): Promise<string> {
  const resposta = await chamarApi("/auth/login", { method: "POST", body: JSON.stringify({ email: usuario.email, password: usuario.password }) });
  return (await esperarSucesso<{ access_token: string }>(resposta, "Entrar")).access_token;
}

/** Cadastra como este usuário: a meta conta os acordos que ele mesmo cadastrou. */
export async function createAgreementAs(usuario: TestUser, condominiumId: string, debtorId: string, firstDueDate: string): Promise<{ id: string }> {
  const resposta = await chamarApi("/agreements", {
    method: "POST",
    headers: { Authorization: `Bearer ${await tokenDe(usuario)}` },
    body: JSON.stringify({ condominium_id: condominiumId, debtor_id: debtorId, total_amount: "900.00", installment_count: 3, first_due_date: firstDueDate, fee_percentage: "10.00" }),
  });
  return esperarSucesso<{ id: string }>(resposta, "Criar acordo");
}

export async function payFirstInstallment(agreementId: string, paymentDate: string): Promise<void> {
  const headers = { Authorization: `Bearer ${await ensureAdmin()}` };
  const parcelas = await esperarSucesso<{ id: string }[]>(await chamarApi(`/agreements/${agreementId}/installments`, { headers }), "Listar parcelas");
  const resposta = await chamarApi(`/installments/${parcelas[0].id}/payment`, { method: "POST", headers, body: JSON.stringify({ payment_date: paymentDate }) });
  await esperarSucesso(resposta, "Dar baixa");
}

export async function createAgreement(condominiumId: string, debtorId: string, firstDueDate = "2030-01-31"): Promise<{ id: string }> {
  const resposta = await chamarApi("/agreements", {
    method: "POST",
    headers: { Authorization: `Bearer ${await ensureAdmin()}` },
    body: JSON.stringify({ condominium_id: condominiumId, debtor_id: debtorId, total_amount: "900.00", installment_count: 3, first_due_date: firstDueDate, fee_percentage: "10.00" }),
  });
  return esperarSucesso<{ id: string }>(resposta, "Criar acordo");
}

/** Só usuário ativo, marcado como advogado no convite e com OAB pode ser responsável. */
export async function createLawyer(name: string): Promise<TestLawyer> {
  const usuario = await createUser("operator", { name, is_lawyer: true, oab_number: `DF${String(Date.now() % 1000000).padStart(6, "0")}` });
  return { ...usuario, name };
}

export async function deactivateUser(id: string): Promise<void> {
  const resposta = await chamarApi(`/users/${id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await ensureAdmin()}` },
    body: JSON.stringify({ status: "inactive" }),
  });
  await esperarSucesso(resposta, "Inativar usuário");
}
