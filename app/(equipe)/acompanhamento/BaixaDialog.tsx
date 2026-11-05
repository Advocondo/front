"use client";

import { Alert, Button, Checkbox, Dialog, Input } from "edson-alexandre-design-system";
import { useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { hojeEmBrasilia } from "@/app/lib/dates";
import { centsFromApi, centsFromMasked, centsToApi, formatBRL, maskMoney } from "@/app/lib/money";
import { formatDate } from "@/app/(equipe)/condominios/format";
import type { Parcela } from "@/app/(equipe)/acordos/types";
import { MAX_DIGITOS_DA_NOTA, registrarNotaFiscal, registrarPagamento } from "./api";

type Props = {
  parcela: Parcela;
  /** Quem deve e de qual acordo, para o usuário conferir antes de confirmar. */
  descricao: string;
  onClose: () => void;
  /** `notaFalhou`: a baixa foi gravada, mas a nota informada junto não. */
  onSaved: (atualizada: Parcela, notaFalhou: boolean) => void;
};

/** O texto do aviso depois da baixa, igual nas telas que a oferecem. */
export function textoDaBaixa(atualizada: Parcela, notaFalhou: boolean): string {
  if (notaFalhou) return "Baixa registrada, mas a nota fiscal não foi salva. Registre a nota de novo.";
  return atualizada.status === "paid" ? "Baixa registrada com sucesso." : "Pagamento parcial registrado com sucesso.";
}

export function BaixaDialog({ parcela, descricao, onClose, onSaved }: Props) {
  const saldo = centsFromApi(parcela.remaining_amount);
  const [valor, setValor] = useState(maskMoney(centsToApi(saldo)));
  const [data, setData] = useState(hojeEmBrasilia());
  const [erroValor, setErroValor] = useState<string | undefined>();
  const [erroData, setErroData] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notaEmitida, setNotaEmitida] = useState(false);
  const [numeroDaNota, setNumeroDaNota] = useState("");
  const [erroNota, setErroNota] = useState<string | undefined>();

  const centavos = centsFromMasked(valor);
  const parcial = centavos > 0n && centavos < saldo;

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const valorInvalido = centavos <= 0n ? "Informe o valor pago." : centavos > saldo ? `O valor pago passa do saldo de ${formatBRL(saldo)}.` : undefined;
    const dataInvalida = !data ? "Informe a data do pagamento." : data > hojeEmBrasilia() ? "A data do pagamento não pode ser futura." : undefined;
    setErroValor(valorInvalido);
    setErroData(dataInvalida);
    setFormError(null);
    // O back só aceita nota em parcela quitada, então um pagamento parcial não a envia.
    const enviarNota = notaEmitida && !parcial;
    const notaInvalida = enviarNota && !numeroDaNota ? "Informe o número da nota fiscal." : undefined;
    setErroNota(notaInvalida);
    if (valorInvalido || dataInvalida || notaInvalida) return;

    setSaving(true);
    try {
      const atualizada = await registrarPagamento(parcela.id, data, parcial ? centsToApi(centavos) : undefined);
      // A baixa já existe aqui: uma falha na nota não pode parecer falha na baixa.
      const notaFalhou = enviarNota ? await registrarNotaFiscal(parcela.id, numeroDaNota, hojeEmBrasilia()).then(() => false, () => true) : false;
      onSaved(atualizada, notaFalhou);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErroValor(error.fieldErrors.amount);
        setErroData(error.fieldErrors.payment_date);
      } else {
        setFormError(error instanceof ApiError ? error.message : "Não foi possível registrar o pagamento. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={480}
      title="Registrar baixa"
      description={`${descricao} · parcela ${parcela.number} · vencimento ${formatDate(parcela.due_date)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="baixa-form" icon="check" loading={saving}>
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <form id="baixa-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && (
          <Alert tone="risk" role="alert" title="Não foi possível registrar">
            {formError}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="baixa-valor" label="Valor pago" required hint={`saldo de ${formatBRL(saldo)}`}>
            <Input id="baixa-valor" icon="banknote" mono inputMode="numeric" value={valor} invalid={Boolean(erroValor)} error={erroValor} onChange={(e) => { setValor(maskMoney(e.target.value)); setErroValor(undefined); }} />
          </Field>
          <Field id="baixa-data" label="Data" required>
            <Input id="baixa-data" type="date" max={hojeEmBrasilia()} value={data} invalid={Boolean(erroData)} error={erroData} onChange={(e) => { setData(e.target.value); setErroData(undefined); }} />
          </Field>
        </div>
        {parcial && (
          <Alert tone="info" title="Pagamento parcial">
            Saldo de {formatBRL(saldo - centavos)} continua em aberto nesta parcela. O histórico guarda cada valor pago.
          </Alert>
        )}
        {!parcial && <Checkbox label="Nota fiscal já emitida" description="A data de emissão fica como hoje. Para outra data, registre depois de confirmar." checked={notaEmitida} onChange={(e) => setNotaEmitida(e.target.checked)} />}
        {notaEmitida && !parcial && (
          <Field id="baixa-nota" label="Número da nota fiscal" required hint={`até ${MAX_DIGITOS_DA_NOTA} dígitos`}>
            <Input id="baixa-nota" mono inputMode="numeric" maxLength={MAX_DIGITOS_DA_NOTA} value={numeroDaNota} invalid={Boolean(erroNota)} error={erroNota} onChange={(e) => { setNumeroDaNota(e.target.value.replace(/\D/g, "")); setErroNota(undefined); }} />
          </Field>
        )}
        <p className="text-sm">A comissão do responsável é atualizada automaticamente ao confirmar.</p>
      </form>
    </Dialog>
  );
}
