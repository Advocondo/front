"use client";

import { Alert, Button, Dialog, Input } from "edson-alexandre-design-system";
import { useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { centsFromApi, centsFromMasked, centsToApi, maskMoney } from "@/app/lib/money";
import { updateParcela } from "../api";
import type { Parcela } from "../types";

type Props = {
  parcela: Parcela;
  totalDeParcelas: number;
  onClose: () => void;
  onSaved: (plano: Parcela[]) => void;
};

/** Edita valor e vencimento antes da baixa (US17-CA03). A diferença vai para as parcelas seguintes. */
export function ParcelaDialog({ parcela, totalDeParcelas, onClose, onSaved }: Props) {
  const [valor, setValor] = useState(maskMoney(centsToApi(centsFromApi(parcela.amount))));
  const [vencimento, setVencimento] = useState(parcela.due_date);
  const [erroValor, setErroValor] = useState<string | undefined>();
  const [erroVencimento, setErroVencimento] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const centavos = centsFromMasked(valor);
    const valorInvalido = centavos <= 0n ? "Informe o valor da parcela." : undefined;
    const vencimentoInvalido = vencimento ? undefined : "Informe o vencimento.";
    setErroValor(valorInvalido);
    setErroVencimento(vencimentoInvalido);
    setFormError(null);
    if (valorInvalido || vencimentoInvalido) return;

    // Só o que mudou: o back registra cada alteração no histórico financeiro (US31).
    const mudancas: { due_date?: string; amount?: string } = {};
    if (vencimento !== parcela.due_date) mudancas.due_date = vencimento;
    if (centavos !== centsFromApi(parcela.amount)) mudancas.amount = centsToApi(centavos);
    if (Object.keys(mudancas).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      onSaved(await updateParcela(parcela.id, mudancas));
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErroValor(error.fieldErrors.amount);
        setErroVencimento(error.fieldErrors.due_date);
      } else {
        setFormError(error instanceof ApiError ? error.message : "Não foi possível salvar a parcela. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={440}
      title={`Editar parcela ${parcela.number}/${totalDeParcelas}`}
      description="Ao mudar o valor, a diferença é dividida entre as parcelas seguintes em aberto, e o total do acordo não muda."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="parcela-form" loading={saving}>
            Salvar parcela
          </Button>
        </>
      }
    >
      <form id="parcela-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {formError}
          </Alert>
        )}
        <Field id="parcela-valor" label="Valor" required>
          <Input id="parcela-valor" icon="banknote" mono inputMode="numeric" value={valor} invalid={Boolean(erroValor)} error={erroValor} onChange={(e) => { setValor(maskMoney(e.target.value)); setErroValor(undefined); }} />
        </Field>
        <Field id="parcela-vencimento" label="Vencimento" required>
          <Input id="parcela-vencimento" type="date" value={vencimento} invalid={Boolean(erroVencimento)} error={erroVencimento} onChange={(e) => { setVencimento(e.target.value); setErroVencimento(undefined); }} />
        </Field>
      </form>
    </Dialog>
  );
}
