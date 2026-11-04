"use client";

import { IconButton, SidebarNav, TopBar } from "edson-alexandre-design-system";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { logOut } from "@/app/lib/auth";
import { useSession } from "@/app/lib/session";

// Cada US nova acrescenta aqui o seu item (Devedores, Acordos...).
const NAV = [
  { section: "Acompanhamento" },
  { id: "acordos", label: "Acordos", icon: "handshake" },
  { id: "acompanhamento", label: "Faturas do mês", icon: "calendar-check" },
  { id: "condominios", label: "Condomínios", icon: "building-2" },
  { id: "devedores", label: "Devedores", icon: "users" },
];

const ROTAS: Record<string, string> = { acordos: "/acordos", acompanhamento: "/acompanhamento", condominios: "/condominios", devedores: "/devedores" };

type Props = {
  activeId: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

/** Casca da plataforma interna: barra lateral fixa, barra superior e área de conteúdo. */
export function PlataformaShell({ activeId, title, subtitle, actions, children }: Props) {
  const router = useRouter();
  const session = useSession();
  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 h-screen">
        <SidebarNav
          items={NAV}
          activeId={activeId}
          onSelect={(id) => router.push(ROTAS[id] ?? "/")}
          header={<strong className="px-4 py-5 text-lg text-white">Advocondo</strong>}
          footer={
            <div className="flex items-center justify-between gap-2 p-4 text-sm text-white">
              <span className="min-w-0 truncate">{session?.user.name}</span>
              <IconButton icon="log-out" label="Sair" variant="inverse" onClick={() => void logOut()} />
            </div>
          }
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
