"use client";

import { Alert, Button, Input } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@/app/components/AuthShell";
import { Field } from "@/app/components/FormField";
import { ApiError, apiFetch } from "@/app/lib/api";
import styles from "@/app/login/login.module.css";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ESPERA_PARA_REENVIAR_S = 120;

const relogio = (segundos: number): string => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;

export function RecuperarSenhaView() {
  const [email, setEmail] = useState("");
  const [erroEmail, setErroEmail] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const timer = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [espera]);

  async function pedirLink() {
    setErro(null);
    setEnviando(true);
    try {
      await apiFetch("/auth/password-reset", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setEnviado(true);
      setEspera(ESPERA_PARA_REENVIAR_S);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  function enviar(event: FormEvent) {
    event.preventDefault();
    const invalido = EMAIL.test(email.trim()) ? undefined : "Informe um e-mail válido.";
    setErroEmail(invalido);
    if (!invalido) void pedirLink();
  }

  const mensagemDeErro = erro && (
    <Alert tone="risk" role="alert">
      {erro}
    </Alert>
  );

  return (
    <AuthShell>
      {enviado ? (
        <div className={styles.formulario}>
          <div>
            <h2 className={styles.entrar}>Verifique o seu e-mail</h2>
            {/* A resposta é a mesma com ou sem cadastro: a tela não revela quem tem conta. */}
            <p className={styles.contexto}>Se {email.trim()} estiver cadastrado, enviamos um link para redefinir a senha. O link vale por tempo limitado.</p>
          </div>
          {mensagemDeErro}
          <Alert tone="info" title="Não chegou?">
            Confira a caixa de spam. Você pode pedir um novo link depois de 2 minutos.
          </Alert>
          <Button variant="secondary" block disabled={espera > 0} loading={enviando} onClick={() => void pedirLink()}>
            {espera > 0 ? `Reenviar link (${relogio(espera)})` : "Reenviar link"}
          </Button>
          <Link href="/login" className={styles.voltar}>
            Voltar ao login
          </Link>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className={styles.formulario}>
          <div>
            <h2 className={styles.entrar}>Recuperar senha</h2>
            <p className={styles.contexto}>Informe o e-mail do seu acesso para receber o link de redefinição.</p>
          </div>
          {mensagemDeErro}
          <Field id="recuperar-email" label="E-mail" required>
            <Input id="recuperar-email" type="email" icon="mail" autoComplete="username" placeholder="nome@escritorio.com.br" value={email} invalid={Boolean(erroEmail)} error={erroEmail} onChange={(e) => { setEmail(e.target.value); setErroEmail(undefined); }} />
          </Field>
          <Button type="submit" block size="lg" loading={enviando}>
            Enviar link
          </Button>
          <Link href="/login" className={styles.voltar}>
            Voltar ao login
          </Link>
          <p className={styles.ajuda}>Dúvidas de acesso: (61) 3021-8539 · seg a sex, 09h às 17h</p>
        </form>
      )}
    </AuthShell>
  );
}
