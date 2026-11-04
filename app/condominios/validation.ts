import { onlyDigits } from "./format";
import type { CondominioForm } from "./types";

export type FormErrors = Partial<Record<keyof CondominioForm, string>>;

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || new Set(cnpj).size === 1) return false;
  const digit = (base: string, weights: number[]) => {
    const rest = base.split("").reduce((sum, d, i) => sum + Number(d) * weights[i], 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  return digit(cnpj.slice(0, 12), w1) === Number(cnpj[12]) && digit(cnpj.slice(0, 13), w2) === Number(cnpj[13]);
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
