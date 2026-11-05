import { apiFetch } from "@/app/lib/api";
import type { Role } from "@/app/lib/session";

export type StatusUsuario = "pending" | "active" | "inactive";

/** Resposta do back-end em /users (US07, US08, US09). */
export type Usuario = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: StatusUsuario;
  is_lawyer: boolean;
  oab_number: string | null;
};

/** O usuário convidado e se o e-mail com o link saiu. */
export type ResultadoDoConvite = Usuario & { invite_sent: boolean };

export type NovoConvite = {
  name: string;
  email: string;
  role: "operator" | "client";
  is_lawyer: boolean;
  oab_number: string | null;
};

const LIMITE_LISTAGEM = 200;

export const ROTULO_DO_PERFIL: Record<Role, string> = {
  admin: "Administrador",
  operator: "Equipe Operacional",
  client: "Cliente",
};

export const ROTULO_DA_SITUACAO: Record<StatusUsuario, string> = {
  active: "Ativo",
  pending: "Pendente",
  inactive: "Inativo",
};

/** Uma ação do histórico do usuário (US11). */
export type RegistroDoUsuario = {
  id: string;
  created_at: string;
  action: "invited" | "status_changed" | "role_changed" | "condominiums_changed";
  old_value: string | null;
  new_value: string | null;
  added_condominiums: { id: string; name: string }[];
  removed_condominiums: { id: string; name: string }[];
  actor: { id: string; name: string } | null;
};

export function listUsuarios(busca: string, signal?: AbortSignal): Promise<Usuario[]> {
  const params = new URLSearchParams({ limit: String(LIMITE_LISTAGEM) });
  if (busca.trim()) params.set("search", busca.trim());
  return apiFetch<Usuario[]>(`/users?${params}`, { signal });
}

export function convidarUsuario(convite: NovoConvite): Promise<ResultadoDoConvite> {
  return apiFetch<ResultadoDoConvite>("/users/invites", { method: "POST", body: JSON.stringify(convite) });
}

/** Gera um link novo, e o anterior deixa de valer. */
export function reenviarConvite(id: string): Promise<ResultadoDoConvite> {
  return apiFetch<ResultadoDoConvite>(`/users/${id}/invite/resend`, { method: "POST" });
}

export function mudarStatus(id: string, status: "active" | "inactive"): Promise<Usuario> {
  return apiFetch<Usuario>(`/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function mudarPerfil(id: string, role: Role): Promise<Usuario> {
  return apiFetch<Usuario>(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
}

/** Condomínio vinculado a um Cliente (US10). */
export type Vinculo = { id: string; name: string };

export function listVinculos(id: string, signal?: AbortSignal): Promise<Vinculo[]> {
  return apiFetch<Vinculo[]>(`/users/${id}/condominiums`, { signal });
}

/** Substitui a lista inteira: quem não vier nela deixa de estar vinculado. */
export function salvarVinculos(id: string, condominiumIds: string[]): Promise<Vinculo[]> {
  return apiFetch<Vinculo[]>(`/users/${id}/condominiums`, { method: "PUT", body: JSON.stringify({ condominium_ids: condominiumIds }) });
}

/** Da ação mais recente para a mais antiga. */
export async function listHistoricoDoUsuario(id: string, signal?: AbortSignal): Promise<RegistroDoUsuario[]> {
  return (await apiFetch<{ logs: RegistroDoUsuario[] }>(`/users/${id}/history`, { signal })).logs;
}
