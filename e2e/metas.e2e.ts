import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, replaceValue, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createCondominium, createDebtor, createUser, payFirstInstallment, type TestUser, createAgreementAs } from "./support/seed";

const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

// US32 e US36: https://advocondo.github.io/docs/historias/ep05-comissoes-metas/
describe("Metas e comissões", () => {
  let driver: WebDriver;
  let colaborador: TestUser;
  let colega: TestUser;

  async function entrar(email: string, senha: string): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, email, senha);
    await waitForPath(driver, "/condominios");
    await visit(driver, "/metas");
  }

  /** O colaborador aparece na lista pelo nome, que é igual para todos os usuários de teste. */
  async function definirMetaDoColaborador(valor: string): Promise<void> {
    await entrar(env.adminEmail, env.adminPassword);
    await (await waitForButton(driver, "Definir meta")).click();
    await (await waitForElement(driver, By.css(`#meta-colaborador option[value="${colaborador.id}"]`))).click();
    await replaceValue(await driver.findElement(By.id("meta-valor")), valor);
    await (await waitForButton(driver, "Salvar meta")).click();
    await waitForText(driver, "salva com sucesso.");
  }

  beforeAll(async () => {
    colaborador = await createUser("operator");
    colega = await createUser("operator");
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("sem meta definida, o colaborador vê o estado vazio", async () => {
    await entrar(colaborador.email, colaborador.password);
    await waitForText(driver, "Sem meta neste mês");
  });

  it("US36: o Administrador define a meta, e US32-CA01: o colaborador a vê", async () => {
    await definirMetaDoColaborador("100000");
    await entrar(colaborador.email, colaborador.password);
    await waitForText(driver, "Minha meta do mês");
    await waitForText(driver, "R$ 1.000,00");
    await waitForText(driver, "Você vê só os seus números");
  });

  it("US36-CA01: a baixa de uma parcela do acordo que ele cadastrou atualiza o atingimento", async () => {
    await definirMetaDoColaborador("100000");
    const condominio = await createCondominium(`E2E Metas ${Date.now()}`);
    const devedor = await createDebtor(condominio.id, `E2E Metas ${Date.now()}`, `Unidade ${Date.now()}`);
    // R$ 900,00 em 3 parcelas com 10% de honorários: R$ 30,00 por parcela paga.
    const acordo = await createAgreementAs(colaborador, condominio.id, devedor.id, hoje);
    await payFirstInstallment(acordo.id, hoje);

    await entrar(colaborador.email, colaborador.password);
    await waitForText(driver, "R$ 30,00");
    await waitForText(driver, "R$ 970,00");
    await waitForText(driver, "3%");
  });

  it("US32-CA02 e US36-CA02: o colaborador não vê dados do escritório nem de colegas", async () => {
    await entrar(colega.email, colega.password);
    await waitForText(driver, "Você vê só os seus números");
    const texto = await driver.findElement(By.css("body")).getText();
    expect(texto).not.toContain("Metas por colaborador");
    expect(texto).not.toContain("Faturamento do mês");
  });

  it("o Administrador vê a equipe com o atingimento", async () => {
    await entrar(env.adminEmail, env.adminPassword);
    await waitForText(driver, "Metas por colaborador");
    await waitForText(driver, "Faturamento do mês");
    await waitForElement(driver, By.css('[role="progressbar"]'));
  });

  it("a navegação entre meses troca o período", async () => {
    await entrar(colega.email, colega.password);
    await (await waitForElement(driver, By.css('button[aria-label="Mês anterior"]'))).click();
    await waitForText(driver, "A comissão acumulada só está disponível para o mês atual.");
  });
});
