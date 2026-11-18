import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/**
 * Lê o `.env.e2e` para dentro de `process.env`, se ele existir. Uma variável já definida no terminal
 * vale mais que a do arquivo, para dar para trocar um valor numa execução sem editar o arquivo.
 * Uma linha sem valor, como `E2E_ADMIN_EMAIL=`, é ignorada, e o padrão local continua valendo.
 */
export function carregarArquivoEnv(caminho: string, destino: Record<string, string | undefined> = process.env): void {
  if (!existsSync(caminho)) return;
  for (const [nome, valor] of Object.entries(parseEnv(readFileSync(caminho, "utf8")))) {
    if (valor !== "" && destino[nome] === undefined) destino[nome] = valor;
  }
}
