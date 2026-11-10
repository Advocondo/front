# Testes E2E

Testes de ponta a ponta com [Selenium](https://www.selenium.dev/documentation/webdriver/), escritos em TypeScript e executados pelo Vitest. Eles abrem um navegador de verdade e usam o front como um usuário.

**Não rodam no CI.** O passo `npm run test` do CI só coleta `*.test.ts(x)`, e estes arquivos terminam em `.e2e.ts`. Como precisam do front, do back e de um banco no ar, são executados manualmente. O CI ainda passa `eslint` e `tsc` neles, então erros de compilação aparecem no PR.

## Pré-requisitos

- Node 22 e `npm install` feito.
- Chrome ou Firefox instalado. O Selenium Manager baixa o driver na primeira execução, então é preciso ter internet.
- Docker, para o back. Nunca use dados de produção na suíte comum.

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

O token e o banco vazio são usados só na primeira execução, para criar o Administrador de teste por `POST /setup`, antes de qualquer arquivo de teste. Nas seguintes, os testes entram com esse mesmo usuário. Se o banco já tiver outros usuários, informe um Administrador existente em `E2E_ADMIN_EMAIL` e `E2E_ADMIN_PASSWORD`.

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

Deixe `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` vazias: com `ENVIRONMENT=local`, o back aceita o formulário de contato sem captcha, e o e-mail vai para o log em vez de sair de verdade.

Para rodar contra um back em outro projeto do Compose, sem mexer no `.env`, defina `COMPOSE_PROJECT_NAME` e `COMPOSE_FILE`: os testes herdam as duas variáveis ao ler os logs.

Os usuários de teste são criados pelo fluxo real de convite. Sem SMTP, o back escreve o e-mail no log, e os testes leem o link com `docker compose logs api`. Por isso o back precisa estar no Compose, com `SMTP_HOST` vazio. Cada execução cria usuários novos no banco local.

## Variáveis de ambiente

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3000` | Endereço do front. Em `npm run test:e2e`, só aceita `localhost`, `127.0.0.1` ou `[::1]`: qualquer outro host interrompe a execução. Em `npm run test:e2e:prod`, é obrigatória |
| `E2E_BROWSER` | `chrome` | `chrome` ou `firefox` |
| `E2E_HEADLESS` | ligado | `false` abre a janela do navegador |
| `E2E_API_URL` | `http://localhost:8000` | Endereço da API. Mesma regra de `E2E_BASE_URL` |
| `E2E_DELAY_MS` | `1000`, ou `0` com `CI` definida | Pausa, em milissegundos, antes de cada ação no navegador |
| `E2E_BACK_DIR` | `../back` | Pasta do repositório `back`, de onde os testes leem os logs |
| `E2E_SETUP_TOKEN` | vazio | Valor de `SETUP_TOKEN` do back. Necessário só para criar o primeiro Administrador |
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | valores de teste em `support/env.ts` | Administrador usado nos testes. Em `npm run test:e2e:prod`, são obrigatórios |

Com o `.next` recém-apagado, o servidor de desenvolvimento compila cada rota na primeira visita, e um teste pode estourar a espera de 10 segundos. Se a primeira execução falhar por tempo limite, rode de novo antes de investigar.

## Velocidade

Antes de abrir uma página, clicar ou digitar, os testes esperam `E2E_DELAY_MS` milissegundos, para dar tempo de acompanhar pela tela:

```bash
E2E_HEADLESS=false npm run test:e2e                # 1 segundo por ação, o padrão
E2E_DELAY_MS=300 npm run test:e2e                  # mais rápido
E2E_DELAY_MS=0 npm run test:e2e                    # sem pausa
```

Com a variável `CI` definida, o padrão passa a ser 0, mas `E2E_DELAY_MS` continua valendo. Os tempos limite dos testes crescem junto, então uma pausa maior não causa falha por tempo. Um clique feito por script não pausa.

## Produção

`npm run test:e2e:prod` confere o ambiente real, da sua máquina. Ele roda só `e2e/producao/`, uma suíte **de leitura**:

```bash
export E2E_BASE_URL=https://endereco-do-front
export E2E_API_URL=https://endereco-da-api
export E2E_ADMIN_EMAIL=seu-email-de-administrador
read -rs E2E_ADMIN_PASSWORD && export E2E_ADMIN_PASSWORD    # não fica no histórico do terminal
npm run test:e2e:prod
```

O que ele confere: a API responde, a página inicial e a recuperação de senha abrem, o login recusa um e-mail desconhecido e aceita o Administrador, cada tela interna carrega os dados sem erro, e Sair encerra a sessão. Isso também prova que `NEXT_PUBLIC_API_URL` e o CORS estão certos.

O que ele faz em produção: abre uma sessão com o seu login, encerrada no fim, e tenta um login com um e-mail inexistente. Não grava mais nada nem manda e-mail. Use um Administrador: as outras contas não abrem todas as telas.

**A suíte comum não roda em produção, de propósito.** `npm run test:e2e` aceita só endereços locais, mesmo com `E2E_TARGET` definida, porque:

- ela cria condomínios, devedores, acordos e usuários, e parte disso não tem como apagar, como os documentos;
- ela manda e-mails de verdade: convites e avisos aos Clientes;
- ela lê os links de convite com `docker compose logs`, que só existem no ambiente local.

Ao acrescentar um teste em `e2e/producao/`, mantenha a regra: nada que grave dados ou mande e-mail. `support/seed.ts` recusa ser usado nessa suíte.

## Monitoramento

`e2e/monitoramento.e2e.ts` confere o envio de erros sem usar o Sentry de verdade. Sem configuração, ele prova que nada sai. Para conferir o envio, suba o front apontando para um servidor falso, que o próprio teste abre:

```bash
NEXT_PUBLIC_SENTRY_DSN=http://chave@localhost:9999/1 npm run dev
E2E_SENTRY_PORTA=9999 npm run test:e2e -- e2e/monitoramento.e2e.ts
```

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
- Use as esperas de `support/driver.ts`, nunca um tempo fixo. Depois de uma busca, use `waitForFilteredRows`: o termo já aparecia na lista completa, então ver o termo não prova que ela filtrou.
- Datas de hoje vêm de `hojeEmBrasilia()`, como no back. Em UTC, a suíte falha toda noite.
- Cada arquivo abre o próprio navegador. Os arquivos rodam um de cada vez.
- Uma tela nova entra também na lista `TELAS` de `e2e/producao/producao.e2e.ts`, se abrir sem parâmetros.
- Para testar no celular, use `createDriver({ celular: true })`: o Chrome emula uma tela de 390×844, como os protótipos mobile. Mudar o tamanho da janela não basta, porque o Chrome sem janela não fica mais estreito que 500px. Uma tela nova do escritório entra na lista de `e2e/mobile.e2e.ts`, que confere que ela abre sem rolagem horizontal.
