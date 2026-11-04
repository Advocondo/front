import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hojeEmBrasilia } from "../app/lib/dates";
import { createDriver, visit, waitForElement, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, createUser, payFirstInstallment, type TestUser } from "./support/seed";


// US34: https://advocondo.github.io/docs/historias/ep05-comissoes-metas/#us34
describe("Painel de indicadores", () => {
  let driver: WebDriver;
  let operador: TestUser;

  beforeAll(async () => {
    driver = await createDriver();
    operador = await createUser("operator");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  async function entrarComoAdmin(): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  }

  it("o Administrador entra no Painel e vê os três indicadores", async () => {
    await entrarComoAdmin();
    await waitForText(driver, "Acordos ativos");
    await waitForText(driver, "Inadimplência do mês");
    await waitForText(driver, "Comissões pagas no período");
  });

  it("US34-CA01: uma baixa nova aparece ao atualizar", async () => {
    const condominio = await createCondominium(`E2E Painel ${Date.now()}`);
    const devedor = await createDebtor(condominio.id, `E2E Painel ${Date.now()}`, "1");
    const { id } = await createAgreement(condominio.id, devedor.id);
    await entrarComoAdmin();
    const valor = async (): Promise<string> => (await waitForElement(driver, By.xpath('//*[normalize-space()="Comissões pagas no período"]/ancestor::*[contains(., "R$")][1]'))).getText();
    const antes = await valor();

    // O acordo cobra 10% de honorários sobre R$ 900 em 3 parcelas: a baixa soma R$ 30.
    await payFirstInstallment(id, hojeEmBrasilia());
    await (await waitForElement(driver, By.xpath('//button[normalize-space()="Atualizar"]'))).click();
    await driver.wait(async () => (await valor()) !== antes, 10_000);
  });

  it("US34-CA02: trocar o mês muda o período mostrado", async () => {
    await entrarComoAdmin();
    await waitForText(driver, "Acordos ativos");
    const titulo = await (await waitForElement(driver, By.css("main h2"))).getText();
    await (await waitForElement(driver, By.css('button[aria-label="Próximo mês"]'))).click();
    await waitForTextGone(driver, titulo);
    await waitForText(driver, "Inadimplência do mês");
  });

  it("a Equipe Operacional não abre o Painel nem vê o item no menu", async () => {
    await openLogin(driver);
    await submitLogin(driver, operador.email, operador.password);
    await waitForPath(driver, "/condominios");
    await visit(driver, "/painel");
    await waitForPath(driver, "/condominios");
    expect(await driver.findElements(By.xpath('//nav//button[contains(normalize-space(), "Painel")]'))).toHaveLength(0);
  });
});
