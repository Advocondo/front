"use client";

import { Alert, Button, Dialog, FieldLabel, Input, Select } from "edson-alexandre-design-system";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/app/lib/api";
import { createCondominio, updateCondominio } from "./api";
import { emptyForm, maskCep, maskCnpj, maskTelefone, toForm, toPayload } from "./format";
import type { Condominio, CondominioForm } from "./types";
import { UFS } from "./UFS";
import { validate, type FormErrors } from "./validation";

type Props = {
  /** Condomínio em edição; ausente = cadastro de um novo. */
  condominio?: Condominio;
  onClose: () => void;
  onSaved: (saved: Condominio, mode: "criado" | "atualizado") => void;
};

function Field({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor={id} required={required} hint={hint}>
        {label}
      </FieldLabel>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-2">
      <legend className="mb-2 text-sm font-semibold uppercase tracking-wide">{title}</legend>
      {children}
    </fieldset>
  );
}

export function CondominioDialog({ condominio, onClose, onSaved }: Props) {
  const editing = condominio !== undefined;
  const [form, setForm] = useState<CondominioForm>(condominio ? toForm(condominio) : emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof CondominioForm, mask?: (v: string) => string) => (event: { target: { value: string } }) => {
    const value = mask ? mask(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const payload = toPayload(form);
      const saved = editing ? await updateCondominio(condominio.id, payload) : await createCondominio(payload);
      onSaved(saved, editing ? "atualizado" : "criado");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.status === 409 ? { cnpj: error.message } : (error.fieldErrors as FormErrors));
        if (error.status !== 409 && Object.keys(error.fieldErrors).length === 0) setFormError(error.message);
      } else {
        setFormError("Não foi possível salvar o condomínio. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={680}
      title={editing ? "Editar condomínio" : "Novo condomínio"}
      description="Os dados ficam disponíveis para vincular acordos e usuários Cliente."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="condominio-form" loading={saving}>
            Salvar condomínio
          </Button>
        </>
      }
    >
      <form id="condominio-form" onSubmit={submit} noValidate className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto pr-1">
        {formError && (
          <Alert tone="risk" title="Não foi possível salvar">
            {formError}
          </Alert>
        )}

        <Section title="Identificação">
          <Field id="nome" label="Nome do condomínio" required>
            <Input id="nome" value={form.nome} onChange={set("nome")} error={errors.nome} autoFocus />
          </Field>
          <Field id="cnpj" label="CNPJ">
            <Input id="cnpj" mono inputMode="numeric" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={set("cnpj", maskCnpj)} error={errors.cnpj} />
          </Field>
        </Section>

        <Section title="Endereço">
          <Field id="cep" label="CEP">
            <Input id="cep" mono inputMode="numeric" placeholder="00000-000" value={form.cep} onChange={set("cep", maskCep)} error={errors.cep} />
          </Field>
          <Field id="logradouro" label="Logradouro">
            <Input id="logradouro" value={form.logradouro} onChange={set("logradouro")} error={errors.logradouro} />
          </Field>
          <Field id="bairro" label="Bairro">
            <Input id="bairro" value={form.bairro} onChange={set("bairro")} error={errors.bairro} />
          </Field>
          <Field id="cidade" label="Cidade">
            <Input id="cidade" value={form.cidade} onChange={set("cidade")} error={errors.cidade} />
          </Field>
          <Field id="uf" label="Estado">
            <Select id="uf" placeholder="Selecione" options={UFS} value={form.uf} onChange={set("uf")} invalid={Boolean(errors.uf)} />
            {errors.uf && <span role="alert" className="text-sm text-red-700">{errors.uf}</span>}
          </Field>
        </Section>

        <Section title="Síndico ou administradora">
          <Field id="sindico_nome" label="Nome">
            <Input id="sindico_nome" value={form.sindico_nome} onChange={set("sindico_nome")} error={errors.sindico_nome} />
          </Field>
          <Field id="sindico_email" label="E-mail">
            <Input id="sindico_email" type="email" value={form.sindico_email} onChange={set("sindico_email")} error={errors.sindico_email} />
          </Field>
          <Field id="sindico_telefone" label="Telefone ou WhatsApp">
            <Input id="sindico_telefone" type="tel" mono placeholder="(00) 00000-0000" value={form.sindico_telefone} onChange={set("sindico_telefone", maskTelefone)} error={errors.sindico_telefone} />
          </Field>
        </Section>

        <Section title="Contrato">
          <Field id="contrato_inicio" label="Início do contrato">
            <Input id="contrato_inicio" type="date" value={form.contrato_inicio} onChange={set("contrato_inicio")} error={errors.contrato_inicio} />
          </Field>
          <Field id="contrato_renovacao" label="Data de renovação">
            <Input id="contrato_renovacao" type="date" value={form.contrato_renovacao} onChange={set("contrato_renovacao")} error={errors.contrato_renovacao} />
          </Field>
        </Section>
      </form>
    </Dialog>
  );
}
