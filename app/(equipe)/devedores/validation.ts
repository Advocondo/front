import { onlyDigits } from "@/app/lib/masks";
import type { DevedorForm } from "./types";

export type FormErrors = Partial<Record<keyof DevedorForm, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mesmas regras do back-end; o servidor continua sendo a fonte de verdade. */
export function validate(form: DevedorForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.condominium_id) errors.condominium_id = "Selecione o condomínio.";
  if (!form.name.trim()) errors.name = "Informe o nome do devedor.";
  if (!form.unit.trim()) errors.unit = "Informe a unidade.";

  const telefone = onlyDigits(form.phone);
  const email = form.email.trim();
  if (telefone && ![10, 11].includes(telefone.length)) errors.phone = "Telefone com DDD, 10 ou 11 dígitos.";
  if (email && !EMAIL.test(email)) errors.email = "E-mail inválido.";
  if (!telefone && !email) errors.phone = "Informe o telefone ou o e-mail do devedor.";
  return errors;
}
