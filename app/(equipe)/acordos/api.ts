import { apiFetch } from "@/app/lib/api";
import type { Acordo, Advogado, NovoAcordo, Parcela } from "./types";

export const LIMITE_LISTAGEM = 200;

export function listAcordos(busca: string, status: string, signal?: AbortSignal): Promise<Acordo[]> {
  const params = new URLSearchParams({ limit: String(LIMITE_LISTAGEM) });
  if (busca.trim()) params.set("search", busca.trim());
  if (status) params.set("status", status);
  return apiFetch<Acordo[]>(`/agreements?${params}`, { signal });
}

export function getAcordo(id: string, signal?: AbortSignal): Promise<Acordo> {
  return apiFetch<Acordo>(`/agreements/${id}`, { signal });
}

export function createAcordo(acordo: NovoAcordo): Promise<Acordo> {
  return apiFetch<Acordo>("/agreements", { method: "POST", body: JSON.stringify(acordo) });
}

/** O back cadastra o acordo sem responsável; a atribuição é uma chamada à parte (US18). */
export function assignLawyer(acordoId: string, advogadoId: string): Promise<Acordo> {
  return apiFetch<Acordo>(`/agreements/${acordoId}/responsible-lawyer`, { method: "PUT", body: JSON.stringify({ lawyer_id: advogadoId }) });
}

export function listAdvogados(signal?: AbortSignal): Promise<Advogado[]> {
  return apiFetch<Advogado[]>("/users/lawyers", { signal });
}

export function listParcelas(acordoId: string, signal?: AbortSignal): Promise<Parcela[]> {
  return apiFetch<Parcela[]>(`/agreements/${acordoId}/installments`, { signal });
}

/** Devolve o plano inteiro, porque um valor novo também muda as parcelas seguintes. */
export function updateParcela(id: string, mudancas: { due_date?: string; amount?: string }): Promise<Parcela[]> {
  return apiFetch<Parcela[]>(`/installments/${id}`, { method: "PATCH", body: JSON.stringify(mudancas) });
}
