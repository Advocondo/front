"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** O próprio layout quebrou: esta página não conta com nada dele, nem com o design system. */
export default function ErroGeral({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "4rem 1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Algo deu errado</h1>
        <p>Tente de novo. Se continuar, fale com o escritório: (61) 3021-8539.</p>
        <button type="button" onClick={retry}>
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
