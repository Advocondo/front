import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, visit, waitForElement, waitForPath } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createUser, deactivateUser, ensureAdmin, type TestUser } from "./support/seed";

const ERRO_GENERICO = "E-mail ou senha inválidos.";

// US02: https://advocondo.github.io/docs/historias/ep01-portal-autenticacao/#us02
describe("Login", () => {
  let driver: WebDriver;
  let operator: TestUser;
  let client: TestUser;
  let inativo: TestUser;

  async function erroMostrado(): Promise<string> {
    return (await waitForElement(driver, By.css('[role="alert"]'))).getText();
  }

  beforeAll(async () => {
    await ensureAdmin();
    operator = await createUser("operator");
    client = await createUser("client");
    inativo = await createUser("operator");
    await deactivateUser(inativo.id);
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await openLogin(driver);
  });

  describe("US02-CA01: redireciona para o painel do perfil", () => {
    it("Administrador vai para condomínios", async () => {
      await submitLogin(driver, env.adminEmail, env.adminPassword);
      await waitForPath(driver, "/condominios");
    });

    it("Equipe Operacional vai para condomínios", async () => {
      await submitLogin(driver, operator.email, operator.password);
      await waitForPath(driver, "/condominios");
    });

    it("Cliente vai para o painel do cliente", async () => {
      await submitLogin(driver, client.email, client.password);
      await waitForPath(driver, "/painel-cliente");
    });
  });

  describe("US02-CA02: credenciais inválidas têm mensagem genérica", () => {
    it("senha errada mostra o erro e continua no login", async () => {
      await submitLogin(driver, operator.email, "senha-errada-123");
      expect(await erroMostrado()).toContain(ERRO_GENERICO);
      expect(new URL(await driver.getCurrentUrl()).pathname).toBe("/login");
    });

    it("e-mail desconhecido mostra a mesma mensagem", async () => {
      await submitLogin(driver, "ninguem@example.com", "senha-errada-123");
      expect(await erroMostrado()).toContain(ERRO_GENERICO);
    });
  });

  it("US02-CA03: usuário inativo não entra, mesmo com a senha correta", async () => {
    await submitLogin(driver, inativo.email, inativo.password);
    expect(await erroMostrado()).toContain(ERRO_GENERICO);
    expect(new URL(await driver.getCurrentUrl()).pathname).toBe("/login");
  });

  describe("acesso às telas", () => {
    it("sem sessão, a tela interna leva ao login", async () => {
      await visit(driver, "/condominios");
      await waitForPath(driver, "/login");
    });

    it("Cliente não fica em tela do escritório", async () => {
      await submitLogin(driver, client.email, client.password);
      await waitForPath(driver, "/painel-cliente");
      await visit(driver, "/condominios");
      await waitForPath(driver, "/painel-cliente");
    });

    it("a sessão continua depois de recarregar a página", async () => {
      await submitLogin(driver, operator.email, operator.password);
      await waitForPath(driver, "/condominios");
      await driver.navigate().refresh();
      await waitForElement(driver, By.css('button[aria-label="Sair"]'));
    });

    it("Sair encerra a sessão", async () => {
      await submitLogin(driver, operator.email, operator.password);
      await waitForPath(driver, "/condominios");
      await (await waitForElement(driver, By.css('button[aria-label="Sair"]'))).click();
      await waitForPath(driver, "/login");
      await visit(driver, "/condominios");
      await waitForPath(driver, "/login");
    });
  });
});
