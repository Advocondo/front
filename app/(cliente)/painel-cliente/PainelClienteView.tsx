"use client";

import { Button, EmptyState } from "edson-alexandre-design-system";
import { logOut } from "@/app/lib/auth";

/** Destino do perfil Cliente após o login, até a US37 trazer o painel de verdade. */
export function PainelClienteView() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon="building-2"
        title="Painel do Cliente"
        description="Em breve você acompanhará aqui os acordos dos seus condomínios."
        action={
          <Button variant="secondary" icon="log-out" onClick={() => void logOut()}>
            Sair
          </Button>
        }
      />
    </main>
  );
}
