import { normalizeCnpj, onlyDigits } from "./format";
import type { CondominioForm } from "./types";

export type FormErrors = Partial<Record<keyof CondominioForm, string>>;

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_2 = [6, ...PESOS_1];

/** A Receita usa o código ASCII menos 48: "0" a "9" valem 0 a 9, e "A" vale 17. */
function digitoVerificador(base: string, pesos: number[]): number {
  const resto = [...base].reduce((soma, c, i) => soma + (c.charCodeAt(0) - 48) * pesos[i], 0) % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Os 2 dígitos verificadores dos 12 primeiros caracteres de um CNPJ. */
export function cnpjCheckDigits(base: string): string {
  const primeiro = digitoVerificador(base, PESOS_1);
  return `${primeiro}${digitoVerificador(`${base}${primeiro}`, PESOS_2)}`;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || new Set(cnpj).size === 1) return false;
  return cnpjCheckDigits(cnpj.slice(0, 12)) === cnpj.slice(12);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mesmas regras do back-end; o servidor continua sendo a fonte de verdade. */
export function validate(form: CondominioForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.nome.trim()) errors.nome = "Informe o nome do condomínio.";
  if (form.cnpj && !isValidCnpj(form.cnpj)) errors.cnpj = "CNPJ inválido.";
  if (form.cep && onlyDigits(form.cep).length !== 8) errors.cep = "O CEP tem 8 dígitos.";
  if (form.uf && !/^[A-Za-z]{2}$/.test(form.uf.trim())) errors.uf = "Use a sigla com 2 letras (ex.: DF).";
  if (form.sindico_email && !EMAIL.test(form.sindico_email.trim())) errors.sindico_email = "E-mail inválido.";
  if (form.sindico_telefone && ![10, 11].includes(onlyDigits(form.sindico_telefone).length)) {
    errors.sindico_telefone = "Telefone com DDD, 10 ou 11 dígitos.";
  }
  if (form.contrato_inicio && form.contrato_renovacao && form.contrato_renovacao < form.contrato_inicio) {
    errors.contrato_renovacao = "A renovação não pode ser anterior ao início do contrato.";
  }
  return errors;
}
