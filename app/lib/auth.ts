import { apiFetch } from "./api";
import { clearSession, saveSession, type Role, type Session } from "./session";

type LoginResponse = {
  access_token: string;
  expires_at: string;
  user: Session["user"];
};

/** Tela inicial de cada perfil (US02-CA01). A Equipe Operacional ainda não tem painel próprio. */
export function homeForRole(role: Role): string {
  if (role === "admin") return "/painel";
  return role === "client" ? "/painel-cliente" : "/condominios";
}

export async function logIn(email: string, password: string, manterConectado: boolean): Promise<void> {
  const resposta = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, remember_me: manterConectado }),
  });
  saveSession({ token: resposta.access_token, expiresAt: resposta.expires_at, user: resposta.user }, manterConectado);
}

/** Sai mesmo se o servidor falhar: a sessão local acaba e o guard leva ao login. */
export async function logOut(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // Sem rede, o token só deixa de valer quando expirar. A saída local continua valendo.
  } finally {
    clearSession();
  }
}
