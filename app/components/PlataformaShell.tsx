"use client";

import { SidebarNav, TopBar } from "edson-alexandre-design-system";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// Cada US nova acrescenta aqui o seu item (Devedores, Acordos...).
const NAV = [
  { section: "Acompanhamento" },
  { id: "condominios", label: "Condomínios", icon: "building-2" },
];

const ROTAS: Record<string, string> = { condominios: "/condominios" };

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
  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 h-screen">
        <SidebarNav
          items={NAV}
          activeId={activeId}
          onSelect={(id) => router.push(ROTAS[id] ?? "/")}
          header={<strong className="px-4 py-5 text-lg text-white">Advocondo</strong>}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
