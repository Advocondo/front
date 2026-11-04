"use client";

import { Alert, Button, Checkbox, IconButton, Input, Logo } from "edson-alexandre-design-system";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { homeForRole, logIn } from "@/app/lib/auth";
import { useSession } from "@/app/lib/session";
import styles from "./login.module.css";

const ERRO_INESPERADO = "Não foi possível entrar. Tente novamente.";

export function LoginView() {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [manterConectado, setManterConectado] = useState(true);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<ApiError | null>(null);

  // Vale para o login recém-feito e para quem abre /login já com sessão.
  const destino = session ? homeForRole(session.user.role) : null;
  useEffect(() => {
    if (destino) router.replace(destino);
  }, [destino, router]);

  async function entrar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await logIn(email, senha, manterConectado);
    } catch (e) {
      setErro(e instanceof ApiError ? e : new ApiError(0, ERRO_INESPERADO));
    } finally {
      setEnviando(false);
    }
  }

  if (destino) return null;

  // US02-CA02: credenciais recusadas marcam os dois campos, sem indicar qual está errado.
  const recusado = erro?.status === 401;

  return (
    <div className={styles.pagina}>
      <div className={styles.marca}>
        <Logo variant="lockup" height={150} base="/brand/" />
        <div className="grid justify-items-center gap-4">
          <h1 className={styles.titulo}>Plataforma de acompanhamento</h1>
          <p className={styles.descricao}>Administração e acompanhamento dos acordos extrajudiciais das carteiras de condomínios.</p>
        </div>
      </div>
      <main className={styles.conteudo}>
        <form onSubmit={entrar} className={styles.formulario}>
          <div>
            <h2 className={styles.entrar}>Entrar</h2>
            <p className={styles.contexto}>Acesso restrito à equipe do escritório e aos síndicos autorizados.</p>
          </div>
          {erro && (
            <Alert tone="risk" role="alert">
              {erro.message}
            </Alert>
          )}
          <Field id="email" label="E-mail" required>
            <Input id="email" type="email" icon="mail" placeholder="nome@escritorio.com.br" autoComplete="username" required invalid={recusado} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field id="senha" label="Senha" required>
            <div className={styles.senha}>
              <Input id="senha" type={mostrarSenha ? "text" : "password"} icon="lock" placeholder="Sua senha" autoComplete="current-password" required invalid={recusado} value={senha} onChange={(e) => setSenha(e.target.value)} />
              <span className={styles.alternarSenha}>
                <IconButton icon={mostrarSenha ? "eye-off" : "eye"} label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} active={mostrarSenha} onClick={() => setMostrarSenha((v) => !v)} />
              </span>
            </div>
          </Field>
          <div className={styles.opcoes}>
            <Checkbox label="Manter conectado" checked={manterConectado} onChange={(e) => setManterConectado(e.target.checked)} />
            <Link href="/recuperar-senha" className={styles.esqueci}>
              Esqueci minha senha
            </Link>
          </div>
          <Button type="submit" block size="lg" loading={enviando}>
            Entrar na plataforma
          </Button>
          <p className={styles.ajuda}>Dúvidas de acesso: (61) 3021-8539 · seg a sex, 09h às 17h</p>
        </form>
      </main>
    </div>
  );
}
