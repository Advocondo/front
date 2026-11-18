import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clickFresh, createDriver, visit, waitForElement, waitForPath, waitForText } from "../support/driver";
import { exigirDeProducao } from "../support/env";
import { openLogin, submitLogin } from "../support/login";

exigirDeProducao({
  E2E_CLIENT_EMAIL: process.env.E2E_CLIENT_EMAIL,
  E2E_CLIENT_PASSWORD: process.env.E2E_CLIENT_PASSWORD,
});

const CLIENTE = { email: process.env.E2E_CLIENT_EMAIL ?? "", senha: process.env.E2E_CLIENT_PASSWORD ?? "" };
const INICIO = "/painel-cliente";

/** Telas do escritório: o Cliente não fica nelas e volta para o próprio painel (US10, US16). */
const TELAS_DO_ESCRITORIO = ["/painel", "/condominios", "/acordos", "/acompanhamento", "/usuarios"];

/** O Cliente não vê honorários nem comissões do escritório (US16, US37, US38). */
const DADOS_DO_ESCRITORIO = /honor[aá]rio|comiss[aã]o/i;

const SAIR = By.xpath('//button[contains(normalize-space(), "Sair")]');
const VER_PARCELAS = By.css('button[aria-label^="Ver parcelas de"]');
const MORADOR = By.css('a[href^="/painel-cliente/moradores/"]');

/**
 * Conferência do ambiente real com o login do Cliente, só de leitura. O único envio é o do login, que
 * abre uma sessão, encerrada no fim. NUNCA acrescente aqui nada que grave dados ou mande e-mail.
 * A conta precisa estar vinculada a um condomínio com acordos, senão o painel não tem o que mostrar.
 */
describe("Produção, só leitura — Cliente", () => {
  let driver: WebDriver;

  const textoDaPagina = () => driver.findElement(By.css("body")).getText();

  async function esperarCarregar(): Promise<void> {
    await driver.wait(async () => !(await textoDaPagina()).includes("Carregando"), 15_000);
    expect(await textoDaPagina()).not.toContain("Não foi possível");
  }

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("o Cliente entra no Painel do Cliente", async () => {
    await openLogin(driver);
    await submitLogin(driver, CLIENTE.email, CLIENTE.senha);
    await waitForPath(driver, INICIO);
  });

  it("US37: o painel mostra os acordos do condomínio, sem valores do escritório", async () => {
    await visit(driver, INICIO);
    await waitForText(driver, "Painel do Cliente");
    await esperarCarregar();
    await waitForElement(driver, VER_PARCELAS);
    const texto = await textoDaPagina();
    expect(texto).not.toMatch(/R\$/);
    expect(texto).not.toMatch(DADOS_DO_ESCRITORIO);
  });

  it("as parcelas em aberto de um morador abrem, sem honorários", async () => {
    await visit(driver, INICIO);
    await esperarCarregar();
    await clickFresh(driver, VER_PARCELAS);
    await waitForText(driver, "Parcelas em aberto");
    const dialogo = await (await waitForElement(driver, By.css('[role="dialog"]'))).getText();
    expect(dialogo).not.toMatch(DADOS_DO_ESCRITORIO);
    await clickFresh(driver, By.xpath('//button[normalize-space()="Fechar"]'));
  });

  it("US38: o histórico de pagamentos de um morador abre, sem honorários", async () => {
    await visit(driver, INICIO);
    await esperarCarregar();
    await clickFresh(driver, MORADOR);
    await driver.wait(async () => new URL(await driver.getCurrentUrl()).pathname.startsWith("/painel-cliente/moradores/"), 10_000);
    await waitForText(driver, "Histórico de pagamentos");
    await esperarCarregar();
    expect(await textoDaPagina()).not.toMatch(DADOS_DO_ESCRITORIO);
  });

  it.each(TELAS_DO_ESCRITORIO)("abrir %s volta para o Painel do Cliente", async (caminho) => {
    await visit(driver, caminho);
    await waitForPath(driver, INICIO);
    await waitForText(driver, "Painel do Cliente");
  });

  it("Sair encerra a sessão", async () => {
    await visit(driver, INICIO);
    await clickFresh(driver, SAIR);
    await waitForPath(driver, "/login");
    await visit(driver, INICIO);
    await waitForPath(driver, "/login");
  });
});
