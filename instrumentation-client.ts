import * as Sentry from "@sentry/nextjs";
import { opcoesDoSentry } from "@/app/lib/monitoramento";

// Erros não tratados e rejeições de Promise no navegador (#43). Sem DSN, fica desligado.
Sentry.init(opcoesDoSentry);
