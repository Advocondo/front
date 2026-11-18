import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { carregarArquivoEnv } from "./arquivo-env";

function arquivo(conteudo: string): string {
  const caminho = join(mkdtempSync(join(tmpdir(), "e2e-env-")), ".env.e2e");
  writeFileSync(caminho, conteudo);
  return caminho;
}

describe("carregarArquivoEnv", () => {
  it("lê as variáveis do arquivo", () => {
    const destino: Record<string, string | undefined> = {};
    carregarArquivoEnv(arquivo("E2E_TARGET=homologacao\n# comentário\nE2E_BASE_URL=https://front.exemplo\n"), destino);
    expect(destino).toEqual({ E2E_TARGET: "homologacao", E2E_BASE_URL: "https://front.exemplo" });
  });

  it("a variável do terminal vale mais que a do arquivo", () => {
    const destino: Record<string, string | undefined> = { E2E_TARGET: "local" };
    carregarArquivoEnv(arquivo("E2E_TARGET=homologacao\n"), destino);
    expect(destino.E2E_TARGET).toBe("local");
  });

  it("ignora a linha sem valor, para o padrão local continuar valendo", () => {
    const destino: Record<string, string | undefined> = {};
    carregarArquivoEnv(arquivo("E2E_ADMIN_EMAIL=\nE2E_BROWSER=firefox\n"), destino);
    expect(destino).toEqual({ E2E_BROWSER: "firefox" });
  });

  it("sem o arquivo, não muda nada", () => {
    const destino: Record<string, string | undefined> = {};
    carregarArquivoEnv("/caminho/que/nao/existe/.env.e2e", destino);
    expect(destino).toEqual({});
  });
});
