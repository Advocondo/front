import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hojeEmBrasilia } from "../app/lib/dates";
import { CELULAR, createDriver, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, createUser, linkCondominiums, payFirstInstallment, type TestUser } from "./support/seed";

// #83: https://github.com/Advocondo/front/issues/83 (critérios propostos na issue)
type Medida = { largura: number; excesso: number; tabelas: number };

/**
 * `excesso`: quanto a página passa da largura da tela (zero é sem rolagem horizontal).
 * `tabelas`: no celular, as listas viram cartões; nenhuma tela do escritório mostra tabela.
 */
function medir(driver: WebDriver): Promise<Medida> {
  return driver.executeScript<Medida>(`
    const largura = document.documentElement.clientWidth;
    return { largura, excesso: document.documentElement.scrollWidth - largura, tabelas: document.querySelectorAll("main table").length };`);
}

/**
 * O Selenium rola o botão só até a borda de baixo, onde a navegação inferior fica por cima. Quem usa
 * o celular rola a lista com o dedo; aqui, o botão vai para o meio da tela antes do clique.
 */
async function clicarNoMeio(driver: WebDriver, locator: By): Promise<void> {
  const elemento = await waitForElement(driver, locator);
  await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' })", elemento);
  await elemento.click();
}

async function abrirPelaNavegacao(driver: WebDriver, rotulo: string, caminho: string): Promise<void> {
  await (await waitForElement(driver, By.xpath(`//nav[@aria-label="Navegação inferior"]//a[normalize-space()="${rotulo}"]`))).click();
  await waitForPath(driver, caminho);
}

async function abrirPeloMais(driver: WebDriver, rotulo: string, caminho: string): Promise<void> {
  await abrirPelaNavegacao(driver, "Mais", "/mais");
  await (await waitForElement(driver, By.xpath(`//ul[@aria-label="Outras telas"]//a[.//span[normalize-space()="${rotulo}"]]`))).click();
  await waitForPath(driver, caminho);
}

