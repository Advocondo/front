import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForElement, waitForPath } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { ensureAdmin } from "./support/seed";

// Teste de fumaça. A tela ainda não fala com a API atual (issue #12), então aqui não
// há verificação de dados: só a navegação e a casca da plataforma.
describe("Condomínios", () => {
  let driver: WebDriver;

  beforeAll(async () => {
    await ensureAdmin();
    driver = await createDriver();
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/condominios");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("com sessão, a home redireciona para a tela de condomínios", async () => {
    await visit(driver, "/");
    await waitForPath(driver, "/condominios");
  });

  it("mostra a barra lateral, o título e a busca", async () => {
    await visit(driver, "/condominios");
    await waitForElement(driver, By.css('input[aria-label="Buscar condomínio ou síndico"]'));

    const texto = await driver.findElement(By.css("body")).getText();
    expect(texto).toContain("Advocondo");
    expect(texto).toContain("Carteira de clientes assessorados");
  });
});
