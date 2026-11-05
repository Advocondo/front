"use client";

import { Alert, Button, Dialog } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { ApiError } from "@/app/lib/api";
import { formatBRL } from "@/app/lib/money";
import { LIMITE_DE_PENDENCIAS, listPagasSemNota, type ParcelaDoMes } from "./api";
import { NotaFiscalDialog } from "./NotaFiscalDialog";

const descricaoDe = (p: ParcelaDoMes): string => `${p.debtor.name} · ${p.condominium.name} · ${p.debtor.unit}`;

/** US29-CA02: as parcelas pagas sem nota de todos os meses, da baixa mais antiga para a mais recente. */
export function PendenciasDeNotaDialog({ onClose, onChanged }: { onClose: () => void; onChanged: (texto: string) => void }) {
  const [parcelas, setParcelas] = useState<ParcelaDoMes[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [registrando, setRegistrando] = useState<ParcelaDoMes | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listPagasSemNota(controller.signal)
      .then((lista) => {
        setParcelas(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar as pendências.");
      });
    return () => controller.abort();
  }, [recarregar]);

  return (
    <>
      <Dialog
        open
        width={640}
        title="Pagas sem nota fiscal"
        description="Todos os meses, da baixa mais antiga para a mais recente."
        onClose={onClose}
        footer={
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        }
      >
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
          {erro && (
            <Alert tone="risk" title="Não foi possível carregar" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
              {erro}
            </Alert>
          )}
          {!parcelas && !erro && <p role="status">Carregando pendências…</p>}
          {parcelas?.length === 0 && <p className="text-sm">Nenhuma parcela paga sem nota fiscal.</p>}
          {parcelas && parcelas.length > 0 && (
            <ul className="grid gap-3">
              {parcelas.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{`${p.debtor.name} · parcela ${p.number}`}</p>
                    <p className="text-sm">{`${p.condominium.name} · ${formatBRL(p.amount)} · pago em ${formatDate(p.payment_date)}`}</p>
                  </div>
                  <Button size="sm" variant="secondary" aria-label={`Registrar a nota da parcela ${p.number} de ${p.debtor.name}`} onClick={() => setRegistrando(p)}>
                    Registrar nota
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {parcelas?.length === LIMITE_DE_PENDENCIAS && <p className="text-sm">{`Mostrando as ${LIMITE_DE_PENDENCIAS} mais antigas. Registre estas para ver as seguintes.`}</p>}
        </div>
      </Dialog>

      {registrando && (
        <NotaFiscalDialog
          parcela={registrando}
          descricao={descricaoDe(registrando)}
          onClose={() => setRegistrando(null)}
          onSaved={() => {
            setRegistrando(null);
            onChanged("Nota fiscal registrada com sucesso.");
            setRecarregar((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
