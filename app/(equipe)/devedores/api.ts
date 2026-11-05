import { ApiError, apiFetch, apiFetchBlob } from "@/app/lib/api";
import { onlyDigits } from "@/app/lib/masks";
import type { Devedor, DevedorForm } from "./types";

export const LIMITE_LISTAGEM = 200;

export type ResultadoCadastro = { tipo: "cadastrado"; devedor: Devedor } | { tipo: "parecidos"; parecidos: Devedor[] };

function dadosDoDevedor(form: DevedorForm) {
  return {
    name: form.name.trim(),
    unit: form.unit.trim(),
    phone: onlyDigits(form.phone) || null,
    email: form.email.trim() || null,
  };
}

export function listDevedores(busca: string, condominioId: string, signal?: AbortSignal): Promise<Devedor[]> {
  const params = new URLSearchParams({ limit: String(LIMITE_LISTAGEM) });
  if (busca.trim()) params.set("search", busca.trim());
  if (condominioId) params.set("condominium_id", condominioId);
  return apiFetch<Devedor[]>(`/debtors?${params}`, { signal });
}

/** O 409 é um alerta, não uma recusa: com `confirmarDuplicidade`, o cadastro é feito mesmo assim. */
export async function createDevedor(form: DevedorForm, confirmarDuplicidade: boolean): Promise<ResultadoCadastro> {
  try {
    const devedor = await apiFetch<Devedor>("/debtors", {
      method: "POST",
      body: JSON.stringify({ condominium_id: form.condominium_id, ...dadosDoDevedor(form), confirm_duplicate: confirmarDuplicidade }),
    });
    return { tipo: "cadastrado", devedor };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const { similar_debtors: parecidos } = error.body as { similar_debtors: Devedor[] };
      return { tipo: "parecidos", parecidos };
    }
    throw error;
  }
}

/** O condomínio não muda depois do cadastro. */
export function updateDevedor(id: string, form: DevedorForm): Promise<Devedor> {
  return apiFetch<Devedor>(`/debtors/${id}`, { method: "PATCH", body: JSON.stringify(dadosDoDevedor(form)) });
}

/** Uma linha da planilha, com o número dela no Excel (US14). */
export type LinhaDaPlanilha = {
  number: number;
  status: "valid" | "invalid" | "similar";
  values: Record<string, string | null>;
  errors: string[];
  similar_debtors: Devedor[];
  repeats_row: number | null;
};

export type ResultadoDaPlanilha = { confirmed: boolean; imported: number; rows: LinhaDaPlanilha[] };

/** `confirmar` falso só valida. Verdadeiro grava as linhas válidas, validando tudo de novo. */
export function enviarPlanilha(condominioId: string, arquivo: File, confirmar: boolean, signal?: AbortSignal): Promise<ResultadoDaPlanilha> {
  const corpo = new FormData();
  corpo.append("condominium_id", condominioId);
  corpo.append("file", arquivo);
  corpo.append("confirm", String(confirmar));
  return apiFetch<ResultadoDaPlanilha>("/debtors/import", { method: "POST", body: corpo, signal });
}

export function baixarModeloDePlanilha(): Promise<Blob> {
  return apiFetchBlob("/debtors/import/template");
}
