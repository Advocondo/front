"use client";

import { Alert, Button, Dialog, Textarea } from "edson-alexandre-design-system";
import { useState, type FormEvent } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { centsFromApi, formatBRL } from "@/app/lib/money";
import { cancelarAcordo } from "../api";
import type { Acordo, Parcela } from "../types";

const MAX_MOTIVO = 500;

type Props = {
  acordo: Acordo;
  parcelas: Parcela[];
  onClose: () => void;
  onSaved: () => void;
};

/** US20: o acordo sai dos ativos, e o histórico continua consultável. */
export function CancelarAcordoDialog({ acordo, parcelas, onClose, onSaved }: Props) {
  const [motivo, setMotivo] = useState("");
  const [erroMotivo, setErroMotivo] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [backPediuConfirmacao, setBackPediuConfirmacao] = useState(false);
  const [saving, setSaving] = useState(false);

  const semPagamento = parcelas.filter((p) => p.status !== "paid");
  const totalSemPagamento = semPagamento.reduce((soma, p) => soma + centsFromApi(p.amount), 0n);

  async function confirmar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    const texto = motivo.trim();
    const invalido = !texto ? "Informe o motivo do cancelamento." : texto.length > MAX_MOTIVO ? `Use até ${MAX_MOTIVO} caracteres.` : undefined;
    setErroMotivo(invalido);
    if (invalido) return;

    setSaving(true);
    try {
      // O diálogo já avisou das parcelas sem pagamento. Se a lista estava velha, o back recusa com o número certo.
      await cancelarAcordo(acordo.id, texto, semPagamento.length > 0 || backPediuConfirmacao);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setBackPediuConfirmacao(true);
      setErro(e instanceof ApiError ? e.message : "Não foi possível cancelar o acordo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={480}
      title="Cancelar este acordo?"
      description={`${acordo.debtor.name} · ${acordo.condominium.name}. O acordo sai da lista de ativos, não gera novas parcelas e o histórico de pagamentos continua consultável.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Voltar
          </Button>
          <Button type="submit" form="cancelar-acordo-form" variant="danger" loading={saving}>
            Cancelar acordo
          </Button>
        </>
      }
    >
      <form id="cancelar-acordo-form" onSubmit={confirmar} noValidate className="flex flex-col gap-4">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível cancelar">
            {erro}
          </Alert>
        )}
        {semPagamento.length > 0 && (
          <Alert tone="warn" title={semPagamento.length === 1 ? "1 parcela sem pagamento" : `${semPagamento.length} parcelas sem pagamento`}>
            {`Somam ${formatBRL(totalSemPagamento)} e saem da cobrança. Elas voltam se o acordo for reativado.`}
          </Alert>
        )}
        <Field id="cancelar-motivo" label="Motivo" required>
          <Textarea id="cancelar-motivo" rows={3} maxLength={MAX_MOTIVO} placeholder="Ex.: devedor quitou direto com o condomínio" value={motivo} invalid={Boolean(erroMotivo)} onChange={(e) => { setMotivo(e.target.value); setErroMotivo(undefined); }} />
          {erroMotivo && <span role="alert" className="text-sm text-red-700">{erroMotivo}</span>}
        </Field>
      </form>
    </Dialog>
  );
}
