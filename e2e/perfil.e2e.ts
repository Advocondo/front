import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, replaceValue, visit, waitForButton, waitForElement, waitForHydration, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { apiToken, createUser, type TestUser } from "./support/seed";

const NOVA_SENHA = `e2e-${Date.now()}-perfil`;

// US05 e US06: https://advocondo.github.io/docs/historias/ep01-portal-autenticacao/
describe("Meu perfil", () => {
  let driver: WebDriver;
  let usuario: TestUser;

  const statusDaSessao = async (token: string): Promise<number> => (await fetch(`${env.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).status;

  async function abrirPerfil(): Promise<void> {
    await visit(driver, "/perfil");
    await waitForHydration(driver, await waitForElement(driver, By.id("perfil-nome")));
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
    await submitLogin(driver, usuario.email, usuario.password);
    await waitForPath(driver, "/condominios");
  });

  it("o nome no menu leva ao perfil", async () => {
    await (await waitForElement(driver, By.css('a[href="/perfil"]'))).click();
    await waitForPath(driver, "/perfil");
  });

  it("US05-CA01: muda o nome sem pedir senha, e o menu acompanha", async () => {
    await abrirPerfil();
    const nome = `E2E Renomeado ${Date.now()}`;
    await replaceValue(await driver.findElement(By.id("perfil-nome")), nome);
    await (await waitForButton(driver, "Salvar dados")).click();
    await waitForText(driver, "Dados salvos com sucesso.");
    await driver.navigate().refresh();
    await waitForText(driver, nome);
  });

  it("US05-CA02: mudar o e-mail pede a senha atual e recusa a errada", async () => {
    await abrirPerfil();
    const novoEmail = `e2e-novo-${Date.now()}@example.com`;
    await replaceValue(await driver.findElement(By.id("perfil-email")), novoEmail);
    const senha = await waitForElement(driver, By.id("perfil-email-senha"));

    await senha.sendKeys("senha-errada");
    await (await waitForButton(driver, "Salvar dados")).click();
    await waitForText(driver, "A senha atual está incorreta.");

    await replaceValue(senha, usuario.password);
    await (await waitForButton(driver, "Salvar dados")).click();
    await waitForText(driver, "Dados salvos com sucesso.");

    const entrada = await fetch(`${env.apiUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: novoEmail, password: usuario.password }) });
    expect(entrada.status).toBe(200);
  });

  it("US05-CA02: trocar a senha encerra as outras sessões e mantém esta", async () => {
    const outroAparelho = await apiToken(usuario);
    await abrirPerfil();
    await (await waitForElement(driver, By.id("senha-atual"))).sendKeys(usuario.password);
    await driver.findElement(By.id("senha-nova")).sendKeys(NOVA_SENHA);
    await driver.findElement(By.id("senha-confirmacao")).sendKeys(NOVA_SENHA);
    await (await waitForButton(driver, "Alterar senha")).click();
    await waitForText(driver, "Senha alterada.");

    expect(await statusDaSessao(outroAparelho)).toBe(401);
    await waitForText(driver, "Este aparelho");
    await driver.navigate().refresh();
    await waitForElement(driver, By.id("perfil-nome"));
  });

  it("US06-CA01: Encerrar as outras derruba o outro aparelho e mantém este", async () => {
    const outroAparelho = await apiToken(usuario);
    await abrirPerfil();
    await waitForText(driver, "Este aparelho");
    await (await waitForButton(driver, "Encerrar as outras")).click();
    await waitForText(driver, "Outras sessões encerradas.");
    await waitForTextGone(driver, "Encerrar as outras");

    expect(await statusDaSessao(outroAparelho)).toBe(401);
    await driver.navigate().refresh();
    await waitForElement(driver, By.id("perfil-nome"));
  });

  it("encerra uma sessão específica", async () => {
    const outroAparelho = await apiToken(usuario);
    await abrirPerfil();
    await (await waitForElement(driver, By.css('button[aria-label^="Encerrar a sessão"]'))).click();
    await waitForText(driver, "encerrada.");
    expect(await statusDaSessao(outroAparelho)).toBe(401);
  });

  it("o Cliente também tem acesso ao próprio perfil", async () => {
    const cliente = await createUser("client");
    await openLogin(driver);
    await submitLogin(driver, cliente.email, cliente.password);
    await waitForPath(driver, "/painel-cliente");
    await (await waitForElement(driver, By.css('a[href="/perfil"]'))).click();
    await waitForPath(driver, "/perfil");
    await waitForText(driver, "Este aparelho");
  });

  it("sem sessão, a tela leva ao login", async () => {
    await (await waitForElement(driver, By.css('button[aria-label="Sair"]'))).click();
    await waitForPath(driver, "/login");
    await visit(driver, "/perfil");
    await waitForPath(driver, "/login");
  });
});
