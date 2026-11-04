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

export function listUsuarios(busca: string, signal?: AbortSignal): Promise<Usuario[]> {
  const params = new URLSearchParams({ limit: String(LIMITE_LISTAGEM) });
  if (busca.trim()) params.set("search", busca.trim());
  return apiFetch<Usuario[]>(`/users?${params}`, { signal });
}

export function convidarUsuario(convite: NovoConvite): Promise<Usuario> {
  return apiFetch<Usuario>("/users/invites", { method: "POST", body: JSON.stringify(convite) });
}

export function mudarStatus(id: string, status: "active" | "inactive"): Promise<Usuario> {
  return apiFetch<Usuario>(`/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function mudarPerfil(id: string, role: Role): Promise<Usuario> {
  return apiFetch<Usuario>(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
}
