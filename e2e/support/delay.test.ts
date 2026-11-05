import { describe, expect, it } from "vitest";
import { resolveDelayMs, tempoLimiteMs } from "./delay";

describe("resolveDelayMs", () => {
  it("usa 1 segundo por padrão", () => {
    expect(resolveDelayMs(undefined, false)).toBe(1000);
  });

  it("usa 0 no CI", () => {
    expect(resolveDelayMs(undefined, true)).toBe(0);
  });

  it("quem roda escolhe, inclusive no CI", () => {
    expect(resolveDelayMs("250", false)).toBe(250);
    expect(resolveDelayMs("0", false)).toBe(0);
    expect(resolveDelayMs("500", true)).toBe(500);
  });

  it("variável vazia vale como não definida", () => {
    expect(resolveDelayMs("", false)).toBe(1000);
  });

  it.each(["abc", "-1", "1.5", "1s"])("recusa %s, em vez de ignorar o que a pessoa pediu", (valor) => {
    expect(() => resolveDelayMs(valor, false)).toThrow("E2E_DELAY_MS");
  });
});

describe("tempoLimiteMs", () => {
  it("cresce com a pausa, para ela não virar falha por tempo", () => {
    expect(tempoLimiteMs(0)).toBe(60_000);
    expect(tempoLimiteMs(1000)).toBe(120_000);
  });
});
