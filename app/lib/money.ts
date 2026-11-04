/** Dinheiro em centavos, com BigInt: o back aceita valores grandes demais para `number`. */

const MAX_DIGITOS = 12;

/** "5500.00" (formato da API) -> 550000n */
export const centsFromApi = (valor: string): bigint => BigInt(valor.replace(".", ""));

/** 550000n -> "5500.00" (formato da API) */
export function centsToApi(centavos: bigint): string {
  const texto = centavos.toString().padStart(3, "0");
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

function semPrefixo(centavos: bigint): string {
  const [reais, resto] = centsToApi(centavos).split(".");
  return `${reais.replace(/\B(?=(\d{3})+$)/g, ".")},${resto}`;
}

/** 550000n ou "5500.00" -> "R$ 5.500,00" */
export function formatBRL(valor: bigint | string): string {
  return `R$ ${semPrefixo(typeof valor === "string" ? centsFromApi(valor) : valor)}`;
}

/** Máscara de digitação: os dígitos entram pelos centavos. "550000" -> "5.500,00" */
export function maskMoney(valor: string): string {
  const digitos = valor.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITOS);
  return digitos ? semPrefixo(BigInt(digitos)) : "";
}

/** "5.500,00" -> 550000n; vazio -> 0n */
export const centsFromMasked = (valor: string): bigint => BigInt(valor.replace(/\D/g, "") || "0");

/** "12,5" -> 1250n (centésimos de ponto percentual); null quando não é um percentual de 0 a 100. */
export function parsePercent(valor: string): bigint | null {
  const achado = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(valor.trim());
  if (!achado) return null;
  const centesimos = BigInt(achado[1]) * 100n + BigInt((achado[2] ?? "").padEnd(2, "0"));
  return centesimos > 10000n ? null : centesimos;
}
