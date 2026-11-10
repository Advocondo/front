"use client";

import { Button, Toast, ToastStack } from "edson-alexandre-design-system";
import { useEffect, useState, type ReactNode } from "react";
import { ROTULO_DO_PERFIL } from "@/app/(equipe)/usuarios/api";
import { ClienteShell } from "@/app/(cliente)/painel-cliente/ClienteShell";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { logOut } from "@/app/lib/auth";
import { useSession } from "@/app/lib/session";
import { AlterarSenha } from "./AlterarSenha";
import { DadosDeAcesso } from "./DadosDeAcesso";
import { SessoesAtivas } from "./SessoesAtivas";

export function PerfilView() {
  const session = useSession();
  const [aviso, setAviso] = useState<string | null>(null);
  const [versaoDasSessoes, setVersaoDasSessoes] = useState(0);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(timer);
  }, [aviso]);

  // A página só abre com sessão (RequireAuth). Ela some durante a saída, antes de o guard redirecionar.
  if (!session) return null;
  const { user } = session;
  const titulo = "Meu perfil";
  const subtitulo = ROTULO_DO_PERFIL[user.role];

  const conteudo: ReactNode = (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <DadosDeAcesso usuario={user} onSaved={setAviso} />
      <AlterarSenha
        onSaved={(texto) => {
          setAviso(texto);
          setVersaoDasSessoes((n) => n + 1);
        }}
      />
      <SessoesAtivas versao={versaoDasSessoes} onEnded={setAviso} />
      <Button variant="ghost" icon="log-out" onClick={() => void logOut()}>
        Sair desta sessão
      </Button>
      {aviso && (
        <ToastStack style={{ bottom: "var(--aviso-bottom, var(--space-6))" }}>
          <Toast tone="ok" title={aviso} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </div>
  );

  return user.role === "client" ? (
    <ClienteShell title={titulo} subtitle={subtitulo}>
      {conteudo}
    </ClienteShell>
  ) : (
    <PlataformaShell activeId="perfil" title={titulo} subtitle={subtitulo}>
      {conteudo}
    </PlataformaShell>
  );
}
