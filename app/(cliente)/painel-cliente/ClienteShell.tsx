"use client";

import { Button, TopBar } from "edson-alexandre-design-system";
import type { ReactNode } from "react";
import { logOut } from "@/app/lib/auth";

/** Casca das telas do Cliente: sem barra lateral, porque ele não usa o menu do escritório. */
export function ClienteShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <TopBar
        title={title}
        subtitle={subtitle}
        actions={
          <Button size="sm" variant="secondary" icon="log-out" onClick={() => void logOut()}>
            Sair
          </Button>
        }
      />
      <main className="grid flex-1 content-start gap-5 p-4 sm:p-6">{children}</main>
    </div>
  );
}
