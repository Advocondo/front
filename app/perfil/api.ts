import { apiFetch } from "@/app/lib/api";

/** Resposta de GET /auth/sessions (US06). */
export type SessaoAtiva = {
  id: string;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
};

type MudancasDoPerfil = { name?: string; email?: string; new_password?: string; current_password?: string };

export function atualizarPerfil(mudancas: MudancasDoPerfil): Promise<{ name: string; email: string }> {
  return apiFetch("/users/me", { method: "PATCH", body: JSON.stringify(mudancas) });
}

export function listSessoes(signal?: AbortSignal): Promise<SessaoAtiva[]> {
  return apiFetch<SessaoAtiva[]>("/auth/sessions", { signal });
}

export function encerrarSessao(id: string): Promise<void> {
  return apiFetch(`/auth/sessions/${id}`, { method: "DELETE" });
}

/** Mantém a sessão deste aparelho (US06-CA01). */
export function encerrarOutrasSessoes(): Promise<void> {
  return apiFetch("/auth/sessions/others", { method: "DELETE" });
}
