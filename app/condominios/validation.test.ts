import { describe, expect, it } from "vitest";
import { emptyForm } from "./format";
import { isValidCnpj, validate } from "./validation";

describe("isValidCnpj", () => {
  it.each(["14.447.918/0001-98", "14447918000198"])("aceita %s", (v) => expect(isValidCnpj(v)).toBe(true));
  it.each(["14447918000199", "11111111111111", "123", ""])("rejeita %s", (v) => expect(isValidCnpj(v)).toBe(false));
});

describe("validate", () => {
  it("exige só o nome", () => {
    expect(validate(emptyForm)).toEqual({ nome: "Informe o nome do condomínio." });
    expect(validate({ ...emptyForm, nome: "Mirante" })).toEqual({});
  });

  it("aponta cada campo inválido", () => {
    const errors = validate({ ...emptyForm, nome: "X", cnpj: "123", cep: "12", uf: "D", sindico_email: "a@", sindico_telefone: "123" });
    expect(Object.keys(errors).sort()).toEqual(["cep", "cnpj", "sindico_email", "sindico_telefone", "uf"]);
  });

  it("não aceita renovação anterior ao início do contrato", () => {
    const errors = validate({ ...emptyForm, nome: "X", contrato_inicio: "2026-01-01", contrato_renovacao: "2025-12-31" });
    expect(errors.contrato_renovacao).toMatch(/anterior/);
  });
});
