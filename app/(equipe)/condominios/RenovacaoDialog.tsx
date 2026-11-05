"use client";

import { Alert, Button, Dialog, Input } from "edson-alexandre-design-system";
import { useState, type FormEvent } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { hojeEmBrasilia } from "@/app/lib/dates";
import { registrarRenovacao } from "./api";
import { formatDate } from "./format";
import type { Condominio } from "./types";

type Props = {
  condominio: Condominio;
  onClose: () => void;
  onSaved: () => void;
};

/** US23-CA02: a nova data passa a ser a referência do próximo aviso. */
export function RenovacaoDialog({ condominio, onClose, onSaved }: Props) {
  const [renovadoEm, setRenovadoEm] = useState(hojeEmBrasilia);
  const [proxima, setProxima] = useState("");
  const [erros, setErros] = useState<{ renovadoEm?: string; proxima?: string }>({});
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    const invalidos = {
      renovadoEm: renovadoEm ? undefined : "Informe quando o contrato foi renovado.",
      // Datas ISO comparam certo como texto.
      proxima: !proxima ? "Informe a próxima renovação." : renovadoEm && proxima <= renovadoEm ? "A próxima renovação precisa ser depois da data da renovação." : undefined,
    };
    setErros(invalidos);
    if (invalidos.renovadoEm || invalidos.proxima) return;

    setSaving(true);
    try {
      await registrarRenovacao(condominio.id, renovadoEm, proxima);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && (e.fieldErrors.contrato_inicio || e.fieldErrors.contrato_renovacao)) setErros({ renovadoEm: e.fieldErrors.contrato_inicio, proxima: e.fieldErrors.contrato_renovacao });
      else setErro(e instanceof ApiError ? e.message : "Não foi possível registrar a renovação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={480}
      title="Registrar renovação"
      description={`${condominio.nome}. A renovação estava prevista para ${formatDate(condominio.contrato_renovacao)}. A nova data passa a ser a referência para o próximo aviso.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="renovacao-form" loading={saving}>
            Salvar renovação
          </Button>
        </>
      }
    >
      <form id="renovacao-form" onSubmit={salvar} noValidate className="flex flex-col gap-4">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {erro}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="renovado-em" label="Renovado em" required>
            <Input id="renovado-em" type="date" value={renovadoEm} invalid={Boolean(erros.renovadoEm)} error={erros.renovadoEm} onChange={(e) => setRenovadoEm(e.target.value)} />
          </Field>
          <Field id="proxima-renovacao" label="Próxima renovação" required>
            <Input id="proxima-renovacao" type="date" value={proxima} invalid={Boolean(erros.proxima)} error={erros.proxima} onChange={(e) => setProxima(e.target.value)} />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
