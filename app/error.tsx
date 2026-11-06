"use client";

import * as Sentry from "@sentry/nextjs";
import { Button, EmptyState } from "edson-alexandre-design-system";
import { useEffect } from "react";

/** Uma tela quebrou. O erro em si não aparece aqui: a mensagem técnica vai para o Sentry. */
export default function ErroDaTela({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        icon="triangle-alert"
        title="Algo deu errado nesta tela"
        description="Tente de novo. Se continuar, fale com o escritório: (61) 3021-8539."
        action={<Button onClick={retry}>Tentar novamente</Button>}
      />
    </main>
  );
}
