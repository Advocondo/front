"use client";

import { Alert, Button, Input, Textarea } from "edson-alexandre-design-system";
import { useState, type FormEvent } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError, apiFetch } from "@/app/lib/api";
import { maskTelefone, onlyDigits } from "@/app/lib/masks";
import styles from "./landing.module.css";
import { Turnstile } from "./Turnstile";
import type { ContactMessage } from "./types";

const VAZIO = { name: "", phone: "", email: "", message: "" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Campos = typeof VAZIO;
type Erros = Partial<Record<keyof Campos, string>>;

function validar(campos: Campos): Erros {
  const erros: Erros = {};
  if (!campos.name.trim()) erros.name = "Informe o seu nome.";
  if (![10, 11].includes(onlyDigits(campos.phone).length)) erros.phone = "Telefone com DDD, 10 ou 11 dígitos.";
  if (!EMAIL.test(campos.email.trim())) erros.email = "Informe um e-mail válido.";
  return erros;
}

export function ContactForm() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [campos, setCampos] = useState(VAZIO);
  const [armadilha, setArmadilha] = useState("");
  const [token, setToken] = useState("");
  const [resetCaptcha, setResetCaptcha] = useState(0);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const alterar = (campo: keyof Campos, mascara?: (v: string) => string) => (event: { target: { value: string } }) => {
    const valor = mascara ? mascara(event.target.value) : event.target.value;
    setCampos((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => ({ ...atual, [campo]: undefined }));
    setEnviado(false);
  };

  async function enviar(event: FormEvent) {
    event.preventDefault();
    const encontrados = validar(campos);
    setErros(encontrados);
    setErroGeral(null);
    setEnviado(false);
    if (Object.keys(encontrados).length > 0) return;
    if (siteKey && !token) {
      setErroGeral("Aguarde a verificação de segurança terminar e tente de novo.");
      return;
    }

    const mensagem: ContactMessage = {
      name: campos.name.trim(),
      phone: onlyDigits(campos.phone),
      email: campos.email.trim(),
      message: campos.message.trim() || null,
      website: armadilha,
      captcha_token: token,
    };
    setEnviando(true);
    try {
      await apiFetch("/landing/contact", { method: "POST", body: JSON.stringify(mensagem) });
      setCampos(VAZIO);
      setEnviado(true);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setErros(error.fieldErrors);
      else setErroGeral(error instanceof ApiError ? error.message : "Não foi possível enviar sua mensagem. Tente novamente.");
    } finally {
      // Cada token só vale para um envio, mesmo quando o envio falha.
      setToken("");
      setResetCaptcha((n) => n + 1);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className={styles.formulario}>
      <Field id="contato-nome" label="Nome e Sobrenome" required>
        <Input id="contato-nome" autoComplete="name" value={campos.name} onChange={alterar("name")} invalid={Boolean(erros.name)} error={erros.name} />
      </Field>
      <Field id="contato-telefone" label="Telefone" required>
        <Input id="contato-telefone" type="tel" autoComplete="tel" placeholder="(61) 00000-0000" value={campos.phone} onChange={alterar("phone", maskTelefone)} invalid={Boolean(erros.phone)} error={erros.phone} />
      </Field>
      <div className={styles.inteira}>
        <Field id="contato-email" label="E-mail" required>
          <Input id="contato-email" type="email" autoComplete="email" value={campos.email} onChange={alterar("email")} invalid={Boolean(erros.email)} error={erros.email} />
        </Field>
      </div>
      <div className={styles.inteira}>
        <Field id="contato-mensagem" label="Mensagem">
          <Textarea id="contato-mensagem" rows={4} value={campos.message} onChange={alterar("message")} invalid={Boolean(erros.message)} />
        </Field>
        {erros.message && <span role="alert" className={styles.erroCampo}>{erros.message}</span>}
      </div>

      {/* Armadilha para robôs: fica fora da tela, e só quem não vê a página a preenche. */}
      <div className={styles.armadilha} aria-hidden="true">
        <label htmlFor="contato-website">Não preencha este campo</label>
        <input id="contato-website" name="website" tabIndex={-1} autoComplete="off" value={armadilha} onChange={(e) => setArmadilha(e.target.value)} />
      </div>

      <div className={styles.envio}>
        {siteKey && <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetCaptcha} />}
        {erroGeral && (
          <Alert tone="risk" role="alert">
            {erroGeral}
          </Alert>
        )}
        {enviado && (
          <Alert tone="ok" role="status">
            Recebemos a sua mensagem. Entraremos em contato em breve.
          </Alert>
        )}
        <div className={styles.botaoEnviar}>
          <Button type="submit" block loading={enviando}>
            Enviar
          </Button>
        </div>
        <p className={styles.aviso}>Seus dados serão usados exclusivamente para que nossa equipe possa responder a esta solicitação.</p>
      </div>
    </form>
  );
}
