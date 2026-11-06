import * as Sentry from "@sentry/nextjs";
import { opcoesDoSentry } from "@/app/lib/monitoramento";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") Sentry.init(opcoesDoSentry);
}

export const onRequestError = Sentry.captureRequestError;
