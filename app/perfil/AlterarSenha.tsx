"use client";

import { Alert, Button, Card, Input } from "edson-alexandre-design-system";
import { useState, type FormEvent } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { MAX_SENHA, MIN_SENHA } from "@/app/lib/senha";
import { atualizarPerfil } from "./api";

/** US05-CA02: separada dos dados, para salvar o nome não pedir a senha. */
export function AlterarSenha({ onSaved }: { onSaved: (aviso: string) => void }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erros, setErros] = useState<{ atual?: string; nova?: string; confirmacao?: string }>({});
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    const invalidos = {
      atual: atual ? undefined : "Informe a senha atual.",
      nova: nova.length < MIN_SENHA || nova.length > MAX_SENHA ? `A senha precisa ter entre ${MIN_SENHA} e ${MAX_SENHA} caracteres.` : undefined,
      confirmacao: nova === confirmacao ? undefined : "As senhas não são iguais.",
    };
    setErros(invalidos);
    if (Object.values(invalidos).some(Boolean)) return;

    setSaving(true);
    try {
      await atualizarPerfil({ new_password: nova, current_password: atual });
      setAtual("");
      setNova("");
      setConfirmacao("");
      onSaved("Senha alterada. As outras sessões foram encerradas.");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível alterar a senha. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Alterar senha">
      <form onSubmit={salvar} noValidate className="grid gap-4">
        {erro && (
          <Alert tone="risk" role="alert">
            {erro}
          </Alert>
        )}
        <Field id="senha-atual" label="Senha atual" required>
          <Input id="senha-atual" type="password" icon="lock" autoComplete="current-password" placeholder="Sua senha atual" value={atual} invalid={Boolean(erros.atual)} error={erros.atual} onChange={(e) => setAtual(e.target.value)} />
        </Field>
        <Field id="senha-nova" label="Nova senha" required hint={`mínimo de ${MIN_SENHA} caracteres`}>
          <Input id="senha-nova" type="password" icon="key-round" autoComplete="new-password" placeholder="Nova senha" value={nova} invalid={Boolean(erros.nova)} error={erros.nova} onChange={(e) => setNova(e.target.value)} />
        </Field>
        <Field id="senha-confirmacao" label="Confirmar nova senha" required>
          <Input id="senha-confirmacao" type="password" icon="key-round" autoComplete="new-password" placeholder="Repita a nova senha" value={confirmacao} invalid={Boolean(erros.confirmacao)} error={erros.confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </Field>
        <p className="text-sm">Ao trocar a senha, as outras sessões são encerradas.</p>
        <Button type="submit" block variant="secondary" loading={saving}>
          Alterar senha
        </Button>
      </form>
    </Card>
  );
}
