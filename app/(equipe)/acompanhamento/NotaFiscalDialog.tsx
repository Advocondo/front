"use client";

import { Alert, Button, Dialog, Input } from "edson-alexandre-design-system";
import { useState, type FormEvent } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { hojeEmBrasilia } from "@/app/lib/dates";
import type { Parcela } from "@/app/(equipe)/acordos/types";
import { MAX_DIGITOS_DA_NOTA, registrarNotaFiscal } from "./api";

type Props = {
  parcela: Parcela;
  descricao: string;
  onClose: () => void;
  onSaved: () => void;
};

/** US29-CA01. Registrar de novo troca a nota, para corrigir um número ou uma data digitados errado. */
export function NotaFiscalDialog({ parcela, descricao, onClose, onSaved }: Props) {
  const [numero, setNumero] = useState(parcela.invoice_number ?? "");
  const [data, setData] = useState(parcela.invoice_date ?? hojeEmBrasilia());
  const [erroNumero, setErroNumero] = useState<string | undefined>();
  const [erroData, setErroData] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    const numeroInvalido = numero ? undefined : "Informe o número da nota fiscal.";
    const dataInvalida = !data ? "Informe a data de emissão." : data > hojeEmBrasilia() ? "A data de emissão não pode ser futura." : undefined;
    setErroNumero(numeroInvalido);
    setErroData(dataInvalida);
    if (numeroInvalido || dataInvalida) return;

    setSaving(true);
    try {
      await registrarNotaFiscal(parcela.id, numero, data);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setErroNumero(e.fieldErrors.number);
        setErroData(e.fieldErrors.issue_date);
      } else {
        setErro(e instanceof ApiError ? e.message : "Não foi possível salvar a nota fiscal. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={460}
      title={parcela.invoice_number ? "Alterar nota fiscal" : "Registrar nota fiscal"}
      description={`${descricao} · parcela ${parcela.number}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="nota-fiscal-form" loading={saving}>
            Salvar nota fiscal
          </Button>
        </>
      }
    >
      <form id="nota-fiscal-form" onSubmit={salvar} noValidate className="flex flex-col gap-4">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {erro}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="nota-numero" label="Número" required hint={`até ${MAX_DIGITOS_DA_NOTA} dígitos`}>
            {/* Texto, e não número: os zeros à esquerda fazem parte da nota. */}
            <Input id="nota-numero" mono inputMode="numeric" maxLength={MAX_DIGITOS_DA_NOTA} value={numero} invalid={Boolean(erroNumero)} error={erroNumero} onChange={(e) => { setNumero(e.target.value.replace(/\D/g, "")); setErroNumero(undefined); }} />
          </Field>
          <Field id="nota-data" label="Data de emissão" required>
            <Input id="nota-data" type="date" max={hojeEmBrasilia()} value={data} invalid={Boolean(erroData)} error={erroData} onChange={(e) => { setData(e.target.value); setErroData(undefined); }} />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
