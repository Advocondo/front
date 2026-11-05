/** Resposta do back-end em /condominiums. A tradução para os nomes da tela fica em api.ts. */
export type CondominioApi = {
  id: string;
  name: string;
  cnpj: string | null;
  zip_code: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  manager_name: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  contract_start_date: string | null;
  contract_renewal_date: string | null;
  near_renewal: boolean;
};

export type Condominio = {
  id: string;
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
  /** Calculado pelo back: faltam 60 dias ou menos, ou a data já passou (US23-CA01). */
  proximo_da_renovacao: boolean;
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
