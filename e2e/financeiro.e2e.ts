import { By, type WebDriver } from "selenium-webdriver";
import { hojeEmBrasilia } from "../app/lib/dates";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { apiToken, createAgreement, createCondominium, createDebtor, createUser, payFirstInstallment, type TestUser } from "./support/seed";

// US29, US35 e US33: https://advocondo.github.io/docs/historias/ep04-parcelas/#us29
describe("Nota fiscal, exportação e visão consolidada", () => {
  let driver: WebDriver;
  let devedor: string;
  let operador: TestUser;

  beforeAll(async () => {
    driver = await createDriver();
    const carimbo = Date.now();
    const condominio = await createCondominium(`E2E Financeiro ${carimbo}`);
    devedor = `E2E Sem Nota ${carimbo}`;
    const { id: devedorId } = await createDebtor(condominio.id, devedor, "101");
    // A parcela vence no mês atual, para aparecer em Faturas do mês.
    const { id } = await createAgreement(condominio.id, devedorId, hojeEmBrasilia());
    await payFirstInstallment(id, hojeEmBrasilia());
    operador = await createUser("operator");
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("US29-CA02: a parcela paga sem nota aparece nas pendências", async () => {
    await visit(driver, "/acompanhamento");
    await waitForText(driver, devedor);
    expect(await (await waitForElement(driver, By.xpath(`//tr[contains(., "${devedor}")]`))).getText()).toContain("Sem nota fiscal");
    await (await waitForButton(driver, "Todas as pendências de nota")).click();
    await waitForText(driver, `${devedor} · parcela 1`);
  });

  it("US29-CA01: registrar a nota a vincula à parcela e a tira das pendências", async () => {
    await visit(driver, "/acompanhamento");
    await (await waitForElement(driver, By.css(`button[aria-label="Registrar a nota da parcela 1 de ${devedor}"]`))).click();
    await (await waitForElement(driver, By.id("nota-numero"))).sendKeys("000124");
    await (await waitForButton(driver, "Salvar nota fiscal")).click();
    await waitForText(driver, "Nota fiscal registrada com sucesso.");
    await waitForText(driver, "NF 000124");

    const resposta = await fetch(`${env.apiUrl}/installments/paid-without-invoice?limit=200`, { headers: { Authorization: `Bearer ${await apiToken(operador)}` } });
    const nomes = ((await resposta.json()) as { debtor: { name: string } }[]).map((p) => p.debtor.name);
    expect(nomes).not.toContain(devedor);
  });

  it("US35: o Administrador exporta um .xlsx", async () => {
    await visit(driver, "/acompanhamento");
    await waitForText(driver, devedor);
    await driver.executeScript(`
      window.__arquivos = [];
      const original = URL.createObjectURL;
      URL.createObjectURL = (arquivo) => { window.__arquivos.push(arquivo.size); return original.call(URL, arquivo); };
    `);
    await (await waitForButton(driver, "Exportar planilha")).click();
    await driver.wait(async () => (await driver.executeScript<number[]>("return window.__arquivos")).length === 1, 10_000);
    expect((await driver.executeScript<number[]>("return window.__arquivos"))[0]).toBeGreaterThan(0);
  });

  it("US33-CA01: Metas mostra o faturamento e as comissões da equipe", async () => {
    await visit(driver, "/metas");
    await waitForText(driver, "Faturamento do mês");
    await waitForText(driver, "Comissões da equipe");
  });

  it("US33-CA02 e US35: a Equipe Operacional não vê nem exporta", async () => {
    await openLogin(driver);
    await submitLogin(driver, operador.email, operador.password);
    await waitForPath(driver, "/condominios");
    await visit(driver, "/metas");
    await waitForText(driver, "Sem meta neste mês");
    expect(await driver.findElement(By.css("body")).getText()).not.toContain("Comissões da equipe");

    await visit(driver, "/acompanhamento");
    await waitForText(driver, "Faturas do mês");
    expect(await driver.findElements(By.xpath('//button[normalize-space()="Exportar planilha"]'))).toHaveLength(0);
    const [ano, mes] = hojeEmBrasilia().split("-").map(Number);
    const resposta = await fetch(`${env.apiUrl}/admin-panel/reports/export?year=${ano}&month=${mes}`, { headers: { Authorization: `Bearer ${await apiToken(operador)}` } });
    expect(resposta.status).toBe(403);
  });
});
