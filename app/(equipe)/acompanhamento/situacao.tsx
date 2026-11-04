import { StatusPill } from "edson-alexandre-design-system";
import type { Parcela } from "@/app/(equipe)/acordos/types";

type DadosDaSituacao = Pick<Parcela, "status" | "amount" | "remaining_amount">;

export const temPagamentoParcial = (parcela: DadosDaSituacao): boolean => parcela.status !== "paid" && parcela.remaining_amount !== parcela.amount;

/** Só parcela paga aparece como paga: com pagamento parcial, o saldo continua devido (US28-CA01). */
export function SituacaoParcela({ parcela }: { parcela: DadosDaSituacao }) {
  if (parcela.status === "paid") return <StatusPill label="Paga" tone="ok" />;
  if (parcela.status === "overdue") return <StatusPill label="Atrasada" tone="risk" />;
  if (temPagamentoParcial(parcela)) return <StatusPill label="Parcial" tone="warn" />;
  return <StatusPill label="Em aberto" tone="info" />;
}
