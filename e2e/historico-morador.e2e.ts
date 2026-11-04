import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForElement, waitForPath, waitForText } from "./support/driver";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, createUser, linkCondominiums, payFirstInstallment, type TestDebtor, type TestUser } from "./support/seed";

// US38: https://advocondo.github.io/docs/historias/ep06-painel-cliente/#us38
describe("Histórico de pagamentos do morador", () => {
  let driver: WebDriver;
  let cliente: TestUser;
  let morador: TestDebtor;
  let deOutroCondominio: TestDebtor;

  const textoDaLinha = async (competencia: string): Promise<string> => (await waitForElement(driver, By.xpath(`//tr[contains(., "${competencia}")]`))).getText();

  beforeAll(async () => {
    driver = await createDriver();
    const carimbo = Date.now();
    const vinculado = await createCondominium(`E2E Histórico ${carimbo}`);
    const outro = await createCondominium(`E2E Histórico Outro ${carimbo}`);
    morador = await createDebtor(vinculado.id, `E2E Morador ${carimbo}`, "101");
    deOutroCondominio = await createDebtor(outro.id, `E2E Morador Outro ${carimbo}`, "201");
    // Três parcelas de R$ 300, vencidas em janeiro, fevereiro e março de 2020; a primeira é paga.
    const { id } = await createAgreement(vinculado.id, morador.id, "2020-01-31");
    await createAgreement(outro.id, deOutroCondominio.id, "2020-01-31");
    await payFirstInstallment(id, "2020-01-31");
    cliente = await createUser("client");
    await linkCondominiums(cliente.id, [vinculado.id]);

    await openLogin(driver);
    await submitLogin(driver, cliente.email, cliente.password);
    await waitForPath(driver, "/painel-cliente");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("o nome do morador no painel leva ao histórico, e dá para voltar", async () => {
    await visit(driver, "/painel-cliente");
    await (await waitForElement(driver, By.xpath(`//a[normalize-space()="${morador.name}"]`))).click();
    await waitForPath(driver, `/painel-cliente/moradores/${morador.id}`);
    await (await waitForElement(driver, By.xpath('//a[contains(normalize-space(), "Voltar ao painel")]'))).click();
    await waitForPath(driver, "/painel-cliente");
  });

  it("US38-CA01: mostra o pago e o em aberto por competência, sem honorários", async () => {
    await visit(driver, `/painel-cliente/moradores/${morador.id}`);
    await waitForText(driver, `${morador.name} · Unidade 101`);

    const janeiro = await textoDaLinha("Janeiro 2020");
    expect(janeiro).toContain("Pago");
    expect(janeiro).toContain("R$ 300,00");
    const fevereiro = await textoDaLinha("Fevereiro 2020");
    expect(fevereiro).toContain("Atrasado");
    expect(fevereiro).toContain("R$ 300,00");

    expect(await driver.findElement(By.css("body")).getText()).not.toMatch(/honor[aá]rio|comiss[aã]o/i);
  });

  it("morador de condomínio não vinculado não abre", async () => {
    await visit(driver, `/painel-cliente/moradores/${deOutroCondominio.id}`);
    await waitForText(driver, "Morador não encontrado");
    expect(await driver.findElement(By.css("body")).getText()).not.toContain(deOutroCondominio.name);
  });
});
