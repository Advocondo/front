"use client";

import { Button, TopBar } from "edson-alexandre-design-system";
import Link from "next/link";
import type { ReactNode } from "react";
import { logOut } from "@/app/lib/auth";

/** Casca das telas do Cliente: sem barra lateral, porque ele não usa o menu do escritório. */
export function ClienteShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="area-cliente flex min-h-screen w-full flex-col">
      <TopBar
        title={title}
        subtitle={subtitle}
        actions={
          <span className="inline-flex items-center gap-3">
            <Link href="/perfil" className="text-sm font-medium">
              Meu perfil
            </Link>
            <Button size="sm" variant="secondary" icon="log-out" onClick={() => void logOut()}>
              Sair
            </Button>
          </span>
        }
      />
      <main className="grid flex-1 content-start gap-5 p-4 sm:p-6">{children}</main>
    </div>
  );
}
