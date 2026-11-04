import { describe, expect, it } from "vitest";
import { formatDate, maskCep, maskCnpj, maskTelefone, toPayload, emptyForm } from "./format";

describe("máscaras", () => {
  it.each([
    ["14447918000198", "14.447.918/0001-98"],
    ["14447", "14.447"],
    ["144479180001989999", "14.447.918/0001-98"],
    ["", ""],
  ])("CNPJ %s -> %s", (input, expected) => expect(maskCnpj(input)).toBe(expected));

  it.each([["12345678", "12345-678"], ["123", "123"]])("CEP %s -> %s", (i, e) => expect(maskCep(i)).toBe(e));

  it.each([
    ["61912345678", "(61) 91234-5678"],
    ["6132345678", "(61) 3234-5678"],
    ["61", "61"],
  ])("telefone %s -> %s", (i, e) => expect(maskTelefone(i)).toBe(e));
});

it("formata datas em dd/mm/aaaa sem depender de fuso", () => {
  expect(formatDate("2026-01-31")).toBe("31/01/2026");
  expect(formatDate(null)).toBe("—");
});

describe("toPayload", () => {
  it("troca vazio por null e envia só dígitos nos campos numéricos", () => {
    const payload = toPayload({ ...emptyForm, nome: "  Mirante ", cnpj: "14.447.918/0001-98", uf: "df", sindico_telefone: "(61) 91234-5678" });
    expect(payload).toMatchObject({ nome: "Mirante", cnpj: "14447918000198", uf: "DF", sindico_telefone: "61912345678", cep: null, bairro: null });
  });
});
