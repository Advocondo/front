import { apiBaseUrl } from "@/app/lib/api-url";
import type { LandingContent } from "./types";

const TEMPO_LIMITE_MS = 5000;

/** `no-store` porque a edição do Administrador fica pública assim que é salva (US04-CA01). */
export async function getLanding(): Promise<LandingContent | null> {
  try {
    const resposta = await fetch(`${apiBaseUrl()}/landing`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resposta.ok) {
      console.error(`GET /landing respondeu ${resposta.status}`);
      return null;
    }
    return (await resposta.json()) as LandingContent;
  } catch (error) {
    console.error("Falha ao buscar o conteúdo da landing", error);
    return null;
  }
}
