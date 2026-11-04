"use client";

import { Alert, Button, Dialog, Input, Select } from "edson-alexandre-design-system";
import { useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { centsFromApi, centsFromMasked, centsToApi, maskMoney } from "@/app/lib/money";
import { definirMeta, type MetaDoColaborador } from "./api";

type Props = {
  colaboradores: MetaDoColaborador[];
  /** Colaborador já escolhido, quando a edição parte da linha dele. */
  colaboradorInicial?: MetaDoColaborador;
  ano: number;
  mes: number;
  nomeDoMes: string;
  onClose: () => void;
  onSaved: (nome: string) => void;
};

export function MetaDialog({ colaboradores, colaboradorInicial, ano, mes, nomeDoMes, onClose, onSaved }: Props) {
  const [usuarioId, setUsuarioId] = useState(colaboradorInicial?.user_id ?? "");
  const [valor, setValor] = useState(colaboradorInicial?.target_amount ? maskMoney(centsToApi(centsFromApi(colaboradorInicial.target_amount))) : "");
  const [erroUsuario, setErroUsuario] = useState<string | undefined>();
  const [erroValor, setErroValor] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const centavos = centsFromMasked(valor);
    const usuarioInvalido = usuarioId ? undefined : "Selecione o colaborador.";
    const valorInvalido = centavos > 0n ? undefined : "Informe o valor da meta.";
    setErroUsuario(usuarioInvalido);
    setErroValor(valorInvalido);
    setFormError(null);
    if (usuarioInvalido || valorInvalido) return;

    setSaving(true);
    try {
      await definirMeta(usuarioId, ano, mes, centsToApi(centavos));
      onSaved(colaboradores.find((c) => c.user_id === usuarioId)?.user_name ?? "Colaborador");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.target_amount) setErroValor(error.fieldErrors.target_amount);
      else setFormError(error instanceof ApiError ? error.message : "Não foi possível salvar a meta. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={480}
      title="Definir meta mensal"
      description={`${nomeDoMes}. O sistema calcula o percentual de atingimento a cada baixa registrada.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="meta-form" icon="check" loading={saving}>
            Salvar meta
          </Button>
        </>
      }
    >
      <form id="meta-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {formError}
          </Alert>
        )}
        <Field id="meta-colaborador" label="Colaborador" required>
          <Select id="meta-colaborador" placeholder="Selecione" options={colaboradores.map((c) => ({ value: c.user_id, label: c.user_name }))} value={usuarioId} invalid={Boolean(erroUsuario)} disabled={Boolean(colaboradorInicial)} onChange={(e) => { setUsuarioId(e.target.value); setErroUsuario(undefined); }} />
          {erroUsuario && <span role="alert" className="text-sm text-red-700">{erroUsuario}</span>}
        </Field>
        <Field id="meta-valor" label="Meta (R$)" required>
          <Input id="meta-valor" mono inputMode="numeric" placeholder="0,00" value={valor} invalid={Boolean(erroValor)} error={erroValor} onChange={(e) => { setValor(maskMoney(e.target.value)); setErroValor(undefined); }} />
        </Field>
        <p className="text-sm">Cada colaborador vê só a própria meta e o próprio atingimento.</p>
      </form>
    </Dialog>
  );
}
