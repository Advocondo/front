"use client";

import { Alert, Button, Dialog, Select } from "edson-alexandre-design-system";
import { useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { assignLawyer } from "../api";
import type { Acordo, Advogado } from "../types";

type Props = {
  acordo: Acordo;
  /** Só usuários ativos, marcados como advogado e com OAB (US18-CA01). */
  advogados: Advogado[];
  onClose: () => void;
  onSaved: (acordo: Acordo) => void;
};

const rotulo = (advogado: Advogado): string => (advogado.oab_number ? `${advogado.name} · OAB ${advogado.oab_number}` : advogado.name);

export function ResponsavelDialog({ acordo, advogados, onClose, onSaved }: Props) {
  const atual = acordo.responsible_lawyer?.id ?? "";
  const [advogadoId, setAdvogadoId] = useState(atual);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const semAdvogado = advogados.length === 0;

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      onSaved(await assignLawyer(acordo.id, advogadoId));
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Não foi possível salvar o responsável. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={480}
      title={atual ? "Trocar responsável" : "Atribuir responsável"}
      description="A troca fica registrada no histórico do acordo."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="responsavel-form" loading={saving} disabled={!advogadoId || advogadoId === atual}>
            Salvar responsável
          </Button>
        </>
      }
    >
      <form id="responsavel-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {erro}
          </Alert>
        )}
        {semAdvogado ? (
          <Alert tone="info" title="Nenhum advogado disponível">
            Convide um usuário marcado como advogado, com número da OAB, para atribuí-lo aos acordos.
          </Alert>
        ) : (
          <Field id="responsavel-advogado" label="Advogado responsável" required hint="só usuários com OAB">
            <Select id="responsavel-advogado" placeholder="Selecione" options={advogados.map((a) => ({ value: a.id, label: rotulo(a) }))} value={advogadoId} onChange={(e) => setAdvogadoId(e.target.value)} />
          </Field>
        )}
      </form>
    </Dialog>
  );
}
