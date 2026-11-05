import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { apiToken, createAgreement, createCondominium, createDebtor, createUser, runOverdueNotifications, type TestDebtor, type TestUser } from "./support/seed";

// US30: https://advocondo.github.io/docs/historias/ep04-parcelas/#us30
describe("Notificações de parcela em atraso", () => {
  let driver: WebDriver;
  let devedor: TestDebtor;
  let semAcordos: TestUser;

  const notificacao = (nome: string) => By.xpath(`//button[contains(., "Parcela em atraso") and contains(., "${nome}")]`);

  beforeAll(async () => {
    driver = await createDriver();
    const condominio = await createCondominium(`E2E Notificação ${Date.now()}`);
    devedor = await createDebtor(condominio.id, `E2E Notificado ${Date.now()}`, "101");
    await createAgreement(condominio.id, devedor.id, "2020-01-31");
    semAcordos = await createUser("operator");
    // A situação "Atrasado" é calculada: quem cria as notificações é o comando diário.
    await runOverdueNotifications();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("CA01: o Administrador vê a notificação da parcela, e o sino leva até ela", async () => {
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
    await (await waitForElement(driver, By.css('a[href="/notificacoes"]'))).click();
    await waitForPath(driver, "/notificacoes");
    const texto = await (await waitForElement(driver, notificacao(devedor.name))).getText();
    expect(texto).toContain("venceu em 31/01/2020");
    expect(texto).toContain("falta R$ 300,00");
  });

  it("CA02: clicar leva à fatura", async () => {
    await visit(driver, "/notificacoes");
    await (await waitForElement(driver, notificacao(devedor.name))).click();
    await waitForText(driver, "Parcela 1");
    expect(new URL(await driver.getCurrentUrl()).pathname).toMatch(/^\/faturas\//);
    await waitForText(driver, devedor.name);
  });

  it("marcar todas zera a contagem", async () => {
    await visit(driver, "/notificacoes");
    await waitForElement(driver, notificacao(devedor.name));
    const marcar = await driver.findElements(By.xpath('//button[normalize-space()="Marcar todas como lidas"]'));
    if (marcar.length > 0) await (await waitForButton(driver, "Marcar todas como lidas")).click();
    await waitForText(driver, "0 não lidas");
    await waitForElement(driver, By.css('a[aria-label="Notificações"]'));
  });

  it("quem não é responsável pelo acordo não recebe a notificação", async () => {
    const resposta = await fetch(`${env.apiUrl}/notifications`, { headers: { Authorization: `Bearer ${await apiToken(semAcordos)}` } });
    expect(((await resposta.json()) as { notifications: unknown[] }).notifications).toHaveLength(0);
  });
});
