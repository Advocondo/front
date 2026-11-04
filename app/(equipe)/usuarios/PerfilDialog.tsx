"use client";

import { Alert, Button, Dialog, Select } from "edson-alexandre-design-system";
import { useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import type { Role } from "@/app/lib/session";
import { mudarPerfil, ROTULO_DO_PERFIL, type Usuario } from "./api";

type Props = {
  usuario: Usuario;
  onClose: () => void;
  onSaved: (atualizado: Usuario) => void;
};

const PERFIS: Role[] = ["admin", "operator", "client"];

export function PerfilDialog({ usuario, onClose, onSaved }: Props) {
  const [perfil, setPerfil] = useState<Role>(usuario.role);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      onSaved(await mudarPerfil(usuario.id, perfil));
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : "Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={460}
      title="Definir nível de acesso"
      description={`${usuario.name} · ${usuario.email}. As permissões mudam já na próxima ação dessa pessoa.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="perfil-form" loading={saving} disabled={perfil === usuario.role}>
            Salvar perfil
          </Button>
        </>
      }
    >
      <form id="perfil-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {erro}
          </Alert>
        )}
        <Field id="perfil-usuario" label="Nível de acesso" required>
          <Select id="perfil-usuario" options={PERFIS.map((p) => ({ value: p, label: ROTULO_DO_PERFIL[p] }))} value={perfil} onChange={(e) => setPerfil(e.target.value as Role)} />
        </Field>
      </form>
    </Dialog>
  );
}
