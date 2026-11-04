import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForHydration, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { apiToken, createUser, readEmailToken, type TestUser } from "./support/seed";

const NOVA_SENHA = `e2e-${Date.now()}-nova`;

// US03: https://advocondo.github.io/docs/historias/ep01-portal-autenticacao/#us03
describe("Recuperação de senha", () => {
  let driver: WebDriver;
  let usuario: TestUser;

  async function pedirLink(email: string): Promise<void> {
    await visit(driver, "/recuperar-senha");
    const campo = await waitForElement(driver, By.id("recuperar-email"));
    await waitForHydration(driver, campo);
    await campo.sendKeys(email);
    await (await waitForButton(driver, "Enviar link")).click();
    await waitForText(driver, "Verifique o seu e-mail");
  }

  async function definirSenha(token: string, senha: string): Promise<void> {
    await visit(driver, `/redefinir-senha?token=${encodeURIComponent(token)}`);
    const campo = await waitForElement(driver, By.id("nova-senha"));
    await waitForHydration(driver, campo);
    await campo.sendKeys(senha);
    await driver.findElement(By.id("confirmar-senha")).sendKeys(senha);
    await (await waitForButton(driver, "Salvar nova senha")).click();
  }

  beforeAll(async () => {
    driver = await createDriver();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    usuario = await createUser("operator");
    await openLogin(driver);
  });

  it("o link do login leva à recuperação, e dá para voltar", async () => {
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="Esqueci minha senha"]'))).click();
    await waitForPath(driver, "/recuperar-senha");
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="Voltar ao login"]'))).click();
    await waitForPath(driver, "/login");
  });

  it("US03-CA01 e CA03: o link troca a senha, e a antiga e as sessões abertas deixam de valer", async () => {
    const sessaoAntiga = await apiToken(usuario);
    await pedirLink(usuario.email);
    await definirSenha(await readEmailToken(usuario.email), NOVA_SENHA);
    await waitForText(driver, "Sua nova senha já está valendo.");

    const consulta = await fetch(`${env.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${sessaoAntiga}` } });
    expect(consulta.status).toBe(401);

    await openLogin(driver);
    await submitLogin(driver, usuario.email, usuario.password);
    await waitForText(driver, "E-mail ou senha inválidos.");

    await openLogin(driver);
    await submitLogin(driver, usuario.email, NOVA_SENHA);
    await waitForPath(driver, "/condominios");
  });

  it("a resposta é a mesma para um e-mail sem cadastro", async () => {
    await pedirLink(`e2e-ninguem-${Date.now()}@example.com`);
    await waitForText(driver, "estiver cadastrado");
  });

  it("o reenvio começa bloqueado", async () => {
    await pedirLink(usuario.email);
    const botao = await waitForElement(driver, By.xpath('//button[contains(normalize-space(), "Reenviar link")]'));
    expect(await botao.isEnabled()).toBe(false);
  });

  it("US03-CA02: o link usado não vale de novo, e a tela oferece pedir outro", async () => {
    await pedirLink(usuario.email);
    const token = await readEmailToken(usuario.email);
    await definirSenha(token, NOVA_SENHA);
    await waitForText(driver, "Sua nova senha já está valendo.");

    await definirSenha(token, `${NOVA_SENHA}-outra`);
    await waitForText(driver, "Este link não vale mais");
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="Pedir novo link"]'))).click();
    await waitForPath(driver, "/recuperar-senha");
  });

  it("um pedido novo invalida o link anterior", async () => {
    await pedirLink(usuario.email);
    const antigo = await readEmailToken(usuario.email);
    await pedirLink(usuario.email);
    await definirSenha(antigo, NOVA_SENHA);
    await waitForText(driver, "Este link não vale mais");
  });

  it("não aceita senhas diferentes nem curtas", async () => {
    await pedirLink(usuario.email);
    await visit(driver, `/redefinir-senha?token=${encodeURIComponent(await readEmailToken(usuario.email))}`);
    const campo = await waitForElement(driver, By.id("nova-senha"));
    await waitForHydration(driver, campo);
    await campo.sendKeys("curta");
    await driver.findElement(By.id("confirmar-senha")).sendKeys("outra");
    await (await waitForButton(driver, "Salvar nova senha")).click();
    await waitForText(driver, "Criar nova senha");
  });

  it("sem token, a página explica que o link não vale", async () => {
    await visit(driver, "/redefinir-senha");
    await waitForText(driver, "Este link não vale mais");
  });
});
