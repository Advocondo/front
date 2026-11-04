import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { apiToken, createAgreement, createCondominium, createDebtor, createUser, type TestCondominium, type TestUser } from "./support/seed";

// US10: https://advocondo.github.io/docs/historias/ep02-usuarios-perfis/#us10
describe("Vincular Cliente a condomínios", () => {
  let driver: WebDriver;
  let cliente: TestUser;
  let vinculado: TestCondominium;
  let acordoVinculado: string;
  let acordoDeOutro: string;
  let sequencia = 0;

  /** O painel do Cliente é a US37. Até lá, a regra é conferida na rota que ele vai usar. */
  async function acordosVistosPeloCliente(): Promise<string[]> {
    const resposta = await fetch(`${env.apiUrl}/client-panel/agreements`, { headers: { Authorization: `Bearer ${await apiToken(cliente)}` } });
    expect(resposta.status).toBe(200);
    return ((await resposta.json()) as { id: string }[]).map((acordo) => acordo.id);
  }

  async function novoAcordo(condominioId: string): Promise<string> {
    sequencia += 1;
    const devedor = await createDebtor(condominioId, `E2E Vínculo ${Date.now()}-${sequencia}`, String(sequencia));
    return (await createAgreement(condominioId, devedor.id)).id;
  }

  async function abrirDialogo(): Promise<void> {
    await visit(driver, "/usuarios");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar por nome ou e-mail"]'))).sendKeys(cliente.email);
    await waitForText(driver, cliente.email);
    await (await waitForElement(driver, By.css('button[aria-label^="Vincular condomínios de"]'))).click();
    await waitForText(driver, "Condomínios vinculados");
  }

  async function alternarCondominio(nome: string): Promise<void> {
    await (await waitForElement(driver, By.css('input[aria-label="Filtrar condomínios por nome"]'))).sendKeys(nome);
    await (await waitForElement(driver, By.xpath(`//label[contains(normalize-space(), "${nome}")]`))).click();
  }

  async function salvar(): Promise<void> {
    await (await waitForButton(driver, "Salvar vínculos")).click();
    await waitForText(driver, "atualizados.");
  }

  beforeAll(async () => {
    driver = await createDriver();
    const carimbo = Date.now();
    vinculado = await createCondominium(`E2E Vinculado ${carimbo}`);
    const outro = await createCondominium(`E2E Sem Vínculo ${carimbo}`);
    acordoVinculado = await novoAcordo(vinculado.id);
    acordoDeOutro = await novoAcordo(outro.id);
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    cliente = await createUser("client");
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  });

  it("US10-CA02: sem vínculo, o Cliente não vê nenhum acordo", async () => {
    expect(await acordosVistosPeloCliente()).toEqual([]);
  });

  it("US10-CA01: o Cliente vê só os acordos do condomínio marcado", async () => {
    await abrirDialogo();
    await alternarCondominio(vinculado.name);
    await salvar();

    const vistos = await acordosVistosPeloCliente();
    expect(vistos).toContain(acordoVinculado);
    expect(vistos).not.toContain(acordoDeOutro);
  });

  it("o vínculo salvo volta marcado, e desmarcar tira o acesso", async () => {
    await abrirDialogo();
    await alternarCondominio(vinculado.name);
    await salvar();

    await abrirDialogo();
    await waitForText(driver, "1 condomínio marcado");
    await alternarCondominio(vinculado.name);
    await salvar();

    expect(await acordosVistosPeloCliente()).toEqual([]);
  });

  it("a ação só aparece para o perfil Cliente", async () => {
    const operador = await createUser("operator");
    await visit(driver, "/usuarios");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar por nome ou e-mail"]'))).sendKeys(operador.email);
    await waitForText(driver, operador.email);
    expect(await driver.findElements(By.css('button[aria-label^="Vincular condomínios de"]'))).toHaveLength(0);
  });
});
