import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForElement, waitForPath, waitForText } from "../support/driver";
import { exigirDeProducao } from "../support/env";
import { openLogin, submitLogin } from "../support/login";

exigirDeProducao({
  E2E_OPERATOR_EMAIL: process.env.E2E_OPERATOR_EMAIL,
  E2E_OPERATOR_PASSWORD: process.env.E2E_OPERATOR_PASSWORD,
});

const OPERADOR = { email: process.env.E2E_OPERATOR_EMAIL ?? "", senha: process.env.E2E_OPERATOR_PASSWORD ?? "" };
const INICIO = "/condominios";

/** O que a Equipe Operacional abre e lê. Nenhuma destas telas é salva, enviada ou alterada aqui. */
const TELAS = [
  { caminho: "/condominios", titulo: "Condomínios" },
  { caminho: "/acordos", titulo: "Acordos" },
  { caminho: "/acompanhamento", titulo: "Faturas do mês" },
  { caminho: "/devedores", titulo: "Devedores" },
  { caminho: "/metas", titulo: "Metas e comissões" },
  { caminho: "/notificacoes", titulo: "Notificações" },
  { caminho: "/perfil", titulo: "Meu perfil" },
];

/** As telas exclusivas do Administrador: o menu não as mostra e o endereço volta para o início. */
const TELAS_DO_ADMINISTRADOR = [
  { caminho: "/painel", item: "Painel" },
  { caminho: "/usuarios", item: "Gestão de usuários" },
  { caminho: "/auditoria", item: "Trilha de auditoria" },
  { caminho: "/institucional", item: "Conteúdo institucional" },
];

const SAIR = By.css('button[aria-label="Sair"]');

/**
 * Conferência do ambiente real com o login da Equipe Operacional, só de leitura. O único envio é o do
 * login, que abre uma sessão, encerrada no fim. NUNCA acrescente aqui nada que grave dados ou mande e-mail.
 */
describe("Produção, só leitura — Equipe Operacional", () => {
  let driver: WebDriver;

  const textoDaPagina = () => driver.findElement(By.css("body")).getText();

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("a Equipe Operacional entra em Condomínios", async () => {
    await openLogin(driver);
    await submitLogin(driver, OPERADOR.email, OPERADOR.senha);
    await waitForPath(driver, INICIO);
  });

  it.each(TELAS_DO_ADMINISTRADOR)("o menu não mostra $item", async ({ item }) => {
    await visit(driver, INICIO);
    await waitForElement(driver, SAIR);
    expect(await driver.findElements(By.xpath(`//nav//*[normalize-space()="${item}"]`))).toHaveLength(0);
  });

  it.each(TELAS)("$titulo abre e carrega os dados", async ({ caminho, titulo }) => {
    await visit(driver, caminho);
    // O botão Sair só existe com sessão. Sem ele, a tela teria ido para o login, onde não há erro para ver.
    await waitForElement(driver, SAIR);
    expect(new URL(await driver.getCurrentUrl()).pathname).toBe(caminho);
    await waitForText(driver, titulo);
    await driver.wait(async () => !(await textoDaPagina()).includes("Carregando"), 15_000);
    // As telas mostram esta frase quando a API falha: uma lista vazia passa, um erro não.
    expect(await textoDaPagina()).not.toContain("Não foi possível");
  });

  it.each(TELAS_DO_ADMINISTRADOR)("abrir $caminho volta para Condomínios", async ({ caminho }) => {
    await visit(driver, caminho);
    await waitForElement(driver, SAIR);
    await waitForPath(driver, INICIO);
  });

  it("Sair encerra a sessão", async () => {
    await visit(driver, INICIO);
    await (await waitForElement(driver, SAIR)).click();
    await waitForPath(driver, "/login");
    await visit(driver, INICIO);
    await waitForPath(driver, "/login");
  });
});
