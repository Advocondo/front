import { apiFetch } from "@/app/lib/api";

/** Resposta de GET /client-panel/agreements (US37). O back não devolve valores, honorários nem comissões. */
export type AcordoDoCliente = {
  id: string;
  condominium_name: string;
  debtor_id: string;
  debtor_name: string;
  debtor_unit: string;
  status: "em_dia" | "atrasado";
  overdue_installments: number;
  next_due_date: string | null;
};

/** O back já traz só os condomínios vinculados (US10), com os atrasados primeiro. */
export function listAcordosDoCliente(signal?: AbortSignal): Promise<AcordoDoCliente[]> {
  return apiFetch<AcordoDoCliente[]>("/client-panel/agreements", { signal });
}

/** Uma competência (mês de vencimento) do histórico: só totais, sem honorários (US38-CA01). */
export type CompetenciaDoHistorico = {
  month: string;
  paid_amount: string;
  open_amount: string;
  status: "pago" | "em_aberto" | "atrasado";
};

export type HistoricoDoMorador = {
  debtor_name: string;
  debtor_unit: string;
  months: CompetenciaDoHistorico[];
};

export function getHistoricoDoMorador(id: string, signal?: AbortSignal): Promise<HistoricoDoMorador> {
  return apiFetch<HistoricoDoMorador>(`/client-panel/debtors/${id}/history`, { signal });
}
