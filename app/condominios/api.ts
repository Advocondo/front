import { apiFetch } from "@/app/lib/api";
import type { Condominio, CondominioPayload } from "./types";

export const LIMITE_LISTAGEM = 200;

export function listCondominios(q: string, signal?: AbortSignal): Promise<Condominio[]> {
  const params = new URLSearchParams({ limit: String(LIMITE_LISTAGEM) });
  if (q.trim()) params.set("q", q.trim());
  return apiFetch<Condominio[]>(`/condominios?${params}`, { signal });
}

export function createCondominio(payload: CondominioPayload): Promise<Condominio> {
  return apiFetch<Condominio>("/condominios", { method: "POST", body: JSON.stringify(payload) });
}

export function updateCondominio(id: number, payload: CondominioPayload): Promise<Condominio> {
  return apiFetch<Condominio>(`/condominios/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
