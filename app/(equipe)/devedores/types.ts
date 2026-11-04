/** Resposta do back-end em /debtors (US13). */
export type Devedor = {
  id: string;
  condominium_id: string;
  name: string;
  unit: string;
  phone: string | null;
  email: string | null;
};

/** Valores de formulário: sempre texto; vazio significa "não informado". */
export type DevedorForm = {
  condominium_id: string;
  name: string;
  unit: string;
  phone: string;
  email: string;
};
