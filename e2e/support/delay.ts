/**
 * Pausa antes de cada ação no navegador, para quem acompanha a tela conseguir ver o que acontece.
 * Fica fora de env.ts porque a configuração do Vitest também lê, para ajustar os tempos limite.
 */
const PADRAO_MS = 1000;

/** `E2E_DELAY_MS` escolhe a pausa. Sem ela, 1 segundo, e 0 no CI, onde ninguém está olhando. */
export function resolveDelayMs(raw: string | undefined, noCi: boolean): number {
  if (raw === undefined || raw === "") return noCi ? 0 : PADRAO_MS;
  const valor = Number(raw);
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`E2E_DELAY_MS precisa ser um número inteiro de milissegundos, 0 ou mais; recebido: ${raw}`);
  }
  return valor;
}

/** Um teste longo faz dezenas de ações: o tempo limite cresce com a pausa, para ela não virar falha. */
export function tempoLimiteMs(delayMs: number): number {
  const BASE_MS = 60_000;
  const ACOES_POR_TESTE = 60;
  return BASE_MS + delayMs * ACOES_POR_TESTE;
}
