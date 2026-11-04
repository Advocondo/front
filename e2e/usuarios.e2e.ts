import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForHydration, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createUser, readInviteToken, type TestUser } from "./support/seed";

const SENHA = `e2e-${Date.now()}-acesso`;

// US07, US08 e US09: https://advocondo.github.io/docs/historias/ep02-usuarios-perfis/
describe("Gestão de usuários", () => {
  let driver: WebDriver;
  let sequencia = 0;

  function novoEmail(): string {
    sequencia += 1;
    return `e2e-convite-${Date.now()}-${sequencia}@example.com`;
  }

  async function entrar(email: string, senha: string, destino = "/condominios"): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, email, senha);
    await waitForPath(driver, destino);
  }

  const entrarComoAdmin = () => entrar(env.adminEmail, env.adminPassword);

  async function abrirTela(busca: string): Promise<void> {
    await visit(driver, "/usuarios");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar por nome ou e-mail"]'))).sendKeys(busca);
    await waitForText(driver, busca);
  }

  /** Convida pela tela e devolve os dados. */
  async function convidar(nome: string, email: string, perfil = "operator"): Promise<void> {
    await visit(driver, "/usuarios");
    await (await waitForButton(driver, "Convidar membro")).click();
    await (await waitForElement(driver, By.id("convite-nome"))).sendKeys(nome);
    await driver.findElement(By.id("convite-email")).sendKeys(email);
    await (await waitForElement(driver, By.css(`#convite-perfil option[value="${perfil}"]`))).click();
  }

  const enviarConvite = async () => (await waitForButton(driver, "Enviar convite")).click();

  beforeAll(async () => {
    driver = await createDriver();
    await entrarComoAdmin();
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await entrarComoAdmin();
  });

  it("US07-CA01: convite completo, da tela ao primeiro login pelo link do e-mail", async () => {
    const nome = `E2E Convidada ${Date.now()}`;
    const email = novoEmail();
    await convidar(nome, email);
    await enviarConvite();
    await waitForText(driver, `Convite enviado para ${email}.`);

    await abrirTela(nome);
    await waitForText(driver, "Pendente");

    const token = await readInviteToken(email);
    await visit(driver, `/convite?token=${encodeURIComponent(token)}`);
    const senha = await waitForElement(driver, By.id("convite-senha"));
    await waitForHydration(driver, senha);
    await senha.sendKeys(SENHA);
    await driver.findElement(By.id("convite-confirmacao")).sendKeys(SENHA);
    await (await waitForButton(driver, "Criar acesso")).click();
    await waitForText(driver, "Sua senha foi definida.");

    await entrar(email, SENHA);
  });

  it("reenviar o convite gera um link novo, e o anterior deixa de valer", async () => {
    const nome = `E2E Reenvio ${Date.now()}`;
    const email = novoEmail();
    await convidar(nome, email);
    await enviarConvite();
    await waitForText(driver, `Convite enviado para ${email}.`);
    const tokenAntigo = await readInviteToken(email);

    await abrirTela(nome);
    await (await waitForElement(driver, By.css(`button[aria-label="Reenviar convite de ${nome}"]`))).click();
    await waitForText(driver, "O link anterior deixou de valer.");
    const tokenNovo = await readInviteToken(email);
    expect(tokenNovo).not.toBe(tokenAntigo);

    for (const [token, esperado] of [[tokenAntigo, "O convite é inválido ou já expirou."], [tokenNovo, "Sua senha foi definida."]]) {
      await visit(driver, `/convite?token=${encodeURIComponent(token)}`);
      const senha = await waitForElement(driver, By.id("convite-senha"));
      await waitForHydration(driver, senha);
      await senha.sendKeys(SENHA);
      await driver.findElement(By.id("convite-confirmacao")).sendKeys(SENHA);
      await (await waitForButton(driver, "Criar acesso")).click();
      await waitForText(driver, esperado);
    }
  });

  it("o link de convite não vale duas vezes", async () => {
    const email = novoEmail();
    await convidar(`E2E Duas Vezes ${Date.now()}`, email);
    await enviarConvite();
    await waitForText(driver, `Convite enviado para ${email}.`);
    const token = await readInviteToken(email);

    for (const esperado of ["Sua senha foi definida.", "O convite é inválido ou já expirou."]) {
      await visit(driver, `/convite?token=${encodeURIComponent(token)}`);
      const senha = await waitForElement(driver, By.id("convite-senha"));
      await waitForHydration(driver, senha);
      await senha.sendKeys(SENHA);
      await driver.findElement(By.id("convite-confirmacao")).sendKeys(SENHA);
      await (await waitForButton(driver, "Criar acesso")).click();
      await waitForText(driver, esperado);
    }
  });

  it("US07-CA02: quem não é Administrador não vê nem acessa o módulo", async () => {
    const operador = await createUser("operator");
    await entrar(operador.email, operador.password);
    await waitForElement(driver, By.css('button[aria-label="Sair"]'));
    expect(await driver.findElements(By.xpath('//nav//*[normalize-space()="Gestão de usuários"]'))).toHaveLength(0);
    await visit(driver, "/usuarios");
    await waitForPath(driver, "/condominios");
  });

  it("US07-CA03: não aceita dois usuários com o mesmo e-mail", async () => {
    const email = novoEmail();
    await convidar(`E2E Primeiro ${Date.now()}`, email);
    await enviarConvite();
    await waitForText(driver, `Convite enviado para ${email}.`);

    await convidar(`E2E Repetido ${Date.now()}`, email);
    await enviarConvite();
    await waitForText(driver, "Este e-mail já está em uso por outro usuário.");
  });

  it("US07-CA04: a marcação de advogado exige a OAB e alimenta a lista de responsáveis", async () => {
    const nome = `E2E Advogada ${Date.now()}`;
    const email = novoEmail();
    const oab = `DF${String(Date.now() % 1000000).padStart(6, "0")}`;
    await convidar(nome, email);
    await (await waitForElement(driver, By.xpath('//label[contains(normalize-space(), "advogado(a) com OAB")]'))).click();
    await enviarConvite();
    await waitForText(driver, "A OAB tem de 8 a 12 caracteres");
    await (await waitForElement(driver, By.id("convite-oab"))).sendKeys(oab);
    await enviarConvite();
    await waitForText(driver, `Convite enviado para ${email}.`);

    await abrirTela(nome);
    await waitForText(driver, `Advogado · OAB ${oab}`);
  });

  describe("US08: inativar e reativar", () => {
    let alvo: TestUser;

    beforeEach(async () => {
      alvo = await createUser("operator");
    });

    it("CA01 e CA02: o inativo perde o acesso, e CA03: a ação é reversível", async () => {
      await abrirTela(alvo.email);
      await (await waitForElement(driver, By.css('button[aria-label^="Inativar"]'))).click();
      await (await waitForElement(driver, By.xpath('//div[@role="dialog"]//button[normalize-space()="Inativar acesso"]'))).click();
      await waitForText(driver, "inativado.");
      await waitForText(driver, "Inativo");

      await openLogin(driver);
      await submitLogin(driver, alvo.email, alvo.password);
      await waitForText(driver, "E-mail ou senha inválidos.");

      await entrarComoAdmin();
      await abrirTela(alvo.email);
      await (await waitForElement(driver, By.css('button[aria-label^="Reativar"]'))).click();
      await waitForText(driver, "reativado com sucesso.");

      await entrar(alvo.email, alvo.password);
    });
  });

  it("US09-CA01: mudar o perfil muda o acesso da pessoa", async () => {
    const alvo = await createUser("operator");
    await abrirTela(alvo.email);
    await (await waitForElement(driver, By.css('button[aria-label^="Definir nível de acesso"]'))).click();
    await (await waitForElement(driver, By.css('#perfil-usuario option[value="client"]'))).click();
    await (await waitForButton(driver, "Salvar perfil")).click();
    await waitForText(driver, "agora é Cliente.");

    await entrar(alvo.email, alvo.password, "/painel-cliente");
  });

  it("o Administrador não tem ações sobre a própria conta", async () => {
    await abrirTela(env.adminEmail);
    const linha = await waitForElement(driver, By.xpath(`//tr[.//*[normalize-space()="${env.adminEmail}"]]`));
    expect(await linha.getText()).toContain("você");
    expect(await linha.findElements(By.css("button"))).toHaveLength(0);
  });
});
