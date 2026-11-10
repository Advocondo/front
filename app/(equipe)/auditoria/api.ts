import { apiFetch } from "@/app/lib/api";
import type { MovimentacaoFinanceira } from "@/app/(equipe)/acordos/types";
import type { RegistroDoUsuario } from "@/app/(equipe)/usuarios/api";

export const TAMANHO_DA_PAGINA = 50;

export type Categoria = "financial" | "users";

type Pessoa = { id: string; name: string };

/** Uma linha de GET /audit, que junta as movimentações de parcela, as alterações do acordo e a gestão de usuários. */
export type RegistroDeAuditoria = {
  id: string;
  occurred_at: string;
  category: Categoria;
  action: MovimentacaoFinanceira["change"] | RegistroDoUsuario["action"];
  actor: Pessoa | null;
  old_value: string | null;
  new_value: string | null;
  agreement: { id: string; debtor: { id: string; name: string; unit: string }; condominium: Pessoa } | null;
  installment_number: number | null;
  field: MovimentacaoFinanceira["field"];
  target_user: Pessoa | null;
  added_condominiums: Pessoa[];
  removed_condominiums: Pessoa[];
};

export type PaginaDaTrilha = { total: number; entries: RegistroDeAuditoria[] };

export type FiltrosDaTrilha = { autor: string; de: string; ate: string; categoria: "" | Categoria };

export function listarTrilha(filtros: FiltrosDaTrilha, offset: number, signal?: AbortSignal): Promise<PaginaDaTrilha> {
  const params = new URLSearchParams({ limit: String(TAMANHO_DA_PAGINA), offset: String(offset) });
  if (filtros.autor) params.set("actor_id", filtros.autor);
  if (filtros.de) params.set("date_from", filtros.de);
  if (filtros.ate) params.set("date_to", filtros.ate);
  if (filtros.categoria) params.set("category", filtros.categoria);
  return apiFetch<PaginaDaTrilha>(`/audit?${params}`, { signal });
}
