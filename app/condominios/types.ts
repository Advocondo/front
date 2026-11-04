/** Contrato do back-end: /condominios (US12). */
export type Condominio = {
  id: number;
  nome: string;
  cnpj: string | null;
  cep: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  sindico_nome: string | null;
  sindico_email: string | null;
  sindico_telefone: string | null;
  contrato_inicio: string | null;
  contrato_renovacao: string | null;
  created_at: string;
  updated_at: string;
};

/** Valores de formulário: sempre texto; vazio significa "não informado". */
export type CondominioForm = {
  nome: string;
  cnpj: string;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  sindico_nome: string;
  sindico_email: string;
  sindico_telefone: string;
  contrato_inicio: string;
  contrato_renovacao: string;
};

export type CondominioPayload = {
  [K in keyof CondominioForm]: string | null;
};
