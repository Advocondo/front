import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, replaceValue, visit, waitForButton, waitForElement, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createCondominium, type TestCondominium } from "./support/seed";

const BUSCA = By.css('input[aria-label="Buscar por nome ou unidade"]');

// US13: https://advocondo.github.io/docs/historias/ep03-cadastro-acordos/#us13
describe("Devedores", () => {
  let driver: WebDriver;
  let condominio: TestCondominium;
  let outroCondominio: TestCondominium;
  let sequencia = 0;

  /** Nome e unidade novos a cada chamada: o banco de teste não é limpo. */
  function novoDevedor(): { nome: string; unidade: string } {
    sequencia += 1;
    const marca = `${Date.now()}${sequencia}`;
    return { nome: `E2E Devedor ${marca}`, unidade: `Bloco ${marca}` };
  }

  async function escolherCondominio(selectId: string, id: string): Promise<void> {
    await (await waitForElement(driver, By.css(`#${selectId} option[value="${id}"]`))).click();
  }

  async function abrirFormulario(nome: string, unidade: string, condominioId = condominio.id): Promise<void> {
    await (await waitForButton(driver, "Novo devedor")).click();
    await (await waitForElement(driver, By.id("devedor-nome"))).sendKeys(nome);
    await escolherCondominio("devedor-condominio", condominioId);
    await driver.findElement(By.id("devedor-unidade")).sendKeys(unidade);
  }

  async function cadastrar(nome: string, unidade: string, condominioId = condominio.id): Promise<void> {
    await abrirFormulario(nome, unidade, condominioId);
    await driver.findElement(By.id("devedor-telefone")).sendKeys("61912345678");
    await (await waitForButton(driver, "Salvar devedor")).click();
    await waitForText(driver, `Devedor ${nome} cadastrado com sucesso.`);
  }

  beforeAll(async () => {
    condominio = await createCondominium(`E2E Devedores ${Date.now()}`);
    outroCondominio = await createCondominium(`E2E Devedores Outro ${Date.now()}`);
    driver = await createDriver();
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/condominios");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await visit(driver, "/devedores");
    await waitForElement(driver, BUSCA);
  });

  it("a barra lateral leva à tela de devedores", async () => {
    await visit(driver, "/condominios");
    await (await waitForElement(driver, By.xpath('//nav//*[normalize-space()="Devedores"]'))).click();
    await waitForPath(driver, "/devedores");
  });

  it("cadastra um devedor, que continua na lista depois de recarregar", async () => {
    const { nome, unidade } = novoDevedor();
    await cadastrar(nome, unidade);

    await driver.navigate().refresh();
    await (await waitForElement(driver, BUSCA)).sendKeys(nome);
    await waitForText(driver, unidade);
    await waitForText(driver, "(61) 91234-5678");
  });

  it("exige telefone ou e-mail", async () => {
    const { nome, unidade } = novoDevedor();
    await abrirFormulario(nome, unidade);
    await (await waitForButton(driver, "Salvar devedor")).click();
    await waitForText(driver, "Informe o telefone ou o e-mail do devedor.");
  });

  describe("US13-CA01: alerta de duplicidade", () => {
    async function chegarAoAlerta(): Promise<{ nome: string; unidade: string }> {
      const original = novoDevedor();
      await cadastrar(original.nome, original.unidade);
      await visit(driver, "/devedores");
      await waitForElement(driver, BUSCA);
      // Mesma unidade em outro nome é o caso que a API considera parecido.
      await abrirFormulario(novoDevedor().nome, original.unidade);
      await driver.findElement(By.id("devedor-email")).sendKeys("outro@example.com");
      await (await waitForButton(driver, "Salvar devedor")).click();
      await waitForText(driver, "Já existe um devedor parecido");
      return original;
    }

    it("avisa, mostra o parecido e permite cadastrar mesmo assim", async () => {
      const original = await chegarAoAlerta();
      await waitForText(driver, original.nome);
      await (await waitForButton(driver, "Salvar mesmo assim")).click();
      await waitForText(driver, "cadastrado com sucesso.");
    });

    it("permite usar o cadastro existente", async () => {
      const original = await chegarAoAlerta();
      await (await waitForElement(driver, By.css(`button[aria-label="Usar o cadastro de ${original.nome}"]`))).click();
      await waitForTextGone(driver, "Já existe um devedor parecido");
      expect(await driver.findElement(BUSCA).getAttribute("value")).toBe(original.nome);
      await waitForText(driver, original.unidade);
    });
  });

  it("filtra por condomínio", async () => {
    const aqui = novoDevedor();
    const la = novoDevedor();
    await cadastrar(aqui.nome, aqui.unidade);
    await visit(driver, "/devedores");
    await waitForElement(driver, BUSCA);
    await cadastrar(la.nome, la.unidade, outroCondominio.id);

    await escolherCondominio("filtro-condominio", outroCondominio.id);
    await waitForTextGone(driver, aqui.nome);
    await waitForText(driver, la.nome);
  });

  it("edita um devedor", async () => {
    const { nome, unidade } = novoDevedor();
    await cadastrar(nome, unidade);

    await (await waitForElement(driver, By.css(`button[aria-label="Editar ${nome}"]`))).click();
    await waitForText(driver, "Editar devedor");
    expect(await driver.findElement(By.id("devedor-condominio")).isEnabled()).toBe(false);
    await replaceValue(driver.findElement(By.id("devedor-unidade")), `${unidade} novo`);
    await (await waitForButton(driver, "Salvar devedor")).click();

    await waitForText(driver, `Devedor ${nome} atualizado com sucesso.`);
    await driver.navigate().refresh();
    await (await waitForElement(driver, BUSCA)).sendKeys(nome);
    await waitForText(driver, `${unidade} novo`);
  });
});
