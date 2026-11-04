"use client";

import { Alert, Button, Dialog } from "edson-alexandre-design-system";
import { useState } from "react";
import { ApiError } from "@/app/lib/api";
import { mudarStatus, type Usuario } from "./api";

type Props = {
  usuario: Usuario;
  onClose: () => void;
  onSaved: (atualizado: Usuario) => void;
};

export function InativarDialog({ usuario, onClose, onSaved }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirmar() {
    setSaving(true);
    setErro(null);
    try {
      onSaved(await mudarStatus(usuario.id, "inactive"));
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Não foi possível inativar o acesso. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={460}
      title="Inativar acesso"
      description={`${usuario.name} · ${usuario.email}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="danger" loading={saving} onClick={() => void confirmar()}>
            Inativar acesso
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível inativar">
            {erro}
          </Alert>
        )}
        <p className="text-sm">Essa pessoa perde o acesso na hora, inclusive nas sessões abertas. Os dados e o histórico continuam guardados, e você pode reativar o acesso depois.</p>
      </div>
    </Dialog>
  );
}
