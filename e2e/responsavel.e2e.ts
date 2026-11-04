import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, createLawyer, createUser, type TestLawyer, type TestUser } from "./support/seed";

// US18: https://advocondo.github.io/docs/historias/ep03-cadastro-acordos/#us18
describe("Advogado responsável", () => {
  let driver: WebDriver;
  let primeiro: TestLawyer;
  let segundo: TestLawyer;
  let semOab: TestUser;
  let condominioId: string;
  let sequencia = 0;

  /** Cria um acordo sem responsável e devolve o id e o nome do devedor. */
  async function novoAcordo(): Promise<{ id: string; devedor: string }> {
    sequencia += 1;
    const nome = `E2E Responsavel ${Date.now()}${sequencia}`;
    const devedor = await createDebtor(condominioId, nome, `Unidade ${Date.now()}${sequencia}`);
    const { id } = await createAgreement(condominioId, devedor.id);
    return { id, devedor: nome };
  }

  async function entrarComoAdmin(): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  }

  async function abrirDialogo(botao: string): Promise<void> {
    await (await waitForButton(driver, botao)).click();
    await waitForElement(driver, By.id("responsavel-advogado"));
  }

  async function escolherESalvar(advogado: TestLawyer): Promise<void> {
    await (await waitForElement(driver, By.css(`#responsavel-advogado option[value="${advogado.id}"]`))).click();
    await (await waitForButton(driver, "Salvar responsável")).click();
    await waitForText(driver, `Responsável: ${advogado.name}`);
  }

  beforeAll(async () => {
    condominioId = (await createCondominium(`E2E Responsavel ${Date.now()}`)).id;
    primeiro = await createLawyer(`E2E Primeira ${Date.now()}`);
    segundo = await createLawyer(`E2E Segundo ${Date.now()}`);
    semOab = await createUser("operator");
    driver = await createDriver();
    await entrarComoAdmin();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("US18-CA01: a lista mostra só advogados com OAB", async () => {
    const { id } = await novoAcordo();
    await visit(driver, `/acordos/${id}`);
    await abrirDialogo("Atribuir responsável");

    await waitForElement(driver, By.css(`#responsavel-advogado option[value="${primeiro.id}"]`));
    const naoAdvogado = await driver.findElements(By.css(`#responsavel-advogado option[value="${semOab.id}"]`));
    expect(naoAdvogado).toHaveLength(0);
  });

  it("US18-CA02: reatribui e mantém o histórico de quem era, quem passou a ser e quando", async () => {
    const { id } = await novoAcordo();
    await visit(driver, `/acordos/${id}`);
    await waitForText(driver, "Nenhuma atribuição ainda.");

    await abrirDialogo("Atribuir responsável");
    await escolherESalvar(primeiro);
    await waitForText(driver, `Atribuído a ${primeiro.name}`);

    await abrirDialogo("Trocar responsável");
    await escolherESalvar(segundo);
    await waitForText(driver, `De ${primeiro.name} para ${segundo.name}`);

    await driver.navigate().refresh();
    await waitForText(driver, `De ${primeiro.name} para ${segundo.name}`);
    await waitForText(driver, `Atribuído a ${primeiro.name}`);
    await waitForText(driver, "por Admin E2E");
  });

  it("filtra a lista por responsável", async () => {
    const dele = await novoAcordo();
    const outro = await novoAcordo();
    await visit(driver, `/acordos/${dele.id}`);
    await abrirDialogo("Atribuir responsável");
    await escolherESalvar(segundo);

    await visit(driver, "/acordos");
    await waitForText(driver, outro.devedor);
    await (await waitForElement(driver, By.css(`#filtro-responsavel option[value="${segundo.id}"]`))).click();
    await waitForTextGone(driver, outro.devedor);
    await waitForText(driver, dele.devedor);
  });

  it("US18-CA03: o advogado vê os acordos sob sua responsabilidade", async () => {
    const dele = await novoAcordo();
    const outro = await novoAcordo();
    await visit(driver, `/acordos/${dele.id}`);
    await abrirDialogo("Atribuir responsável");
    await escolherESalvar(primeiro);

    await openLogin(driver);
    await submitLogin(driver, primeiro.email, primeiro.password);
    await waitForPath(driver, "/condominios");
    await visit(driver, "/acordos");
    await waitForText(driver, outro.devedor);
    await (await waitForElement(driver, By.xpath('//button[normalize-space()="Meus acordos"]'))).click();
    await waitForTextGone(driver, outro.devedor);
    await waitForText(driver, dele.devedor);

    await entrarComoAdmin();
  });
});
