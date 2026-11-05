import { tmpdir } from "node:os";
import { join } from "node:path";
import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createCondominium, createSpreadsheet, type TestCondominium } from "./support/seed";

// US14: https://advocondo.github.io/docs/historias/ep03-cadastro-acordos/#us14
describe("Importar inadimplentes", () => {
  let driver: WebDriver;
  let condominio: TestCondominium;
  let valido: string;
  let invalido: string;
  let caminho: string;

  async function abrirComPlanilha(arquivo: string): Promise<void> {
    await visit(driver, "/devedores");
    await (await waitForButton(driver, "Importar planilha")).click();
    await (await waitForElement(driver, By.css(`#importar-condominio option[value="${condominio.id}"]`))).click();
    await (await waitForElement(driver, By.css('input[aria-label="Arquivo da planilha"]'))).sendKeys(arquivo);
  }

  beforeAll(async () => {
    driver = await createDriver();
    const carimbo = Date.now();
    condominio = await createCondominium(`E2E Importar ${carimbo}`);
    valido = `E2E Importado ${carimbo}`;
    invalido = `E2E Sem Contato ${carimbo}`;
    caminho = join(tmpdir(), `e2e-inadimplentes-${carimbo}.xlsx`);
    await createSpreadsheet(caminho, [
      [valido, "101", "61912345678", ""],
      [invalido, "102", "", ""],
    ]);
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("US14-CA01: aponta a linha com erro e não grava nada antes de confirmar", async () => {
    await abrirComPlanilha(caminho);
    await waitForText(driver, `Linha 3 · ${invalido}`);
    await waitForText(driver, "Informe o telefone ou o e-mail do devedor.");
    await waitForButton(driver, "Importar 1 registro válido");

    await visit(driver, "/devedores");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar por nome ou unidade"]'))).sendKeys(valido);
    await waitForText(driver, "Nenhum devedor encontrado");
  });

  it("US14-CA02: confirma, e o devedor fica disponível; a linha com erro fica de fora", async () => {
    await abrirComPlanilha(caminho);
    await (await waitForButton(driver, "Importar 1 registro válido")).click();
    await waitForText(driver, "1 devedor importado. 1 linha ficou de fora.");

    await visit(driver, "/devedores");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar por nome ou unidade"]'))).sendKeys(valido);
    await waitForText(driver, valido);
    expect(await driver.findElement(By.css("body")).getText()).not.toContain(invalido);
  });

  it("importar de novo não duplica: a linha vira parecida", async () => {
    await abrirComPlanilha(caminho);
    await waitForText(driver, "Parecido com quem já está cadastrado");
    expect(await (await waitForButton(driver, "Importar")).isEnabled()).toBe(false);
  });
});
