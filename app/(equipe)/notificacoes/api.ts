import { apiFetch } from "@/app/lib/api";

/** Resposta do back-end em /notifications (US30). */
export type Notificacao = {
  id: string;
  created_at: string;
  read_at: string | null;
  installment: {
    id: string;
    agreement_id: string;
    number: number;
    installment_count: number;
    due_date: string;
    remaining_amount: string;
    debtor: { id: string; name: string; unit: string };
  };
};

export type PaginaDeNotificacoes = { unread_count: number; notifications: Notificacao[] };

export const TAMANHO_DA_PAGINA = 50;

export function listNotificacoes(offset: number, signal?: AbortSignal): Promise<PaginaDeNotificacoes> {
  return apiFetch<PaginaDeNotificacoes>(`/notifications?limit=${TAMANHO_DA_PAGINA}&offset=${offset}`, { signal });
}

/** `unread_count` conta todas as não lidas, então uma notificação na página já basta. */
export function contarNaoLidas(signal?: AbortSignal): Promise<PaginaDeNotificacoes> {
  return apiFetch<PaginaDeNotificacoes>("/notifications?limit=1", { signal });
}

export function marcarComoLida(id: string): Promise<Notificacao> {
  return apiFetch<Notificacao>(`/notifications/${id}/read`, { method: "POST" });
}

export function marcarTodasComoLidas(): Promise<void> {
  return apiFetch("/notifications/read", { method: "POST" });
}