describe("Telas do escritório no celular", () => {
  let driver: WebDriver;
  let operador: TestUser;
  let devedora: string;
  let condominioNome: string;
  let condominioId: string;
  let acordoId: string;

  async function entrar(email: string, senha: string, inicio: string): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, email, senha);
    await waitForPath(driver, inicio);
  }

  async function conferirTela(caminho: string): Promise<void> {
    // A tela já carregou quando a barra inferior aparece e o "Carregando" some.
    await waitForElement(driver, By.css('nav[aria-label="Navegação inferior"]'));
    await driver.wait(async () => (await driver.findElements(By.xpath('//*[@role="status" and starts-with(normalize-space(), "Carregando")]'))).length === 0, 20_000);
    expect({ caminho, ...(await medir(driver)) }).toEqual({ caminho, largura: CELULAR.width, excesso: 0, tabelas: 0 });
  }

  beforeAll(async () => {
    driver = await createDriver({ celular: true });
    const carimbo = Date.now();
    operador = await createUser("operator", { name: `E2E Celular ${carimbo}` });
    // Dados para as tabelas terem linhas, com nomes longos como os reais.
    condominioNome = `E2E Condomínio Residencial Celular ${carimbo}`;
    const condominio = await createCondominium(condominioNome);
    condominioId = condominio.id;
    devedora = `E2E Devedora Com Nome Comprido ${carimbo}`;
    const devedor = await createDebtor(condominio.id, devedora, "Bloco B 1203");
    // A 1ª parcela vence neste mês, para Faturas do mês ter o cartão dela.
    acordoId = (await createAgreement(condominio.id, devedor.id, hojeEmBrasilia())).id;
    // Uma parcela paga, para o histórico financeiro ter o que mostrar.
    await payFirstInstallment(acordoId, hojeEmBrasilia());
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("CA01: o Administrador alcança cada tela pela barra inferior ou pelo Mais, sem rolagem horizontal", async () => {
    await entrar(env.adminEmail, env.adminPassword, "/painel");
    // A barra lateral do desktop não aparece no celular.
    expect(await (await waitForElement(driver, By.css('button[aria-label="Sair"]'))).isDisplayed()).toBe(false);
    await conferirTela("/painel");

    for (const [rotulo, caminho] of [["Acordos", "/acordos"], ["Mês", "/acompanhamento"], ["Condomínios", "/condominios"], ["Painel", "/painel"]]) {
      await abrirPelaNavegacao(driver, rotulo, caminho);
      await conferirTela(caminho);
    }
    for (const [rotulo, caminho] of [["Devedores", "/devedores"], ["Metas e comissões", "/metas"], ["Notificações", "/notificacoes"], ["Gestão de usuários", "/usuarios"], ["Trilha de auditoria", "/auditoria"], ["Conteúdo institucional", "/institucional"], ["Meu perfil", "/perfil"]]) {
      await abrirPeloMais(driver, rotulo, caminho);
      await conferirTela(caminho);
    }
  });

  it("CA02: o Mais do Operador não tem os itens do Administrador, e sai da conta", async () => {
    await entrar(operador.email, operador.password, "/condominios");
    await abrirPelaNavegacao(driver, "Mais", "/mais");
    await conferirTela("/mais");
    const itens = await driver.findElements(By.css('ul[aria-label="Outras telas"] a'));
    const textos = await Promise.all(itens.map((i) => i.getText()));
    expect(textos.some((t) => t.includes("Gestão de usuários") || t.includes("Trilha de auditoria"))).toBe(false);

    await (await waitForElement(driver, By.xpath('//button[.//span[normalize-space()="Sair"]]'))).click();
    await waitForPath(driver, "/login");
  });

  it("Acordos e Faturas do mês mostram cartões, e os pagamentos abrem no celular", async () => {
    await entrar(operador.email, operador.password, "/condominios");
    await abrirPelaNavegacao(driver, "Acordos", "/acordos");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar por devedor, condomínio ou responsável"]'))).sendKeys(devedora);
    await clicarNoMeio(driver, By.xpath(`//ul[@aria-label="Acordos"]//a[@aria-label="Ver o acordo de ${devedora}"]`));
    await driver.wait(async () => (await driver.getCurrentUrl()).includes("/acordos/"), 20_000);

    await abrirPelaNavegacao(driver, "Mês", "/acompanhamento");
    await conferirTela("/acompanhamento");
    expect(await driver.findElements(By.css("table"))).toHaveLength(0);
    await clicarNoMeio(driver, By.css(`ul[aria-label="Faturas do mês"] button[aria-label="Pagamentos da parcela 1 de ${devedora}"]`));
    const dialogo = await waitForElement(driver, By.css('[role="dialog"]'));
    const largura = (await dialogo.getRect()).width;
    expect(largura).toBeLessThanOrEqual(CELULAR.width);
  });

  it("Devedores e Condomínios mostram cartões, e o Editar abre no celular", async () => {
    await entrar(operador.email, operador.password, "/condominios");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar condomínio ou síndico"]'))).sendKeys(condominioNome);
    await clicarNoMeio(driver, By.css(`ul[aria-label="Condomínios"] button[aria-label="Editar ${condominioNome}"]`));
    expect((await (await waitForElement(driver, By.css('[role="dialog"]'))).getRect()).width).toBeLessThanOrEqual(CELULAR.width);
    await (await waitForButton(driver, "Cancelar")).click();
    expect(await driver.findElements(By.css("table"))).toHaveLength(0);

    await abrirPelaNavegacao(driver, "Devedores", "/devedores");
    await conferirTela("/devedores");
    await (await waitForElement(driver, By.css('input[aria-label="Buscar por nome ou unidade"]'))).sendKeys(devedora);
    await clicarNoMeio(driver, By.css(`ul[aria-label="Devedores"] button[aria-label="Editar ${devedora}"]`));
    expect((await (await waitForElement(driver, By.css('[role="dialog"]'))).getRect()).width).toBeLessThanOrEqual(CELULAR.width);
    await (await waitForButton(driver, "Cancelar")).click();
  });

  it("o detalhe do acordo e o da fatura cabem no celular, sem tabela", async () => {
    await entrar(env.adminEmail, env.adminPassword, "/painel");
    await visit(driver, `/acordos/${acordoId}`);
    await waitForElement(driver, By.css('ul[aria-label="Parcelas"]'));
    await waitForText(driver, "Baixa da parcela 1");
    await conferirTela(`/acordos/${acordoId}`);

    await clicarNoMeio(driver, By.xpath('//ul[@aria-label="Parcelas"]//a[starts-with(normalize-space(), "1/3")]'));
    await driver.wait(async () => (await driver.getCurrentUrl()).includes("/faturas/"), 20_000);
    await conferirTela("/faturas");
  });

  it("as telas do Cliente cabem no celular", async () => {
    const cliente = await createUser("client");
    await linkCondominiums(cliente.id, [condominioId]);
    await entrar(cliente.email, cliente.password, "/painel-cliente");
    await waitForText(driver, devedora);
    expect(await medir(driver)).toEqual({ largura: CELULAR.width, excesso: 0, tabelas: 0 });

    await clicarNoMeio(driver, By.xpath(`//a[normalize-space()="${devedora}"]`));
    await driver.wait(async () => (await driver.getCurrentUrl()).includes("/painel-cliente/moradores/"), 20_000);
    await waitForText(driver, devedora);
    expect(await medir(driver)).toEqual({ largura: CELULAR.width, excesso: 0, tabelas: 0 });
  });

  it("o formulário ocupa a tela toda, com o salvar ao alcance; a confirmação fica centralizada", async () => {
    await entrar(operador.email, operador.password, "/condominios");
    await abrirPelaNavegacao(driver, "Acordos", "/acordos");
    await (await waitForButton(driver, "Novo acordo")).click();
    const formulario = await (await waitForElement(driver, By.css('[role="dialog"]'))).getRect();
    expect({ x: formulario.x, y: formulario.y, width: formulario.width, height: formulario.height }).toEqual({ x: 0, y: 0, ...CELULAR });
    // O botão de salvar aparece sem rolar, no rodapé fixo do formulário.
    const salvar = await (await waitForButton(driver, "Salvar acordo")).getRect();
    expect(salvar.y + salvar.height).toBeLessThanOrEqual(CELULAR.height);
    expect(salvar.width).toBeGreaterThan(CELULAR.width / 2);
    await (await waitForButton(driver, "Cancelar")).click();

    await abrirPelaNavegacao(driver, "Mês", "/acompanhamento");
    await clicarNoMeio(driver, By.css(`ul[aria-label="Faturas do mês"] button[aria-label="Pagamentos da parcela 1 de ${devedora}"]`));
    const confirmacao = await (await waitForElement(driver, By.css('[role="dialog"]'))).getRect();
    expect(confirmacao.width).toBeLessThan(CELULAR.width);
    expect(confirmacao.height).toBeLessThan(CELULAR.height);
  });

  it("CA03: no desktop, a barra lateral continua e a barra inferior não aparece", async () => {
    const desktop = await createDriver();
    try {
      await openLogin(desktop);
      await submitLogin(desktop, operador.email, operador.password);
      await waitForPath(desktop, "/condominios");
      expect(await (await waitForElement(desktop, By.css('button[aria-label="Sair"]'))).isDisplayed()).toBe(true);
      expect(await (await waitForElement(desktop, By.css('nav[aria-label="Navegação inferior"]'))).isDisplayed()).toBe(false);
    } finally {
      await desktop.quit();
    }
  });
});
