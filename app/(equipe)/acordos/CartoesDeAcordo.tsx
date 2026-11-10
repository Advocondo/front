"use client";

import { Card } from "edson-alexandre-design-system";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatBRL } from "@/app/lib/money";
import { StatusAcordo } from "./AcordosView";
import type { Acordo } from "./types";

/** Acordos no celular: um cartão por acordo, que leva ao detalhe, como no protótipo mobile. */
export function CartoesDeAcordo({ acordos, vazio }: { acordos: Acordo[]; vazio: ReactNode }) {
  if (acordos.length === 0) return <>{vazio}</>;
  return (
    <ul className="grid gap-3" aria-label="Acordos">
      {acordos.map((a) => (
        <li key={a.id}>
          <Link href={`/acordos/${a.id}`} aria-label={`Ver o acordo de ${a.debtor.name}`} style={{ color: "inherit", textDecoration: "none" }}>
            <Card padding="sm" interactive>
              <div className="grid gap-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid min-w-0">
                    <span className="font-semibold">{a.debtor.name}</span>
                    <span className="text-sm">{`${a.condominium.name} · ${a.debtor.unit}`}</span>
                  </span>
                  <StatusAcordo status={a.status} />
                </div>
                <div className="flex items-baseline justify-between gap-3 font-mono text-sm">
                  <span>{`${a.installment_count}x · honorários ${formatBRL(a.fee_amount)}`}</span>
                  <span className="font-semibold whitespace-nowrap">{formatBRL(a.total_amount)}</span>
                </div>
                <span className="text-sm">{`Responsável: ${a.responsible_lawyer?.name ?? "—"}`}</span>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
