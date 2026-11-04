# Testes E2E

Testes de ponta a ponta com [Selenium](https://www.selenium.dev/documentation/webdriver/), escritos em TypeScript e executados pelo Vitest. Eles abrem um navegador de verdade e usam o front como um usuário.

**Não rodam no CI.** O passo `npm run test` do CI só coleta `*.test.ts(x)`, e estes arquivos terminam em `.e2e.ts`. Como precisam do front, do back e de um banco no ar, são executados manualmente. O CI ainda passa `eslint` e `tsc` neles, então erros de compilação aparecem no PR.

## Pré-requisitos

- Node 22 e `npm install` feito.
- Chrome ou Firefox instalado. O Selenium Manager baixa o driver na primeira execução, então é preciso ter internet.
- O back rodando em `http://localhost:8000`, com o banco local (veja o README do repositório `back`). Nunca use dados de produção.

## Como rodar

Em um terminal, suba o front:

```bash
npm run dev
```

Em outro, rode os testes:

```bash
npm run test:e2e                                # todos
npm run test:e2e -- e2e/condominios.e2e.ts      # um arquivo
E2E_HEADLESS=false npm run test:e2e             # vendo o navegador
```

## Variáveis de ambiente

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3000` | Endereço do front. Só aceita `localhost`, `127.0.0.1` ou `[::1]`: qualquer outro host interrompe a execução, para os testes nunca rodarem contra produção |
| `E2E_BROWSER` | `chrome` | `chrome` ou `firefox` |
| `E2E_HEADLESS` | ligado | `false` abre a janela do navegador |

## Como adicionar um teste

Todo PR de tela nova traz um arquivo `e2e/<funcionalidade>.e2e.ts` cobrindo os critérios de aceitação da história.

```ts
import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, it } from "vitest";
import { createDriver, visit, waitForElement } from "./support/driver";

describe("Minha tela", () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("mostra o campo de busca", async () => {
    await visit(driver, "/minha-tela");
    await waitForElement(driver, By.css('input[aria-label="Buscar"]'));
  });
});
```

- Procure elementos pelo que o usuário percebe (`aria-label`, texto), não por classes de estilo.
- Use as esperas de `support/driver.ts`, nunca um tempo fixo.
- Cada arquivo abre o próprio navegador. Os arquivos rodam um de cada vez.
