"use client";

import { Icon, IconButton, SidebarNav, TopBar } from "edson-alexandre-design-system";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { itensDaBarraInferior, TELAS } from "@/app/components/navegacao";
import { SinoDeNotificacoes } from "@/app/components/SinoDeNotificacoes";
import { logOut } from "@/app/lib/auth";
import { useSession } from "@/app/lib/session";

// Cada US nova acrescenta aqui o seu item (Devedores, Acordos...).
const NAV = [
  { section: "Acompanhamento" },
  { id: "acordos", label: "Acordos", icon: "handshake" },
  { id: "acompanhamento", label: "Faturas do mês", icon: "calendar-check" },
  { id: "metas", label: "Metas e comissões", icon: "target" },
  { id: "condominios", label: "Condomínios", icon: "building-2" },
  { id: "devedores", label: "Devedores", icon: "users" },
];

// O Painel é do Administrador (US34).
const NAV_ADMIN_TOPO = [{ id: "painel", label: "Painel", icon: "layout-dashboard" }];

// Só o Administrador vê e acessa a gestão de usuários (US07-CA02).
const NAV_ADMIN = [
  { section: "Controle" },
  { id: "usuarios", label: "Gestão de usuários", icon: "users-round" },
  { id: "auditoria", label: "Trilha de auditoria", icon: "scroll-text" },
  { id: "institucional", label: "Conteúdo institucional", icon: "panels-top-left" },
];

const ROTAS: Record<string, string> = Object.fromEntries(Object.values(TELAS).map((t) => [t.id, t.href]));

type Props = {
  activeId: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Só a tela de notificações passa: ela já sabe o número, e o sino acompanha. */
  naoLidas?: number;
  children: ReactNode;
};

/** Casca da plataforma interna: barra lateral fixa, barra superior e área de conteúdo. */
export function PlataformaShell({ activeId, title, subtitle, actions, naoLidas, children }: Props) {
  const router = useRouter();
  const session = useSession();
  return (
    <div className="plataforma flex min-h-screen">
      {/* No celular, a barra lateral dá lugar à navegação inferior (protótipos mobile). */}
      <div className="sticky top-0 hidden h-screen md:block">
        <SidebarNav
          items={session?.user.role === "admin" ? [...NAV_ADMIN_TOPO, ...NAV, ...NAV_ADMIN] : NAV}
          activeId={activeId}
          onSelect={(id) => router.push(ROTAS[id] ?? "/")}
          header={<strong className="px-4 py-5 text-lg text-white">Advocondo</strong>}
          footer={
            <div className="flex items-center justify-between gap-2 p-4 text-sm text-white">
              {/* A cor global dos links é escura e sumiria no fundo navy. */}
              <Link href="/perfil" className="min-w-0 truncate" style={{ color: "inherit" }}>
                {session?.user.name}
              </Link>
              <IconButton icon="log-out" label="Sair" variant="inverse" onClick={() => void logOut()} />
            </div>
          }
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          subtitle={subtitle}
          actions={
            <span className="inline-flex items-center gap-3">
              {actions}
              <SinoDeNotificacoes contagem={naoLidas} />
            </span>
          }
        />
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6">{children}</main>
      </div>
      <NavegacaoInferior activeId={activeId} />
    </div>
  );
}

/** Barra fixa no rodapé, só abaixo de 768px. Uma tela fora da barra marca o "Mais". */
function NavegacaoInferior({ activeId }: { activeId: string }) {
  const role = useSession()?.user.role;
  const itens = itensDaBarraInferior(role);
  const ativo = itens.some((i) => i.id === activeId) ? activeId : "mais";
  return (
    <nav aria-label="Navegação inferior" className="navegacao-inferior fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 md:hidden">
      {itens.map((item) => (
        <Link key={item.id} href={item.href} aria-current={item.id === ativo ? "page" : undefined} className="navegacao-inferior__item">
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
