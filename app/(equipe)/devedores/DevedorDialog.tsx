"use client";

import { Alert, Button, Dialog, Input, Select } from "edson-alexandre-design-system";
import { useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { maskTelefone } from "@/app/lib/masks";
import type { Condominio } from "@/app/(equipe)/condominios/types";
import { createDevedor, updateDevedor } from "./api";
import type { Devedor, DevedorForm } from "./types";
import { validate, type FormErrors } from "./validation";

type Props = {
  /** Devedor em edição; ausente = cadastro de um novo. */
  devedor?: Devedor;
  condominios: Condominio[];
  /** Condomínio já escolhido, quando a lista está filtrada por um. */
  condominioInicial?: string;
  onClose: () => void;
  onSaved: (salvo: Devedor, modo: "cadastrado" | "atualizado") => void;
  onUseExisting: (existente: Devedor) => void;
};

// Mudar um destes muda o que é "parecido", então a confirmação anterior deixa de valer.
const CAMPOS_DA_DUPLICIDADE: (keyof DevedorForm)[] = ["condominium_id", "name", "unit"];

export function DevedorDialog({ devedor, condominios, condominioInicial = "", onClose, onSaved, onUseExisting }: Props) {
  const editando = devedor !== undefined;
  const [form, setForm] = useState<DevedorForm>({
    condominium_id: devedor?.condominium_id ?? condominioInicial,
    name: devedor?.name ?? "",
    unit: devedor?.unit ?? "",
    phone: maskTelefone(devedor?.phone ?? ""),
    email: devedor?.email ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [parecidos, setParecidos] = useState<Devedor[] | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof DevedorForm, mask?: (v: string) => string) => (event: { target: { value: string } }) => {
    const value = mask ? mask(event.target.value) : event.target.value;
    setForm((atual) => ({ ...atual, [key]: value }));
    setErrors((atual) => ({ ...atual, [key]: undefined }));
    if (CAMPOS_DA_DUPLICIDADE.includes(key)) setParecidos(null);
  };

  const nomeDoCondominio = (id: string) => condominios.find((c) => c.id === id)?.nome ?? "Condomínio";

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const encontrados = validate(form);
    setErrors(encontrados);
    setFormError(null);
    if (Object.keys(encontrados).length > 0) return;

    setSaving(true);
    try {
      if (editando) {
        onSaved(await updateDevedor(devedor.id, form), "atualizado");
        return;
      }
      const resultado = await createDevedor(form, parecidos !== null);
      if (resultado.tipo === "parecidos") setParecidos(resultado.parecidos);
      else onSaved(resultado.devedor, "cadastrado");
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors as FormErrors);
      else setFormError(error instanceof ApiError ? error.message : "Não foi possível salvar o devedor. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={560}
      title={editando ? "Editar devedor" : "Novo devedor"}
      description="Dados do morador inadimplente, reaproveitados em todos os acordos com ele."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="devedor-form" loading={saving}>
            {parecidos ? "Salvar mesmo assim" : "Salvar devedor"}
          </Button>
        </>
      }
    >
      <form id="devedor-form" onSubmit={submit} noValidate className="flex max-h-[60vh] flex-col [&>*]:shrink-0 gap-4 overflow-y-auto pr-1">
        {formError && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {formError}
          </Alert>
        )}

        <Field id="devedor-nome" label="Nome completo" required>
          <Input id="devedor-nome" icon="user" value={form.name} onChange={set("name")} invalid={Boolean(errors.name)} error={errors.name} autoFocus />
        </Field>

        {parecidos && (
          <Alert tone="warn" role="alert" title="Já existe um devedor parecido">
            <p>Confirme que se trata de outra pessoa antes de salvar.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {parecidos.map((parecido) => (
                <li key={parecido.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{[parecido.name, nomeDoCondominio(parecido.condominium_id), parecido.unit].join(" · ")}</span>
                  <Button size="sm" variant="ghost" onClick={() => onUseExisting(parecido)} aria-label={`Usar o cadastro de ${parecido.name}`}>
                    Usar o cadastro existente
                  </Button>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <Field id="devedor-condominio" label="Condomínio" required>
          <Select
            id="devedor-condominio"
            placeholder="Selecione"
            options={condominios.map((c) => ({ value: c.id, label: c.nome }))}
            value={form.condominium_id}
            onChange={set("condominium_id")}
            invalid={Boolean(errors.condominium_id)}
            disabled={editando}
          />
          {errors.condominium_id && <span role="alert" className="text-sm text-red-700">{errors.condominium_id}</span>}
        </Field>
        <Field id="devedor-unidade" label="Unidade" required>
          <Input id="devedor-unidade" placeholder="Bloco B 304" value={form.unit} onChange={set("unit")} invalid={Boolean(errors.unit)} error={errors.unit} />
        </Field>
        <Field id="devedor-telefone" label="Telefone / WhatsApp" hint="telefone ou e-mail">
          <Input id="devedor-telefone" type="tel" icon="phone" mono placeholder="(61) 00000-0000" value={form.phone} onChange={set("phone", maskTelefone)} invalid={Boolean(errors.phone)} error={errors.phone} />
        </Field>
        <Field id="devedor-email" label="E-mail" hint="telefone ou e-mail">
          <Input id="devedor-email" type="email" icon="mail" placeholder="nome@exemplo.com" value={form.email} onChange={set("email")} invalid={Boolean(errors.email)} error={errors.email} />
        </Field>
      </form>
    </Dialog>
  );
}
