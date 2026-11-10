import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/** O mesmo nome de ambiente do back, para os alertas filtrarem por `environment:producao`. */
function ambiente(): string {
  if (process.env.VERCEL_ENV === "production") return "producao";
  return process.env.VERCEL_ENV ?? "local";
}

const nextConfig: NextConfig = {
  // Standalone output is for the Docker image; Vercel uses its own build output.
  output: process.env.VERCEL ? undefined : "standalone",
  // Embaixo, o indicador cobre o nome no rodapé do menu (desktop) ou um item da navegação inferior
  // (celular). No alto à esquerda, cobre só texto: o nome do sistema ou o título da tela.
  devIndicators: { position: "top-left" },
  env: {
    NEXT_PUBLIC_AMBIENTE: ambiente(),
    NEXT_PUBLIC_VERSAO: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
};

// Sem SENTRY_AUTH_TOKEN, não há envio de source maps: as pilhas chegam ao Sentry minificadas.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: true,
  telemetry: false,
});
