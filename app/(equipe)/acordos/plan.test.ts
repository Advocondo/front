import { describe, expect, it } from "vitest";
import { buildPreview, feeFromPercent, monthlyDueDates, splitAmount, splitFee } from "./plan";

const soma = (valores: bigint[]) => valores.reduce((s, v) => s + v, 0n);

describe("splitAmount", () => {
  it("divide em partes iguais, e a última fica com os centavos (exemplo de docs/parcelas.md)", () => {
    expect(splitAmount(10000n, 3)).toEqual([3333n, 3333n, 3334n]);
  });

  it("US17-CA02: a soma é sempre o total", () => {
    for (const [total, parcelas] of [[550000n, 10], [100n, 3], [999999999999n, 7], [1n, 1]] as const) {
      expect(soma(splitAmount(total, parcelas))).toBe(total);
    }
  });
});

describe("feeFromPercent", () => {
  it("calcula e arredonda para o centavo mais próximo", () => {
    expect(feeFromPercent(550000n, 2000n)).toBe(110000n);
    expect(feeFromPercent(3333n, 1000n)).toBe(333n);
    expect(feeFromPercent(5n, 1000n)).toBe(1n); // 0,5 centavo arredonda para cima
    expect(feeFromPercent(999999999999n, 10000n)).toBe(999999999999n);
  });
});

describe("splitFee", () => {
  it("US16-CA02: os honorários de cada parcela não passam do valor dela, e a soma é o total", () => {
    const valores = splitAmount(10000n, 3);
    const honorarios = splitFee(valores, 1000n);
    expect(soma(honorarios)).toBe(1000n);
    honorarios.forEach((h, i) => {
      expect(h).toBeGreaterThanOrEqual(0n);
      expect(h).toBeLessThanOrEqual(valores[i]);
    });
  });

  it("não perde centavos em valores grandes", () => {
    const valores = splitAmount(999999999999n, 120);
    expect(soma(splitFee(valores, 333333333333n))).toBe(333333333333n);
  });
});

describe("monthlyDueDates", () => {
  it("em meses sem o dia, usa o último dia (exemplo de docs/parcelas.md)", () => {
    expect(monthlyDueDates("2026-01-31", 4)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("considera ano bissexto e a virada do ano", () => {
    expect(monthlyDueDates("2027-12-31", 3)).toEqual(["2027-12-31", "2028-01-31", "2028-02-29"]);
  });

  it("volta ao dia original depois de um mês curto", () => {
    expect(monthlyDueDates("2026-01-30", 3)).toEqual(["2026-01-30", "2026-02-28", "2026-03-30"]);
  });
});

describe("buildPreview", () => {
  it("resume o plano, com o exemplo do protótipo", () => {
    expect(buildPreview(550000n, 110000n, 10, "2026-10-10")).toEqual({
      parcelas: 10,
      valorDaParcela: 55000n,
      valorDaUltima: 55000n,
      condominioPorParcela: 44000n,
      honorariosPorParcela: 11000n,
      total: 550000n,
      honorarios: 110000n,
      repasse: 440000n,
      primeiroVencimento: "2026-10-10",
      ultimoVencimento: "2027-07-10",
    });
  });

  it.each([
    ["sem total", 0n, 0n, 1, "2026-01-01"],
    ["sem honorários", 100n, null, 1, "2026-01-01"],
    ["honorários acima do total", 100n, 101n, 1, "2026-01-01"],
    ["sem parcelas", 100n, 0n, 0, "2026-01-01"],
    ["parcelas demais", 100n, 0n, 121, "2026-01-01"],
    ["parcela fracionada", 100n, 0n, 1.5, "2026-01-01"],
    ["parcela abaixo de um centavo", 5n, 0n, 6, "2026-01-01"],
    ["sem vencimento", 100n, 0n, 1, ""],
  ])("não mostra prévia %s", (_, total, honorarios, parcelas, vencimento) => {
    expect(buildPreview(total, honorarios, parcelas, vencimento)).toBeNull();
  });
});
