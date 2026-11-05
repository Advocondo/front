import { describe, expect, it } from "vitest";
import { exigirDeProducao, resolveApiUrl, resolveBaseUrl, resolveBrowser } from "./env";

describe("resolveApiUrl", () => {
  it("usa a API local por padrão", () => {
    expect(resolveApiUrl()).toBe("http://localhost:8000");
  });

  it("recusa a API de produção", () => {
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

describe("alvo de produção", () => {
  it("só aceita um endereço externo quando a suíte de produção pede", () => {
    expect(resolveBaseUrl("https://advocondo.com.br/", true)).toBe("https://advocondo.com.br");
    expect(resolveApiUrl("https://api.advocondo.com.br", true)).toBe("https://api.advocondo.com.br");
  });

  it("a recusa da suíte comum indica o comando certo", () => {
    expect(() => resolveBaseUrl("https://advocondo.com.br")).toThrow("npm run test:e2e:prod");
  });

  it("exige as variáveis, em vez de cair nos padrões locais", () => {
    expect(() => exigirDeProducao({ E2E_BASE_URL: "https://x", E2E_API_URL: undefined, E2E_ADMIN_EMAIL: "", E2E_ADMIN_PASSWORD: "y" })).toThrow("E2E_API_URL, E2E_ADMIN_EMAIL");
    expect(() => exigirDeProducao({ E2E_BASE_URL: "https://x" })).not.toThrow();
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
