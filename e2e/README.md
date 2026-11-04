# Testes E2E

Testes de ponta a ponta com [Selenium](https://www.selenium.dev/documentation/webdriver/), escritos em TypeScript e executados pelo Vitest. Eles abrem um navegador de verdade e usam o front como um usuário.

**Não rodam no CI.** O passo `npm run test` do CI só coleta `*.test.ts(x)`, e estes arquivos terminam em `.e2e.ts`. Como precisam do front, do back e de um banco no ar, são executados manualmente. O CI ainda passa `eslint` e `tsc` neles, então erros de compilação aparecem no PR.

## Pré-requisitos

- Node 22 e `npm install` feito.
- Chrome ou Firefox instalado. O Selenium Manager baixa o driver na primeira execução, então é preciso ter internet.
- Docker, para o back. Nunca use dados de produção.

## Como rodar

**1. Suba o back** pelo Docker Compose, com o banco vazio e um `SETUP_TOKEN` de pelo menos 32 caracteres no `.env` do `back`:

```bash
cd ../back
cp .env.example .env                    # se ainda não existir
# no .env: SETUP_TOKEN=<saída de: openssl rand -hex 32>
docker compose up --build -d
docker compose run --rm api uv run alembic upgrade head
```

Se a API não subir com um erro de `ValidationError`, o seu `.env` está mais antigo que o `.env.example`: copie as variáveis que faltam.

O token e o banco vazio são usados só na primeira execução, para criar o Administrador de teste por `POST /setup`. Nas seguintes, os testes entram com esse mesmo usuário. Se o banco já tiver outros usuários, informe um Administrador existente em `E2E_ADMIN_EMAIL` e `E2E_ADMIN_PASSWORD`.

**2. Suba o front** em outro terminal:

```bash
npm run dev
```

**3. Rode os testes** em um terceiro:

```bash
export E2E_SETUP_TOKEN=<o mesmo SETUP_TOKEN>
npm run test:e2e                                # todos
npm run test:e2e -- e2e/login.e2e.ts            # um arquivo
E2E_HEADLESS=false npm run test:e2e             # vendo o navegador
```

Os usuários de teste são criados pelo fluxo real de convite. Sem SMTP, o back escreve o e-mail no log, e os testes leem o link com `docker compose logs api`. Por isso o back precisa estar no Compose, com `SMTP_HOST` vazio. Cada execução cria usuários novos no banco local.

## Variáveis de ambiente

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3000` | Endereço do front. Só aceita `localhost`, `127.0.0.1` ou `[::1]`: qualquer outro host interrompe a execução, para os testes nunca rodarem contra produção |
| `E2E_BROWSER` | `chrome` | `chrome` ou `firefox` |
| `E2E_HEADLESS` | ligado | `false` abre a janela do navegador |
| `E2E_API_URL` | `http://localhost:8000` | Endereço da API. Também só aceita host local |
| `E2E_BACK_DIR` | `../back` | Pasta do repositório `back`, de onde os testes leem os logs |
| `E2E_SETUP_TOKEN` | vazio | Valor de `SETUP_TOKEN` do back. Necessário só para criar o primeiro Administrador |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | valores de teste em `support/env.ts` | Administrador usado nos testes |

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
