import { apiFetch } from "@/app/lib/api";
import type { Acordo, Advogado, AtribuicaoDeAdvogado, NovoAcordo, Parcela } from "./types";

export const LIMITE_LISTAGEM = 200;

export type FiltrosAcordo = { busca: string; status: string; responsavelId: string; condominioId: string };

export function listAcordos({ busca, status, responsavelId, condominioId }: FiltrosAcordo, signal?: AbortSignal): Promise<Acordo[]> {
  const params = new URLSearchParams({ limit: String(LIMITE_LISTAGEM) });
  if (busca.trim()) params.set("search", busca.trim());
  if (status) params.set("status", status);
  if (responsavelId) params.set("responsible_lawyer_id", responsavelId);
  if (condominioId) params.set("condominium_id", condominioId);
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

/** Da mais antiga para a mais recente. */
export function listHistoricoDeResponsaveis(acordoId: string, signal?: AbortSignal): Promise<AtribuicaoDeAdvogado[]> {
  return apiFetch<AtribuicaoDeAdvogado[]>(`/agreements/${acordoId}/lawyer-history`, { signal });
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

export type MudancasNoAcordo = {
  debtor_id?: string;
  total_amount?: string;
  fee_percentage?: string;
  fee_amount?: string;
  confirm_paid_installments: boolean;
};

/** Só os campos enviados mudam. Um valor novo recalcula as parcelas em aberto (US19). */
export function atualizarAcordo(id: string, mudancas: MudancasNoAcordo): Promise<Acordo> {
  return apiFetch<Acordo>(`/agreements/${id}`, { method: "PATCH", body: JSON.stringify(mudancas) });
}

export function cancelarAcordo(id: string, motivo: string, confirmarParcelasSemPagamento: boolean): Promise<Acordo> {
  return apiFetch<Acordo>(`/agreements/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason: motivo, confirm_open_installments: confirmarParcelasSemPagamento }) });
}

export function reativarAcordo(id: string): Promise<Acordo> {
  return apiFetch<Acordo>(`/agreements/${id}/reactivate`, { method: "POST" });
}
