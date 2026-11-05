import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, setDateValue, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createCondominium, type TestCondominium } from "./support/seed";

/** A data daqui a `dias` dias, "2026-11-05". */
const daquiA = (dias: number): string => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

// US23: https://advocondo.github.io/docs/historias/ep03-cadastro-acordos/#us23
describe("Renovação de contrato", () => {
  let driver: WebDriver;
  let perto: TestCondominium;
  let longe: TestCondominium;

  const linha = (nome: string) => By.xpath(`//tr[contains(., "${nome}")]`);

  async function buscar(nome: string): Promise<void> {
    await visit(driver, "/condominios");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar condomínio ou síndico"]'))).sendKeys(nome);
    await waitForText(driver, nome);
  }

  beforeAll(async () => {
    driver = await createDriver();
    const carimbo = Date.now();
    perto = await createCondominium(`E2E Renova Perto ${carimbo}`, { contract_renewal_date: daquiA(30) });
    longe = await createCondominium(`E2E Renova Longe ${carimbo}`, { contract_renewal_date: daquiA(400) });
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("o Painel avisa dos contratos perto da renovação", async () => {
    await visit(driver, "/painel");
    await waitForText(driver, "perto da renovação");
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="Ver condomínios"]'))).click();
    await waitForPath(driver, "/condominios");
  });

  it("US23-CA01: sinaliza só o condomínio perto da renovação", async () => {
    await buscar(perto.name);
    expect(await (await waitForElement(driver, linha(perto.name))).getText()).toMatch(/Renova em \d+ dias/);
    await buscar(longe.name);
    expect(await (await waitForElement(driver, linha(longe.name))).getText()).not.toMatch(/Renova em/);
  });

  it("US23-CA02: registrar a renovação tira o aviso", async () => {
    await buscar(perto.name);
    await (await waitForElement(driver, By.css(`button[aria-label="Registrar renovação de ${perto.name}"]`))).click();
    await setDateValue(driver, await waitForElement(driver, By.id("proxima-renovacao")), daquiA(730));
    await (await waitForButton(driver, "Salvar renovação")).click();
    await waitForText(driver, "registrada com sucesso.");
    await driver.navigate().refresh();
    await buscar(perto.name);
    expect(await (await waitForElement(driver, linha(perto.name))).getText()).not.toMatch(/Renova em/);
  });
});
