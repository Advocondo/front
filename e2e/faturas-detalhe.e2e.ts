import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForElement, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { cancelAgreement, createAgreement, createCondominium, createDebtor, createUser, linkCondominiums, payFirstInstallment, type TestCondominium, type TestDebtor, type TestUser } from "./support/seed";

// #47: https://github.com/Advocondo/front/issues/47
describe("Detalhe de fatura e faturas do acordo para o Cliente", () => {
  let driver: WebDriver;
  let condominio: TestCondominium;
  let morador: TestDebtor;
  let acordo: string;
  let cliente: TestUser;

  async function entrar(email: string, senha: string, destino: string): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, email, senha);
    await waitForPath(driver, destino);
  }

  beforeAll(async () => {
    driver = await createDriver();
    const carimbo = Date.now();
    condominio = await createCondominium(`E2E Fatura ${carimbo}`);
    morador = await createDebtor(condominio.id, `E2E Fatura Morador ${carimbo}`, "101");
    // Três parcelas de R$ 300 com 10% de honorários, vencidas em 2020; a primeira é paga.
    acordo = (await createAgreement(condominio.id, morador.id, "2020-01-31")).id;
    await payFirstInstallment(acordo, "2020-01-31");
    cliente = await createUser("client");
    await linkCondominiums(cliente.id, [condominio.id]);
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("CA01: do acordo, o escritório abre a fatura, com a divisão e a quem pertence", async () => {
    await entrar(env.adminEmail, env.adminPassword, "/painel");
    await visit(driver, `/acordos/${acordo}`);
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="2/3"]'))).click();
    await waitForText(driver, "Parcela 2");

    const pagina = await driver.findElement(By.css("body")).getText();
    expect(pagina).toContain("R$ 270,00");
    expect(pagina).toContain("R$ 30,00");
    expect(pagina).toContain(morador.name);
    expect(pagina).toContain(condominio.name);
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="Ver acordo"]'))).click();
    await waitForPath(driver, `/acordos/${acordo}`);
  });

  it("um endereço sem fatura explica que ela não existe", async () => {
    await visit(driver, "/faturas/00000000-0000-0000-0000-000000000000");
    await waitForText(driver, "Fatura não encontrada");
  });

  it("CA02 e CA03: o Cliente vê as parcelas em aberto, sem honorários, até o acordo ser cancelado", async () => {
    await entrar(cliente.email, cliente.password, "/painel-cliente");
    await (await waitForElement(driver, By.css(`button[aria-label="Ver parcelas de ${morador.name}"]`))).click();
    await waitForText(driver, "Parcelas em aberto");
    await waitForElement(driver, By.css('[role="dialog"] table tbody tr'));

    const dialogo = await (await waitForElement(driver, By.css('[role="dialog"]'))).getText();
    expect(dialogo).toContain("R$ 300,00");
    expect(dialogo).toContain("Atrasada");
    expect(dialogo).not.toContain("Paga");
    expect(dialogo).not.toContain("R$ 30,00");
    expect(dialogo).not.toMatch(/honor[aá]rio|comiss[aã]o/i);

    await cancelAgreement(acordo);
    await visit(driver, "/painel-cliente");
    await waitForTextGone(driver, morador.name);
  });
});
