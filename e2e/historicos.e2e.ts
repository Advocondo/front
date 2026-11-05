import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, createUser, deactivateUser, payFirstInstallment, type TestUser } from "./support/seed";

// US31 e US11: https://advocondo.github.io/docs/historias/ep04-parcelas/#us31
describe("Históricos para o Administrador", () => {
  let driver: WebDriver;
  let acordo: string;
  let operador: TestUser;
  let inativado: TestUser;

  async function entrar(email: string, senha: string, destino: string): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, email, senha);
    await waitForPath(driver, destino);
  }

  beforeAll(async () => {
    driver = await createDriver();
    const condominio = await createCondominium(`E2E Histórico ${Date.now()}`);
    const devedor = await createDebtor(condominio.id, `E2E Histórico ${Date.now()}`, "101");
    acordo = (await createAgreement(condominio.id, devedor.id)).id;
    await payFirstInstallment(acordo, "2030-01-31");
    operador = await createUser("operator");
    inativado = await createUser("operator");
    await deactivateUser(inativado.id);
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("US31-CA01: o acordo mostra quem deu baixa, quando e o valor", async () => {
    await entrar(env.adminEmail, env.adminPassword, "/painel");
    await visit(driver, `/acordos/${acordo}`);
    await waitForText(driver, "Histórico financeiro");
    const linha = await (await waitForElement(driver, By.xpath('//tr[contains(., "Baixa da parcela 1")]'))).getText();
    expect(linha).toContain("Admin E2E");
    expect(linha).toContain("+ R$ 300,00");
  });

  it("US11-CA01: o usuário mostra o convite e a inativação, com o autor", async () => {
    await entrar(env.adminEmail, env.adminPassword, "/painel");
    await visit(driver, "/usuarios");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar por nome ou e-mail"]'))).sendKeys(inativado.email);
    await waitForText(driver, inativado.email);
    await (await waitForElement(driver, By.css('button[aria-label^="Ver histórico de"]'))).click();
    await waitForText(driver, "Histórico de acesso");
    await waitForText(driver, "Convite enviado");
    await waitForText(driver, "De Ativo para Inativo");
    await waitForText(driver, "por Admin E2E");
  });

  it("US31-CA02: a Equipe Operacional não vê o histórico financeiro", async () => {
    await entrar(operador.email, operador.password, "/condominios");
    await visit(driver, `/acordos/${acordo}`);
    await waitForText(driver, "Detalhes do acordo");
    await waitForText(driver, "1/3");
    expect(await driver.findElement(By.css("body")).getText()).not.toContain("Histórico financeiro");
  });

  it("US11-CA02: a Equipe Operacional não abre a gestão de usuários", async () => {
    await entrar(operador.email, operador.password, "/condominios");
    await visit(driver, "/usuarios");
    await waitForPath(driver, "/condominios");
  });
});
