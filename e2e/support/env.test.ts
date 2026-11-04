import { describe, expect, it } from "vitest";
import { resolveBaseUrl, resolveBrowser } from "./env";

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

describe("resolveBrowser", () => {
  it("usa o Chrome por padrão", () => {
    expect(resolveBrowser()).toBe("chrome");
  });

  it("recusa um navegador desconhecido", () => {
    expect(() => resolveBrowser("safari")).toThrow("chrome ou firefox");
  });
});
