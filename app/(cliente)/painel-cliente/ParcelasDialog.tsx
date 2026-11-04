"use client";

import { Alert, Button, DataTable, Dialog, EmptyState } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { SituacaoParcela } from "@/app/(equipe)/acompanhamento/situacao";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { ApiError } from "@/app/lib/api";
import { formatBRL } from "@/app/lib/money";
import { listParcelasDoAcordo, type AcordoDoCliente, type ParcelaDoCliente } from "./api";

/** As parcelas sem pagamento completo de um acordo (#47-CA02). O back não devolve honorários nem a divisão. */
export function ParcelasDialog({ acordo, onClose }: { acordo: AcordoDoCliente; onClose: () => void }) {
  const [parcelas, setParcelas] = useState<ParcelaDoCliente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listParcelasDoAcordo(acordo.id, controller.signal)
      .then(setParcelas)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        // Um acordo cancelado depois de a lista abrir responde 404.
        setErro(e instanceof ApiError && e.status === 404 ? "Este acordo não está mais disponível. Recarregue o painel." : e instanceof ApiError ? e.message : "Não foi possível carregar as parcelas.");
      });
    return () => controller.abort();
  }, [acordo.id]);

  return (
    <Dialog
      open
      width={640}
      title="Parcelas em aberto"
      description={`${acordo.debtor_name} · Unidade ${acordo.debtor_unit} · ${acordo.condominium_name}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      {erro && (
        <Alert tone="risk" role="alert">
          {erro}
        </Alert>
      )}
      {!parcelas && !erro && <p role="status">Carregando parcelas…</p>}
      {parcelas && (
        <div className="max-h-[60vh] overflow-auto">
          <DataTable
            rows={parcelas.map((p) => ({ ...p, id: p.number }))}
            empty={<EmptyState icon="circle-check" title="Nenhuma parcela em aberto" description="Todas as parcelas deste acordo estão pagas." />}
            columns={[
              { key: "number", label: "Parcela", mono: true },
              { key: "due_date", label: "Vencimento", mono: true, render: (p: ParcelaDoCliente) => formatDate(p.due_date) },
              { key: "amount", label: "Valor", mono: true, align: "right", render: (p: ParcelaDoCliente) => formatBRL(p.amount) },
              { key: "remaining_amount", label: "Falta pagar", mono: true, align: "right", strong: true, render: (p: ParcelaDoCliente) => formatBRL(p.remaining_amount) },
              { key: "status", label: "Situação", render: (p: ParcelaDoCliente) => <SituacaoParcela parcela={p} /> },
            ]}
          />
        </div>
      )}
    </Dialog>
  );
}
