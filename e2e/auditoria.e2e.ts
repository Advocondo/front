import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hojeEmBrasilia } from "../app/lib/dates";
import { createDriver, setDateValue, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { apiToken, createAgreement, createCondominium, createDebtor, createUser, payFirstInstallment, type TestUser } from "./support/seed";

// #72: https://github.com/Advocondo/front/issues/72 (ainda sem história de usuário; critérios propostos na issue)
describe("Trilha de auditoria", () => {
  let driver: WebDriver;
  let operador: TestUser;
  let nomeDoOperador: string;
  let devedor: string;

  async function escolher(selectId: string, texto: string): Promise<void> {
    await (await waitForElement(driver, By.xpath(`//select[@id="${selectId}"]/option[normalize-space()="${texto}"]`))).click();
  }

  beforeAll(async () => {
    driver = await createDriver();
    const carimbo = Date.now();
    nomeDoOperador = `E2E Auditor ${carimbo}`;
    devedor = `E2E Auditado ${carimbo}`;
    operador = await createUser("operator", { name: nomeDoOperador });
    const condominio = await createCondominium(`E2E Auditoria ${carimbo}`);
    const acordo = await createAgreement(condominio.id, (await createDebtor(condominio.id, devedor, "101")).id);
    await payFirstInstallment(acordo.id, hojeEmBrasilia(), operador);
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("CA01 e CA02: o Administrador vê as ações e filtra por autor, tipo e período", async () => {
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
    await visit(driver, "/auditoria");
    await waitForText(driver, "registros");

    // Autor: só a baixa feita pelo operador.
    await escolher("filtro-autor", nomeDoOperador);
    await waitForText(driver, "1 registro");
    await waitForText(driver, `${devedor} · 101`);
    await waitForText(driver, "Baixa da parcela 1");

    // Autor e tipo juntos: o operador não mexeu em usuários.
    await escolher("filtro-tipo", "Usuários");
    await waitForText(driver, "Nenhum registro encontrado");

    // Tipo e período de hoje: o convite do operador, feito pelo Administrador.
    await (await waitForButton(driver, "Limpar filtros")).click();
    await escolher("filtro-tipo", "Usuários");
    const hoje = hojeEmBrasilia();
    await setDateValue(driver, await waitForElement(driver, By.id("filtro-de")), hoje);
    await setDateValue(driver, await waitForElement(driver, By.id("filtro-ate")), hoje);
    const linha = await waitForElement(driver, By.xpath(`//tr[contains(normalize-space(), "${nomeDoOperador}") and contains(normalize-space(), "Convite enviado")]`));
    expect(await linha.getText()).toContain("Admin E2E");
  });

  it("CA03: outro perfil não abre a tela e recebe 403 na API", async () => {
    await openLogin(driver);
    await submitLogin(driver, operador.email, operador.password);
    await waitForPath(driver, "/condominios");
    await visit(driver, "/auditoria");
    await waitForPath(driver, "/condominios");

    const resposta = await fetch(`${env.apiUrl}/audit`, { headers: { Authorization: `Bearer ${await apiToken(operador)}` } });
    expect(resposta.status).toBe(403);
  });
});
