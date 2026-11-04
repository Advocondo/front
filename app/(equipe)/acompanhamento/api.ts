import { apiFetch } from "@/app/lib/api";
import type { Parcela } from "@/app/(equipe)/acordos/types";

const TAMANHO_DA_PAGINA = 200;

/** Parcela da listagem do mês, com quem deve e de qual condomínio (US25-CA01). */
export type ParcelaDoMes = Parcela & {
  condominium: { id: string; name: string };
  debtor: { id: string; name: string; unit: string };
};

export type Pagamento = { id: string; amount: string; payment_date: string; created_at: string };

export type FiltrosDoMes = { ano: number; mes: number; condominioId: string; responsavelId: string };

/** Busca todas as páginas: os totais da tela precisam do mês inteiro. */
export async function listParcelasDoMes({ ano, mes, condominioId, responsavelId }: FiltrosDoMes, signal?: AbortSignal): Promise<ParcelaDoMes[]> {
  const parcelas: ParcelaDoMes[] = [];
  for (;;) {
    const params = new URLSearchParams({ year: String(ano), month: String(mes), limit: String(TAMANHO_DA_PAGINA), offset: String(parcelas.length) });
    if (condominioId) params.set("condominium_id", condominioId);
    if (responsavelId) params.set("responsible_lawyer_id", responsavelId);
    const pagina = await apiFetch<ParcelaDoMes[]>(`/installments?${params}`, { signal });
    parcelas.push(...pagina);
    if (pagina.length < TAMANHO_DA_PAGINA) return parcelas;
  }
}

/** Sem `valor`, quita o saldo (US26); com um valor menor, é pagamento parcial (US28). */
export function registrarPagamento(parcelaId: string, data: string, valor?: string): Promise<Parcela> {
  return apiFetch<Parcela>(`/installments/${parcelaId}/payment`, {
    method: "POST",
    body: JSON.stringify(valor ? { payment_date: data, amount: valor } : { payment_date: data }),
  });
}

export function listPagamentos(parcelaId: string, signal?: AbortSignal): Promise<Pagamento[]> {
  return apiFetch<Pagamento[]>(`/installments/${parcelaId}/payments`, { signal });
}

/** Só o Administrador (US26-CA02). */
export function corrigirBaixa(parcelaId: string, data: string): Promise<Parcela> {
  return apiFetch<Parcela>(`/installments/${parcelaId}/payment`, { method: "PUT", body: JSON.stringify({ payment_date: data }) });
}

/** Só o Administrador (US26-CA02). Apaga todos os pagamentos da parcela, parciais ou não. */
export function estornarPagamentos(parcelaId: string): Promise<Parcela> {
  return apiFetch<Parcela>(`/installments/${parcelaId}/payment`, { method: "DELETE" });
}
