import { ApiError, apiFetch } from "@/app/lib/api";
import type { Condominio, CondominioApi, CondominioForm, CondominioPayload } from "./types";

export const LIMITE_LISTAGEM = 200;

/** Nome de cada campo na API. O back recusa campos desconhecidos, então a lista precisa ser exata. */
const CAMPOS_API: Record<keyof CondominioForm, keyof CondominioApi> = {
  nome: "name",
  cnpj: "cnpj",
  cep: "zip_code",
  logradouro: "street",
  bairro: "neighborhood",
  cidade: "city",
  uf: "state",
  sindico_nome: "manager_name",
  sindico_email: "manager_email",
  sindico_telefone: "manager_phone",
  contrato_inicio: "contract_start_date",
  contrato_renovacao: "contract_renewal_date",
};

const CAMPOS = Object.entries(CAMPOS_API) as [keyof CondominioForm, keyof CondominioApi][];

function fromApi(api: CondominioApi): Condominio {
  const campos = Object.fromEntries(CAMPOS.map(([campo, nomeApi]) => [campo, api[nomeApi]]));
  return { id: api.id, proximo_da_renovacao: api.near_renewal, ...campos } as Condominio;
}

function toApi(payload: CondominioPayload): string {
  return JSON.stringify(Object.fromEntries(CAMPOS.map(([campo, nomeApi]) => [nomeApi, payload[campo]])));
}

/** Erros de validação (422) vêm com o nome do campo na API; a tela os mostra pelo nome dela. */
async function comErrosDaTela(chamada: Promise<CondominioApi>): Promise<Condominio> {
  try {
    return fromApi(await chamada);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const fieldErrors: Record<string, string> = {};
    for (const [campo, nomeApi] of CAMPOS) {
      const mensagem = error.fieldErrors[nomeApi];
      if (mensagem) fieldErrors[campo] = mensagem;
    }
    throw new ApiError(error.status, error.message, fieldErrors);
  }
}

export async function listCondominios(busca: string, signal?: AbortSignal): Promise<Condominio[]> {
  const params = new URLSearchParams({ limit: String(LIMITE_LISTAGEM) });
  if (busca.trim()) params.set("search", busca.trim());
  const lista = await apiFetch<CondominioApi[]>(`/condominiums?${params}`, { signal });
  return lista.map(fromApi);
}

export function createCondominio(payload: CondominioPayload): Promise<Condominio> {
  return comErrosDaTela(apiFetch<CondominioApi>("/condominiums", { method: "POST", body: toApi(payload) }));
}

/** A renovação começa em `inicio`, e `proximaRenovacao` passa a ser a referência do próximo aviso (US23-CA02). */
export function registrarRenovacao(id: string, inicio: string, proximaRenovacao: string): Promise<Condominio> {
  return comErrosDaTela(apiFetch<CondominioApi>(`/condominiums/${id}`, { method: "PATCH", body: JSON.stringify({ contract_start_date: inicio, contract_renewal_date: proximaRenovacao }) }));
}

export function updateCondominio(id: string, payload: CondominioPayload): Promise<Condominio> {
  return comErrosDaTela(apiFetch<CondominioApi>(`/condominiums/${id}`, { method: "PATCH", body: toApi(payload) }));
}
