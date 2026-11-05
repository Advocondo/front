"use client";

import { Alert, Button, Input } from "edson-alexandre-design-system";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/app/components/AuthShell";
import { Field } from "@/app/components/FormField";
import { ApiError, apiFetch } from "@/app/lib/api";
import { MAX_SENHA, MIN_SENHA } from "@/app/lib/senha";
import styles from "../login/login.module.css";


/** Onde o convidado define a senha. O link com o token vem no e-mail de convite (US07). */
export function ConviteView({ token }: { token: string }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erroSenha, setErroSenha] = useState<string | undefined>();
  const [erroConfirmacao, setErroConfirmacao] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aceito, setAceito] = useState(false);

  async function aceitar(event: FormEvent) {
    event.preventDefault();
    const senhaInvalida = senha.length < MIN_SENHA ? `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.` : senha.length > MAX_SENHA ? `A senha pode ter até ${MAX_SENHA} caracteres.` : undefined;
    const confirmacaoInvalida = senha !== confirmacao ? "As senhas não são iguais." : undefined;
    setErroSenha(senhaInvalida);
    setErroConfirmacao(confirmacaoInvalida);
    setErro(null);
    if (senhaInvalida || confirmacaoInvalida) return;

    setEnviando(true);
    try {
      await apiFetch("/users/invites/accept", { method: "POST", body: JSON.stringify({ token, password: senha }) });
      setAceito(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível aceitar o convite. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell>
        {aceito ? (
          <div className={styles.formulario}>
            <h2 className={styles.entrar}>Acesso criado</h2>
            <Alert tone="ok" role="status">
              Sua senha foi definida. Agora é só entrar com o seu e-mail.
            </Alert>
            <Link href="/login" className="text-center font-medium">
              Ir para o login
            </Link>
          </div>
        ) : !token ? (
          <div className={styles.formulario}>
            <h2 className={styles.entrar}>Convite inválido</h2>
            <Alert tone="risk" role="alert">
              Este link está incompleto. Abra de novo o link do e-mail de convite ou peça um novo convite ao Administrador.
            </Alert>
          </div>
        ) : (
          <form onSubmit={aceitar} noValidate className={styles.formulario}>
            <div>
              <h2 className={styles.entrar}>Definir senha</h2>
              <p className={styles.contexto}>Crie a senha do seu primeiro acesso à plataforma.</p>
            </div>
            {erro && (
              <Alert tone="risk" role="alert">
                {erro}
              </Alert>
            )}
            <Field id="convite-senha" label="Nova senha" required hint={`mínimo de ${MIN_SENHA} caracteres`}>
              <Input id="convite-senha" type="password" icon="lock" autoComplete="new-password" value={senha} invalid={Boolean(erroSenha)} error={erroSenha} onChange={(e) => { setSenha(e.target.value); setErroSenha(undefined); }} />
            </Field>
            <Field id="convite-confirmacao" label="Confirme a senha" required>
              <Input id="convite-confirmacao" type="password" icon="lock" autoComplete="new-password" value={confirmacao} invalid={Boolean(erroConfirmacao)} error={erroConfirmacao} onChange={(e) => { setConfirmacao(e.target.value); setErroConfirmacao(undefined); }} />
            </Field>
            <Button type="submit" block size="lg" loading={enviando}>
              Criar acesso
            </Button>
            <p className={styles.ajuda}>Dúvidas de acesso: (61) 3021-8539 · seg a sex, 09h às 17h</p>
          </form>
        )}
    </AuthShell>
  );
}
