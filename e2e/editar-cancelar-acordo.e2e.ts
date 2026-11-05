import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, replaceValue, visit, waitForButton, waitForElement, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, payFirstInstallment, type TestCondominium } from "./support/seed";

// US19 e US20: https://advocondo.github.io/docs/historias/ep03-cadastro-acordos/
describe("Editar e cancelar acordo", () => {
  let driver: WebDriver;
  let condominio: TestCondominium;
  let sequencia = 0;

  /** R$ 900 em 3 parcelas de R$ 300, com 10% de honorários. */
  async function novoAcordo(): Promise<{ id: string; devedor: string }> {
    sequencia += 1;
    const devedor = `E2E Editar ${Date.now()}-${sequencia}`;
    const { id: devedorId } = await createDebtor(condominio.id, devedor, String(sequencia));
    const { id } = await createAgreement(condominio.id, devedorId);
    return { id, devedor };
  }

  async function abrirEdicao(id: string): Promise<void> {
    await visit(driver, `/acordos/${id}`);
    await (await waitForButton(driver, "Editar acordo")).click();
    await waitForElement(driver, By.id("editar-total"));
  }

  const salvar = async () => (await waitForButton(driver, "Salvar alterações")).click();

  beforeAll(async () => {
    condominio = await createCondominium(`E2E Editar ${Date.now()}`);
    driver = await createDriver();
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await visit(driver, "/painel");
  });

  it("renegocia o valor, e as parcelas são recalculadas", async () => {
    const { id } = await novoAcordo();
    await abrirEdicao(id);
    await replaceValue(await driver.findElement(By.id("editar-total")), "120000");
    await salvar();
    await waitForText(driver, "Acordo atualizado com sucesso.");
    await waitForText(driver, "R$ 1.200,00");
    await waitForText(driver, "R$ 400,00");
  });

  it("US19-CA01: com parcela paga, pede a confirmação extra e não muda o que foi pago", async () => {
    const { id } = await novoAcordo();
    await payFirstInstallment(id, "2030-01-31");
    await abrirEdicao(id);
    await waitForText(driver, "Este acordo tem 1 parcela paga");
    await replaceValue(await driver.findElement(By.id("editar-total")), "150000");

    await salvar();
    await waitForText(driver, "Marque a confirmação");

    await (await waitForElement(driver, By.xpath('//label[contains(., "Confirmo a alteração")]'))).click();
    await salvar();
    await waitForText(driver, "Acordo atualizado com sucesso.");
    await waitForText(driver, "R$ 1.500,00");
    expect(await (await waitForElement(driver, By.xpath('//tr[contains(., "1/3")]'))).getText()).toContain("R$ 300,00");
  });

  it("US20: cancela com motivo, sai dos ativos e continua consultável", async () => {
    const { id, devedor } = await novoAcordo();
    await payFirstInstallment(id, "2030-01-31");
    await visit(driver, `/acordos/${id}`);
    await (await waitForButton(driver, "Cancelar acordo")).click();
    await waitForText(driver, "2 parcelas sem pagamento");

    await (await waitForElement(driver, By.css('[role="dialog"] button[type="submit"]'))).click();
    await waitForText(driver, "Informe o motivo do cancelamento.");
    await driver.findElement(By.id("cancelar-motivo")).sendKeys("Devedor quebrou o acordo");
    await (await waitForElement(driver, By.css('[role="dialog"] button[type="submit"]'))).click();

    await waitForText(driver, "Acordo cancelado com sucesso.");
    await waitForText(driver, "Devedor quebrou o acordo");
    expect(await driver.findElements(By.xpath('//button[normalize-space()="Editar acordo"]'))).toHaveLength(0);
    await waitForElement(driver, By.css('button[aria-label^="Pagamentos da parcela 1"]'));

    await visit(driver, "/acordos");
    await waitForElement(driver, By.css('input[aria-label]'));
    await waitForTextGone(driver, devedor);
  });

  it("reativar devolve o acordo aos ativos", async () => {
    const { id, devedor } = await novoAcordo();
    await visit(driver, `/acordos/${id}`);
    await (await waitForButton(driver, "Cancelar acordo")).click();
    await (await waitForElement(driver, By.id("cancelar-motivo"))).sendKeys("Cancelado por engano");
    await (await waitForElement(driver, By.css('[role="dialog"] button[type="submit"]'))).click();
    await waitForText(driver, "Acordo cancelado com sucesso.");

    await (await waitForButton(driver, "Reativar acordo")).click();
    await waitForText(driver, "Acordo reativado com sucesso.");
    await waitForElement(driver, By.xpath('//button[normalize-space()="Editar acordo"]'));

    await visit(driver, "/acordos");
    await waitForText(driver, devedor);
  });
});
