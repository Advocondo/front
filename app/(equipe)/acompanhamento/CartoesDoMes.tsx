"use client";

import { Card } from "edson-alexandre-design-system";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { formatBRL } from "@/app/lib/money";
import type { ParcelaDoMes } from "./api";

type Props = {
  parcelas: ParcelaDoMes[];
  vazio: ReactNode;
  /** Os mesmos trechos da tabela do desktop, para as duas mostrarem o mesmo. */
  situacao: (p: ParcelaDoMes) => ReactNode;
  acoes: (p: ParcelaDoMes) => ReactNode;
};

/** Faturas do mês no celular: um cartão por parcela, como no protótipo mobile. */
export function CartoesDoMes({ parcelas, vazio, situacao, acoes }: Props) {
  if (parcelas.length === 0) return <>{vazio}</>;
  return (
    <ul className="grid gap-3" aria-label="Faturas do mês">
      {parcelas.map((p) => (
        <li key={p.id}>
          <Card padding="sm">
            <div className="grid gap-2">
              <div className="flex items-start justify-between gap-3">
                <span className="grid min-w-0">
                  <Link href={`/acordos/${p.agreement_id}`} className="font-semibold">{p.debtor.name}</Link>
                  <span className="text-sm">{`${p.condominium.name} · ${p.debtor.unit}`}</span>
                </span>
                <span className="font-mono font-semibold whitespace-nowrap">{formatBRL(p.amount)}</span>
              </div>
              <span className="font-mono text-sm">
                <Link href={`/faturas/${p.id}`} aria-label={`Ver a parcela ${p.number} de ${p.debtor.name}`}>{`Parcela ${p.number}`}</Link>
                {` · vence ${formatDate(p.due_date)}`}
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {situacao(p)}
                {acoes(p)}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
