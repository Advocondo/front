import { describe, expect, it } from "vitest";
import { exigirDaHomologacao, resolveAlvo, resolveApiUrl, resolveBaseUrl, resolveBrowser } from "./env";

describe("resolveApiUrl", () => {
  it("usa a API local por padrão", () => {
    expect(resolveApiUrl()).toBe("http://localhost:8000");
  });

  it("no ambiente local, recusa uma API externa", () => {
    expect(() => resolveApiUrl("https://api.advocondo.com.br")).toThrow("E2E_API_URL precisa ser um endereço local");
  });
});

describe("resolveBaseUrl", () => {
  it("usa o front local por padrão", () => {
    expect(resolveBaseUrl()).toBe("http://localhost:3000");
  });

  it.each(["http://localhost:4000/", "http://127.0.0.1:3000", "http://[::1]:3000"])("aceita %s", (url) => {
    expect(() => resolveBaseUrl(url)).not.toThrow();
  });

  it.each(["https://advocondo.com.br", "https://advocondo-front.vercel.app", "http://localhost.evil.com"])(
    "recusa %s",
    (url) => {
      expect(() => resolveBaseUrl(url)).toThrow("endereço local");
    },
  );
});

describe("resolveAlvo", () => {
  it.each([undefined, "", "local"])("%s é o ambiente local", (raw) => {
    expect(resolveAlvo(raw)).toBe("local");
  });

  it("aceita a homologação", () => {
    expect(resolveAlvo("homologacao")).toBe("homologacao");
  });

  it("recusa um alvo desconhecido, em vez de cair no local", () => {
    expect(() => resolveAlvo("prod")).toThrow("local ou homologacao");
  });
});

describe("alvo de homologação", () => {
  it("aceita um endereço externo", () => {
    expect(resolveBaseUrl("https://advocondo.com.br/", "homologacao")).toBe("https://advocondo.com.br");
    expect(resolveApiUrl("https://api.advocondo.com.br", "homologacao")).toBe("https://api.advocondo.com.br");
  });

  it("a recusa do ambiente local indica como apontar para a homologação", () => {
    expect(() => resolveBaseUrl("https://advocondo.com.br")).toThrow("E2E_TARGET=homologacao");
  });

  it("exige as variáveis, em vez de cair nos padrões locais", () => {
    expect(() => exigirDaHomologacao({ E2E_BASE_URL: "https://x", E2E_API_URL: undefined, E2E_CLIENTE2_EMAIL: "" })).toThrow("E2E_API_URL, E2E_CLIENTE2_EMAIL");
    expect(() => exigirDaHomologacao({ E2E_BASE_URL: "https://x" })).not.toThrow();
  });
});

describe("resolveBrowser", () => {
  it("usa o Chrome por padrão", () => {
    expect(resolveBrowser()).toBe("chrome");
  });

  it("recusa um navegador desconhecido", () => {
    expect(() => resolveBrowser("safari")).toThrow("chrome ou firefox");
  });
});
