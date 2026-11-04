import type { Condominio, CondominioForm, CondominioPayload } from "./types";

export const onlyDigits = (value: string): string => value.replace(/\D/g, "");

export function maskCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCep(value: string): string {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

export function maskTelefone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const split = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
}

/** 2026-01-31 -> 31/01/2026 (sem passar por Date, para não sofrer com fuso). */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export const emptyForm: CondominioForm = {
  nome: "",
  cnpj: "",
  cep: "",
  logradouro: "",
  bairro: "",
  cidade: "",
  uf: "",
  sindico_nome: "",
  sindico_email: "",
  sindico_telefone: "",
  contrato_inicio: "",
  contrato_renovacao: "",
};

export function toForm(c: Condominio): CondominioForm {
  return {
    nome: c.nome,
    cnpj: maskCnpj(c.cnpj ?? ""),
    cep: maskCep(c.cep ?? ""),
    logradouro: c.logradouro ?? "",
    bairro: c.bairro ?? "",
    cidade: c.cidade ?? "",
    uf: c.uf ?? "",
    sindico_nome: c.sindico_nome ?? "",
    sindico_email: c.sindico_email ?? "",
    sindico_telefone: maskTelefone(c.sindico_telefone ?? ""),
    contrato_inicio: c.contrato_inicio ?? "",
    contrato_renovacao: c.contrato_renovacao ?? "",
  };
}

/** Campo vazio vira null: no PATCH isso limpa o valor; no POST, "não informado". */
export function toPayload(form: CondominioForm): CondominioPayload {
  const digits = new Set<keyof CondominioForm>(["cnpj", "cep", "sindico_telefone"]);
  const payload = {} as CondominioPayload;
  for (const key of Object.keys(form) as (keyof CondominioForm)[]) {
    const raw = digits.has(key) ? onlyDigits(form[key]) : form[key].trim();
    payload[key] = raw === "" ? null : key === "uf" ? raw.toUpperCase() : raw;
  }
  return payload;
}
