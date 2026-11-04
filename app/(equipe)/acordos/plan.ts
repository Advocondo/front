/**
 * Prévia do parcelamento: as mesmas regras de parcelas/plan.py e acordos/fees.py no back,
 * para a tela mostrar antes de salvar exatamente o que será gerado.
 */

function divisaoArredondada(dividendo: bigint, divisor: bigint): bigint {
  return (2n * dividendo + divisor) / (2n * divisor);
}

/** Parcelas iguais; os centavos que sobram vão para a última (US17-CA02). */
export function splitAmount(total: bigint, parcelas: number): bigint[] {
  const quantidade = BigInt(parcelas);
  const base = total / quantidade;
  const valores = Array.from({ length: parcelas }, () => base);
  valores[parcelas - 1] += total - base * quantidade;
  return valores;
}

/** `percentual` em centésimos: 20% = 2000n. Arredonda para o centavo mais próximo. */
export const feeFromPercent = (total: bigint, percentual: bigint): bigint => divisaoArredondada(total * percentual, 10000n);

/** Honorários de cada parcela, proporcionais ao valor dela, sem perder centavo (US16-CA01). */
export function splitFee(valores: bigint[], honorarios: bigint): bigint[] {
  const total = valores.reduce((soma, valor) => soma + valor, 0n);
  let acumulado = 0n;
  let honorariosAteAqui = 0n;
  return valores.map((valor) => {
    acumulado += valor;
    const ateEsta = divisaoArredondada(honorarios * acumulado, total);
    const daParcela = ateEsta - honorariosAteAqui;
    honorariosAteAqui = ateEsta;
    return daParcela;
  });
}

/** Um vencimento por mês, no mesmo dia; em meses sem esse dia, no último dia do mês. */
export function monthlyDueDates(primeiro: string, parcelas: number): string[] {
  const [ano, mes, dia] = primeiro.split("-").map(Number);
  return Array.from({ length: parcelas }, (_, i) => {
    const indice = mes - 1 + i;
    const anoDaParcela = ano + Math.floor(indice / 12);
    const mesDaParcela = indice % 12;
    const ultimoDia = new Date(Date.UTC(anoDaParcela, mesDaParcela + 1, 0)).getUTCDate();
    const texto = (n: number) => String(n).padStart(2, "0");
    return `${String(anoDaParcela).padStart(4, "0")}-${texto(mesDaParcela + 1)}-${texto(Math.min(dia, ultimoDia))}`;
  });
}

export type Previa = {
  parcelas: number;
  valorDaParcela: bigint;
  valorDaUltima: bigint;
  condominioPorParcela: bigint;
  honorariosPorParcela: bigint;
  total: bigint;
  honorarios: bigint;
  repasse: bigint;
  primeiroVencimento: string;
  ultimoVencimento: string;
};

/** null enquanto faltam dados ou quando o back recusaria os valores. */
export function buildPreview(total: bigint, honorarios: bigint | null, parcelas: number, primeiroVencimento: string): Previa | null {
  if (total <= 0n || honorarios === null || honorarios > total) return null;
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 120 || !primeiroVencimento) return null;
  if (total / BigInt(parcelas) === 0n) return null;
  const valores = splitAmount(total, parcelas);
  const honorariosDasParcelas = splitFee(valores, honorarios);
  const datas = monthlyDueDates(primeiroVencimento, parcelas);
  return {
    parcelas,
    valorDaParcela: valores[0],
    valorDaUltima: valores[parcelas - 1],
    condominioPorParcela: valores[0] - honorariosDasParcelas[0],
    honorariosPorParcela: honorariosDasParcelas[0],
    total,
    honorarios,
    repasse: total - honorarios,
    primeiroVencimento: datas[0],
    ultimoVencimento: datas[parcelas - 1],
  };
}
