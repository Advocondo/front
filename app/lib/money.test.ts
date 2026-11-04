import { describe, expect, it } from "vitest";
import { centsFromApi, centsFromMasked, centsToApi, formatBRL, maskMoney, parsePercent } from "./money";

describe("dinheiro", () => {
  it.each([
    ["5500.00", 550000n],
    ["0.05", 5n],
    ["9999999999.99", 999999999999n],
  ])("%s <-> %s centavos", (api, centavos) => {
    expect(centsFromApi(api)).toBe(centavos);
    expect(centsToApi(centavos)).toBe(api);
  });

  it.each([
    [550000n, "R$ 5.500,00"],
    [5n, "R$ 0,05"],
    [100n, "R$ 1,00"],
    [999999999999n, "R$ 9.999.999.999,99"],
    ["1234.50", "R$ 1.234,50"],
  ])("formata %s como %s", (valor, esperado) => {
    expect(formatBRL(valor)).toBe(esperado);
  });

  it("não usa espaço especial, para o texto ser fácil de copiar e de testar", () => {
    expect(formatBRL(100n)).not.toContain(" ");
  });

  it.each([
    ["5", "0,05"],
    ["550000", "5.500,00"],
    ["5.500,00", "5.500,00"],
    ["00123", "1,23"],
    ["abc", ""],
    ["", ""],
    ["9999999999991234", "9.999.999.999,99"],
  ])("máscara %s -> %s", (digitado, esperado) => {
    expect(maskMoney(digitado)).toBe(esperado);
  });

  it("lê de volta o valor mascarado", () => {
    expect(centsFromMasked("5.500,00")).toBe(550000n);
    expect(centsFromMasked("")).toBe(0n);
  });

  it.each([
    ["20", 2000n],
    ["12,5", 1250n],
    ["12.75", 1275n],
    ["0", 0n],
    ["100", 10000n],
  ])("percentual %s -> %s", (digitado, esperado) => {
    expect(parsePercent(digitado)).toBe(esperado);
  });

  it.each(["", "abc", "100,01", "101", "12,345", "-5"])("recusa o percentual %s", (digitado) => {
    expect(parsePercent(digitado)).toBeNull();
  });
});
