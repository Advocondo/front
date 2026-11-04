import { apiFetch } from "@/app/lib/api";

/** Respostas do back-end em /goals e nos painéis financeiros (US32, US33, US36). */
export type MinhaMeta = {
  id: string;
  user_id: string;
  year: number;
  month: number;
  target_amount: string;
  achieved_amount: string;
  attainment_percentage: string;
};

export type MetaDoColaborador = {
  user_id: string;
  user_name: string;
  target_amount: string | null;
  achieved_amount: string;
  attainment_percentage: string | null;
};

export type ResumoDoOperador = {
  goal: string | null;
  accumulated_commission: string;
  remaining_to_goal: string | null;
  period: { month: number; year: number };
};

export type ResumoDoEscritorio = {
  office_total_revenue: string;
  team_commissions: { user_id: string; user_name: string; commission: string }[];
  period: { month: number; year: number };
};

export type IndicadoresDoMes = {
  active_agreements: number;
  monthly_default_rate: number;
  overdue_installments: number;
  installments_due: number;
  paid_commissions: string;
  period: { month: number; year: number };
};

const periodo = (ano: number, mes: number): string => `year=${ano}&month=${mes}`;

export function getMinhaMeta(ano: number, mes: number, signal?: AbortSignal): Promise<MinhaMeta> {
  return apiFetch<MinhaMeta>(`/goals/me?${periodo(ano, mes)}`, { signal });
}

/** Só do mês atual: a API do painel não recebe outro período. */
export function getResumoDoOperador(signal?: AbortSignal): Promise<ResumoDoOperador> {
  return apiFetch<ResumoDoOperador>("/operator-panel/financial", { signal });
}

export function listMetasDaEquipe(ano: number, mes: number, signal?: AbortSignal): Promise<MetaDoColaborador[]> {
  return apiFetch<MetaDoColaborador[]>(`/goals?${periodo(ano, mes)}`, { signal });
}

/** Só do mês atual: a API do painel não recebe outro período. */
export function getResumoDoEscritorio(signal?: AbortSignal): Promise<ResumoDoEscritorio> {
  return apiFetch<ResumoDoEscritorio>("/admin-panel/financial", { signal });
}

export function getIndicadores(ano: number, mes: number, signal?: AbortSignal): Promise<IndicadoresDoMes> {
  return apiFetch<IndicadoresDoMes>(`/admin-panel/dashboard?${periodo(ano, mes)}`, { signal });
}

export function definirMeta(usuarioId: string, ano: number, mes: number, valor: string): Promise<unknown> {
  return apiFetch(`/users/${usuarioId}/goals/${ano}/${mes}`, { method: "PUT", body: JSON.stringify({ target_amount: valor }) });
}
