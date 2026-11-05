/** Respostas do back-end em /agreements e /installments (US15, US16, US17). */
export type Advogado = { id: string; name: string; oab_number: string | null };

export type Acordo = {
  id: string;
  status: "active" | "cancelled";
  total_amount: string;
  fee_amount: string;
  fee_percentage: string | null;
  installment_count: number;
  condominium: { id: string; name: string };
  debtor: { id: string; name: string; unit: string };
  responsible_lawyer: Advogado | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

export type AtribuicaoDeAdvogado = {
  id: string;
  previous_lawyer: Advogado | null;
  new_lawyer: Advogado;
  assigned_by: { id: string; name: string };
  assigned_at: string;
};

export type Parcela = {
  id: string;
  agreement_id: string;
  number: number;
  due_date: string;
  amount: string;
  condominium_amount: string;
  fee_amount: string;
  payment_date: string | null;
  remaining_amount: string;
  invoice_number: string | null;
  invoice_date: string | null;
  status: "open" | "paid" | "overdue";
};

/** Resposta de GET /agreements/{id}/financial-history (US31). */
export type MovimentacaoFinanceira = {
  changed_at: string;
  changed_by: { id: string; name: string };
  change: "payment_recorded" | "payment_corrected" | "payment_reversed" | "due_date_edited" | "amount_edited" | "agreement_edited";
  installment_number: number | null;
  field: "debtor" | "total_amount" | "fee_amount" | null;
  old_value: string | null;
  new_value: string | null;
};

export type NovoAcordo = {
  condominium_id: string;
  debtor_id: string;
  total_amount: string;
  installment_count: number;
  first_due_date: string;
  fee_percentage: string | null;
  fee_amount: string | null;
};
