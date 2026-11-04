"use client";

import { Alert, Button, Dialog, Input } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { hojeEmBrasilia } from "@/app/lib/dates";
import { formatBRL } from "@/app/lib/money";
import { useSession } from "@/app/lib/session";
import { formatDate } from "@/app/(equipe)/condominios/format";
import type { Parcela } from "@/app/(equipe)/acordos/types";
import { corrigirBaixa, estornarPagamentos, listPagamentos, type Pagamento } from "./api";

type Props = {
  parcela: Parcela;
  descricao: string;
  onClose: () => void;
  onChanged: (atualizada: Parcela, aviso: string) => void;
};

/** Histórico de pagamentos (US28-CA02) e, para o Administrador, correção e estorno (US26-CA02). */
export function PagamentosDialog({ parcela, descricao, onClose, onChanged }: Props) {
  const session = useSession();
  const administrador = session?.user.role === "admin";
  const [pagamentos, setPagamentos] = useState<Pagamento[] | null>(null);
  const [data, setData] = useState(parcela.payment_date ?? "");
  const [confirmandoEstorno, setConfirmandoEstorno] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listPagamentos(parcela.id, controller.signal)
      .then(setPagamentos)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os pagamentos.");
      });
    return () => controller.abort();
  }, [parcela.id]);

  async function executar(acao: () => Promise<Parcela>, aviso: string) {
    setSaving(true);
    setErro(null);
    try {
      onChanged(await acao(), aviso);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível concluir a operação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const paga = parcela.status === "paid";
  const dataInvalida = !data || data > hojeEmBrasilia() || data === parcela.payment_date;

  return (
    <Dialog
      open
      width={520}
      title={`Pagamentos da parcela ${parcela.number}`}
      description={descricao}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível concluir">
            {erro}
          </Alert>
        )}

        {!pagamentos && !erro && <p role="status">Carregando pagamentos…</p>}
        {pagamentos && (
          <ul className="flex flex-col gap-2">
            {pagamentos.map((pagamento) => (
              <li key={pagamento.id} className="flex justify-between gap-4 text-sm">
                <span>{formatDate(pagamento.payment_date)}</span>
                <strong>{formatBRL(pagamento.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm font-medium">{paga ? "Parcela quitada." : `Saldo em aberto: ${formatBRL(parcela.remaining_amount)}`}</p>

        {administrador && pagamentos && pagamentos.length > 0 && (
          <div className="flex flex-col gap-4 border-t pt-4" style={{ borderColor: "var(--border-default, #ddd)" }}>
            {paga && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <Field id="correcao-data" label="Corrigir a data da baixa">
                    <Input id="correcao-data" type="date" max={hojeEmBrasilia()} value={data} onChange={(e) => setData(e.target.value)} />
                  </Field>
                </div>
                <Button variant="secondary" disabled={dataInvalida} loading={saving} onClick={() => void executar(() => corrigirBaixa(parcela.id, data), "Data da baixa corrigida com sucesso.")}>
                  Corrigir data
                </Button>
              </div>
            )}
            {confirmandoEstorno ? (
              <Alert
                tone="risk"
                title="Estornar os pagamentos?"
                action={
                  <Button size="sm" variant="danger" loading={saving} onClick={() => void executar(() => estornarPagamentos(parcela.id), "Pagamentos estornados com sucesso.")}>
                    Confirmar estorno
                  </Button>
                }
              >
                Todos os pagamentos desta parcela serão apagados, e ela volta a ficar em aberto.
              </Alert>
            ) : (
              <div>
                <Button variant="danger" size="sm" onClick={() => setConfirmandoEstorno(true)}>
                  Estornar pagamentos
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
