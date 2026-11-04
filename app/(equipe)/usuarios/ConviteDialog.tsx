"use client";

import { Alert, Button, Card, Dialog, Input, Select, Switch } from "edson-alexandre-design-system";
import { useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { convidarUsuario, ROTULO_DO_PERFIL, type NovoConvite, type ResultadoDoConvite } from "./api";

type Props = {
  onClose: () => void;
  onSaved: (convidado: ResultadoDoConvite) => void;
};

type Campo = "name" | "email" | "role" | "oab_number";
type FormErrors = Partial<Record<Campo, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_OAB = 8;
const MAX_OAB = 12;

export function ConviteDialog({ onClose, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("");
  const [advogado, setAdvogado] = useState(false);
  const [oab, setOab] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const limpar = (campo: Campo) => setErrors((atual) => ({ ...atual, [campo]: undefined }));

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const encontrados: FormErrors = {};
    if (!nome.trim()) encontrados.name = "Informe o nome.";
    if (!EMAIL.test(email.trim())) encontrados.email = "Informe um e-mail válido.";
    if (!perfil) encontrados.role = "Selecione o nível de acesso.";
    const oabLimpa = oab.trim();
    if (advogado && (oabLimpa.length < MIN_OAB || oabLimpa.length > MAX_OAB)) encontrados.oab_number = `A OAB tem de ${MIN_OAB} a ${MAX_OAB} caracteres, como DF123456.`;
    setErrors(encontrados);
    setFormError(null);
    if (Object.keys(encontrados).length > 0) return;

    setSaving(true);
    try {
      onSaved(
        await convidarUsuario({
          name: nome.trim(),
          email: email.trim(),
          role: perfil as NovoConvite["role"],
          is_lawyer: advogado,
          oab_number: advogado ? oabLimpa : null,
        }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setErrors({ email: error.message });
      else if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      else setFormError(error instanceof ApiError ? error.message : "Não foi possível enviar o convite. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={520}
      title="Convidar membro"
      description="Novo acesso ao sistema."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="convite-form" icon="send" loading={saving}>
            Enviar convite
          </Button>
        </>
      }
    >
      <form id="convite-form" onSubmit={submit} noValidate className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1 [&>*]:shrink-0">
        {formError && (
          <Alert tone="risk" role="alert" title="Não foi possível enviar">
            {formError}
          </Alert>
        )}
        <Field id="convite-nome" label="Nome completo" required>
          <Input id="convite-nome" icon="user" value={nome} invalid={Boolean(errors.name)} error={errors.name} autoFocus onChange={(e) => { setNome(e.target.value); limpar("name"); }} />
        </Field>
        <Field id="convite-email" label="E-mail" required hint="um acesso por e-mail">
          <Input id="convite-email" type="email" icon="mail" value={email} invalid={Boolean(errors.email)} error={errors.email} onChange={(e) => { setEmail(e.target.value); limpar("email"); }} />
        </Field>
        <Field id="convite-perfil" label="Nível de acesso" required>
          <Select
            id="convite-perfil"
            placeholder="Selecione"
            // O back não aceita convidar um Administrador: convida-se e depois muda o perfil.
            options={[
              { value: "operator", label: ROTULO_DO_PERFIL.operator },
              { value: "client", label: ROTULO_DO_PERFIL.client },
            ]}
            value={perfil}
            invalid={Boolean(errors.role)}
            onChange={(e) => { setPerfil(e.target.value); limpar("role"); }}
          />
          {errors.role && <span role="alert" className="text-sm text-red-700">{errors.role}</span>}
        </Field>
        <Card tone="sunken">
          <Switch label="É advogado(a) com OAB" checked={advogado} onChange={(e) => { setAdvogado(e.target.checked); limpar("oab_number"); }} />
          <p className="mt-2 text-sm">Independe do nível de acesso. Só quem tem OAB pode ser responsável por um acordo.</p>
          {advogado && (
            <div className="mt-3">
              <Field id="convite-oab" label="Número da OAB" required>
                <Input id="convite-oab" mono placeholder="DF123456" value={oab} invalid={Boolean(errors.oab_number)} error={errors.oab_number} onChange={(e) => { setOab(e.target.value); limpar("oab_number"); }} />
              </Field>
            </div>
          )}
        </Card>
        <Alert tone="info" title="O convite chega por e-mail">
          O usuário é criado como pendente até o primeiro acesso e definir a senha.
        </Alert>
      </form>
    </Dialog>
  );
}
