"use client";

import { Alert, Button, Card, Input } from "edson-alexandre-design-system";
import { useState, type FormEvent } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { atualizarUsuarioDaSessao, type Session } from "@/app/lib/session";
import { atualizarPerfil } from "./api";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** US05: o nome muda direto; o e-mail pede a senha atual (CA02). */
export function DadosDeAcesso({ usuario, onSaved }: { usuario: Session["user"]; onSaved: (aviso: string) => void }) {
  const [nome, setNome] = useState(usuario.name);
  const [email, setEmail] = useState(usuario.email);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [erros, setErros] = useState<{ name?: string; email?: string; current_password?: string }>({});
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const novoNome = nome.trim();
  const novoEmail = email.trim().toLowerCase();
  const mudouNome = novoNome !== usuario.name;
  const mudouEmail = novoEmail !== usuario.email.toLowerCase();

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    const invalidos = {
      name: novoNome ? undefined : "Informe o nome.",
      email: EMAIL.test(novoEmail) ? undefined : "Informe um e-mail válido.",
      current_password: mudouEmail && !senhaAtual ? "Informe a senha atual para alterar o e-mail." : undefined,
    };
    setErros(invalidos);
    if (Object.values(invalidos).some(Boolean)) return;

    setSaving(true);
    try {
      const atualizado = await atualizarPerfil({
        ...(mudouNome && { name: novoNome }),
        ...(mudouEmail && { email: novoEmail, current_password: senhaAtual }),
      });
      atualizarUsuarioDaSessao({ name: atualizado.name, email: atualizado.email });
      setSenhaAtual("");
      onSaved("Dados salvos com sucesso.");
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) setErros(e.fieldErrors);
      else setErro(e instanceof ApiError ? e.message : "Não foi possível salvar os dados. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Dados de acesso">
      <form onSubmit={salvar} noValidate className="grid gap-4">
        {erro && (
          <Alert tone="risk" role="alert">
            {erro}
          </Alert>
        )}
        <Field id="perfil-nome" label="Nome" required>
          <Input id="perfil-nome" icon="user" autoComplete="name" value={nome} invalid={Boolean(erros.name)} error={erros.name} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field id="perfil-email" label="E-mail" required hint="pede a senha atual">
          <Input id="perfil-email" type="email" icon="mail" autoComplete="email" value={email} invalid={Boolean(erros.email)} error={erros.email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {mudouEmail && (
          <Field id="perfil-email-senha" label="Senha atual" required>
            <Input id="perfil-email-senha" type="password" icon="lock" autoComplete="current-password" value={senhaAtual} invalid={Boolean(erros.current_password)} error={erros.current_password} onChange={(e) => setSenhaAtual(e.target.value)} />
          </Field>
        )}
        <Button type="submit" block loading={saving} disabled={!mudouNome && !mudouEmail}>
          Salvar dados
        </Button>
      </form>
    </Card>
  );
}
