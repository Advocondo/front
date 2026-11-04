"use client";

import { Alert, Button, Icon, Input } from "edson-alexandre-design-system";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/app/components/AuthShell";
import { Field } from "@/app/components/FormField";
import { ApiError, apiFetch } from "@/app/lib/api";
import { clearSession } from "@/app/lib/session";
import styles from "@/app/login/login.module.css";

const MIN_SENHA = 8;
const MAX_SENHA = 128;

function Criterio({ atendido, children }: { atendido: boolean; children: string }) {
  return (
    <li className="flex items-center gap-2 text-sm" style={{ color: atendido ? "var(--green-600)" : "var(--text-muted)" }}>
      <Icon name={atendido ? "circle-check" : "circle"} size={16} />
      {children}
    </li>
  );
}

/** Onde o link do e-mail de redefinição leva (US03). */
export function RedefinirSenhaView({ token }: { token: string }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | undefined>();
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [expirado, setExpirado] = useState(!token);
  const [concluido, setConcluido] = useState(false);

  const tamanhoOk = senha.length >= MIN_SENHA && senha.length <= MAX_SENHA;
  const iguais = senha.length > 0 && senha === confirmacao;

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setTentou(true);
    setErro(null);
    setErroSenha(undefined);
    if (!tamanhoOk || !iguais) return;

    setEnviando(true);
    try {
      await apiFetch("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, new_password: senha }) });
      // As sessões antigas deixam de valer (US03-CA03), inclusive a guardada neste navegador.
      clearSession();
      setConcluido(true);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors.new_password) setErroSenha(e.fieldErrors.new_password);
      // Com a senha já validada aqui, a recusa do back é sempre sobre o link (US03-CA02).
      else if (e instanceof ApiError && e.status === 422) setExpirado(true);
      else setErro(e instanceof ApiError ? e.message : "Não foi possível salvar a senha. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (concluido) {
    return (
      <AuthShell>
        <div className={styles.formulario}>
          <div>
            <h2 className={styles.entrar}>Senha alterada</h2>
            <p className={styles.contexto}>Por segurança, as sessões abertas foram encerradas.</p>
          </div>
          <Alert tone="ok" role="status">
            Sua nova senha já está valendo.
          </Alert>
          <Link href="/login" className={styles.voltar}>
            Ir para o login
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (expirado) {
    return (
      <AuthShell>
        <div className={styles.formulario}>
          <div>
            <h2 className={styles.entrar}>Este link não vale mais</h2>
            <p className={styles.contexto}>Links de redefinição têm validade e só podem ser usados uma vez.</p>
          </div>
          <Alert tone="warn" title="Peça um novo link">
            A senha atual continua valendo até você concluir uma nova redefinição.
          </Alert>
          <Link href="/recuperar-senha" className="text-center font-medium">
            Pedir novo link
          </Link>
          <Link href="/login" className={styles.voltar}>
            Voltar ao login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={salvar} noValidate className={styles.formulario}>
        <div>
          <h2 className={styles.entrar}>Criar nova senha</h2>
          <p className={styles.contexto}>Depois de salvar, as sessões abertas serão encerradas.</p>
        </div>
        {erro && (
          <Alert tone="risk" role="alert">
            {erro}
          </Alert>
        )}
        <Field id="nova-senha" label="Nova senha" required hint={`mínimo de ${MIN_SENHA} caracteres`}>
          <Input id="nova-senha" type="password" icon="lock" autoComplete="new-password" placeholder="Nova senha" value={senha} invalid={tentou && !tamanhoOk} error={erroSenha} onChange={(e) => { setSenha(e.target.value); setErroSenha(undefined); }} />
        </Field>
        <Field id="confirmar-senha" label="Confirmar nova senha" required>
          <Input id="confirmar-senha" type="password" icon="lock" autoComplete="new-password" placeholder="Repita a nova senha" value={confirmacao} invalid={tentou && !iguais} onChange={(e) => setConfirmacao(e.target.value)} />
        </Field>
        <ul className="grid gap-1">
          <Criterio atendido={tamanhoOk}>{`Pelo menos ${MIN_SENHA} caracteres`}</Criterio>
          <Criterio atendido={iguais}>As duas senhas iguais</Criterio>
        </ul>
        <Button type="submit" block size="lg" loading={enviando}>
          Salvar nova senha
        </Button>
        <p className={styles.ajuda}>Dúvidas de acesso: (61) 3021-8539 · seg a sex, 09h às 17h</p>
      </form>
    </AuthShell>
  );
}
