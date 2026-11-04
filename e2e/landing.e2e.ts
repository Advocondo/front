import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForHydration, waitForPath, waitForText } from "./support/driver";
import { contactEmailWasLogged } from "./support/seed";

// US01: https://advocondo.github.io/docs/historias/ep01-portal-autenticacao/#us01
describe("Landing page", () => {
  let driver: WebDriver;

  async function preencher(nome: string, mensagem: string): Promise<void> {
    await waitForHydration(driver, await waitForElement(driver, By.id("contato-nome")));
    await driver.findElement(By.id("contato-nome")).sendKeys(nome);
    await driver.findElement(By.id("contato-telefone")).sendKeys("61912345678");
    await driver.findElement(By.id("contato-email")).sendKeys("visitante@example.com");
    await driver.findElement(By.id("contato-mensagem")).sendKeys(mensagem);
  }

  /** O botão pode estar abaixo da dobra; o clique pelo script não depende da rolagem. */
  async function clicarEnviar(): Promise<void> {
    await driver.executeScript("arguments[0].click();", await waitForButton(driver, "Enviar"));
  }

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await visit(driver, "/");
    await driver.executeScript("localStorage.clear(); sessionStorage.clear();");
    await visit(driver, "/");
    await waitForElement(driver, By.css("h1"));
  });

  it("US01-CA01: abre na URL do sistema, sem login, com a identidade visual", async () => {
    expect(new URL(await driver.getCurrentUrl()).pathname).toBe("/");
    const logo = await waitForElement(driver, By.css('header img[src*="logo-lockup-white"]'));
    expect(await logo.getAttribute("naturalWidth")).not.toBe("0");
    expect((await driver.findElement(By.css("h1")).getText()).length).toBeGreaterThan(0);
  });

  it("US01-CA02: tem as seções do layout aprovado", async () => {
    for (const id of ["atuacao", "assessoria", "por-que-nos", "contato"]) {
      await waitForElement(driver, By.id(id));
    }
    await waitForElement(driver, By.css("footer"));
  });

  it("US01-CA03: o botão do hero leva ao login", async () => {
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="Acessar a plataforma"]'))).click();
    await waitForPath(driver, "/login");
  });

  it("US01-CA03: o Entrar da navegação leva ao login", async () => {
    await (await waitForElement(driver, By.css('nav a[href="/login"]'))).click();
    await waitForPath(driver, "/login");
  });

  it("o login tem o caminho de volta para o site", async () => {
    await visit(driver, "/login");
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="Voltar ao site"]'))).click();
    await waitForPath(driver, "/");
  });

  it("envia o formulário de contato e o e-mail sai para o escritório", async () => {
    const mensagem = `Mensagem E2E ${Date.now()}`;
    await preencher("Visitante E2E", mensagem);
    await clicarEnviar();

    await waitForText(driver, "Recebemos a sua mensagem.");
    expect(await driver.findElement(By.id("contato-nome")).getAttribute("value")).toBe("");
    expect(await contactEmailWasLogged(mensagem)).toBe(true);
  });

  it("não envia o formulário com o e-mail inválido", async () => {
    const mensagem = `Mensagem inválida E2E ${Date.now()}`;
    await preencher("Visitante E2E", mensagem);
    await driver.findElement(By.id("contato-email")).sendKeys("-sem-dominio@");
    await clicarEnviar();

    await waitForText(driver, "Informe um e-mail válido.");
    expect(await contactEmailWasLogged(mensagem)).toBe(false);
  });

  it("um robô que preenche a armadilha recebe a resposta normal, e nenhum e-mail sai", async () => {
    const mensagem = `Mensagem de robô E2E ${Date.now()}`;
    await preencher("Robô E2E", mensagem);
    await driver.executeScript(
      `const campo = document.getElementById("contato-website");
       Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(campo, "spam");
       campo.dispatchEvent(new Event("input", { bubbles: true }));`,
    );
    await clicarEnviar();

    await waitForText(driver, "Recebemos a sua mensagem.");
    expect(await contactEmailWasLogged(mensagem)).toBe(false);
  });

  it("mostra o aviso sobre o uso dos dados", async () => {
    await waitForText(driver, "Seus dados serão usados exclusivamente");
  });
});
