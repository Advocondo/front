import { randomUUID } from "node:crypto";
import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForElement, waitForPath, waitForText } from "../support/driver";
import { env } from "../support/env";
import { openLogin, submitLogin } from "../support/login";

/** Só o que o Administrador abre e lê. Nenhuma destas telas é salva, enviada ou alterada aqui. */
const TELAS = [
  { caminho: "/painel", titulo: "Painel" },
  { caminho: "/acordos", titulo: "Acordos" },
  { caminho: "/acompanhamento", titulo: "Faturas do mês" },
  { caminho: "/metas", titulo: "Metas e comissões" },
  { caminho: "/condominios", titulo: "Condomínios" },
  { caminho: "/devedores", titulo: "Devedores" },
  { caminho: "/usuarios", titulo: "Gestão de usuários" },
  { caminho: "/notificacoes", titulo: "Notificações" },
  { caminho: "/perfil", titulo: "Meu perfil" },
  { caminho: "/institucional", titulo: "Conteúdo institucional" },
  { caminho: "/auditoria", titulo: "Trilha de auditoria" },
];

/**
 * Conferência do ambiente real, só de leitura. O único envio é o do login, que abre uma sessão,
 * encerrada no fim. NUNCA acrescente aqui nada que grave dados ou mande e-mail: ver e2e/README.md.
 */
describe("Produção, só leitura", () => {
  let driver: WebDriver;

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  const textoDaPagina = () => driver.findElement(By.css("body")).getText();

  it("a API responde", async () => {
    const resposta = await fetch(`${env.apiUrl}/landing`);
    expect(resposta.status).toBe(200);
  });

  it("a página inicial abre, com o formulário de contato", async () => {
    await visit(driver, "/");
    await waitForElement(driver, By.id("contato-nome"));
  });

  it("a recuperação de senha abre", async () => {
    await visit(driver, "/recuperar-senha");
    await waitForElement(driver, By.id("recuperar-email"));
  });

  it("sem sessão, a tela interna leva ao login", async () => {
    await openLogin(driver);
    await visit(driver, "/painel");
    await waitForPath(driver, "/login");
  });

  it("um e-mail desconhecido recebe a mensagem genérica, o que prova que o front alcança a API", async () => {
    await openLogin(driver);
    await submitLogin(driver, `e2e-nao-existe-${randomUUID()}@example.com`, randomUUID());
    await waitForText(driver, "E-mail ou senha inválidos.");
  });

  it("o Administrador entra no Painel", async () => {
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  });

  it.each(TELAS)("$titulo abre e carrega os dados", async ({ caminho, titulo }) => {
    await visit(driver, caminho);
    // O botão Sair só existe com sessão. Sem ele, a tela teria ido para o login, onde não há erro para ver.
    await waitForElement(driver, By.css('button[aria-label="Sair"]'));
    expect(new URL(await driver.getCurrentUrl()).pathname).toBe(caminho);
    await waitForText(driver, titulo);
    await driver.wait(async () => !(await textoDaPagina()).includes("Carregando"), 15_000);
    // As telas mostram esta frase quando a API falha: uma lista vazia passa, um erro não.
    expect(await textoDaPagina()).not.toContain("Não foi possível");
  });

  it("Sair encerra a sessão", async () => {
    await visit(driver, "/painel");
    await (await waitForElement(driver, By.css('button[aria-label="Sair"]'))).click();
    await waitForPath(driver, "/login");
    await visit(driver, "/painel");
    await waitForPath(driver, "/login");
  });
});
