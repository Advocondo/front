import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cnpjCheckDigits } from "../app/(equipe)/condominios/validation";
import { createDriver, replaceValue, visit, waitForButton, waitForElement, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { ensureAdmin } from "./support/seed";

const BUSCA = By.css('input[aria-label="Buscar condomínio ou síndico"]');

/** CNPJ válido e novo a cada chamada: o back recusa CNPJ repetido, e o banco de teste não é limpo. */
let sequencia = 0;
function novoCnpj(): string {
  sequencia += 1;
  const base = `${Date.now()}${sequencia}`.slice(-12).padStart(12, "0");
  return `${base}${cnpjCheckDigits(base)}`;
}

// US12: https://advocondo.github.io/docs/historias/ep03-cadastro-acordos/#us12
describe("Condomínios", () => {
  let driver: WebDriver;

  async function abrirNovoCondominio(nome: string, cnpj: string): Promise<void> {
    await (await waitForButton(driver, "Novo condomínio")).click();
    await (await waitForElement(driver, By.id("nome"))).sendKeys(nome);
    await driver.findElement(By.id("cnpj")).sendKeys(cnpj);
  }

  async function salvar(): Promise<void> {
    await (await waitForButton(driver, "Salvar condomínio")).click();
  }

  async function cadastrar(nome: string, cnpj = novoCnpj()): Promise<void> {
    await abrirNovoCondominio(nome, cnpj);
    await salvar();
    await waitForText(driver, `Condomínio ${nome} criado com sucesso.`);
  }

  beforeAll(async () => {
    await ensureAdmin();
    driver = await createDriver();
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/condominios");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await visit(driver, "/condominios");
    await waitForElement(driver, BUSCA);
  });

  it("com sessão, a home redireciona para a tela de condomínios", async () => {
    await visit(driver, "/");
    await waitForPath(driver, "/condominios");
  });

  it("mostra a barra lateral, o título e a busca", async () => {
    const texto = await driver.findElement(By.css("body")).getText();
    expect(texto).toContain("Advocondo");
    expect(texto).toContain("Carteira de clientes assessorados");
  });

  it("cadastra um condomínio, que continua na lista depois de recarregar", async () => {
    const nome = `E2E Cadastro ${Date.now()}`;
    await abrirNovoCondominio(nome, novoCnpj());
    await driver.findElement(By.id("cidade")).sendKeys("Brasília");
    await driver.findElement(By.id("sindico_nome")).sendKeys("Marcos Tavares");
    await salvar();
    await waitForText(driver, `Condomínio ${nome} criado com sucesso.`);

    await driver.navigate().refresh();
    await (await waitForElement(driver, BUSCA)).sendKeys(nome);
    await waitForText(driver, "Marcos Tavares");
    await waitForText(driver, "Brasília");
  });

  it("busca por parte do nome e esconde os outros condomínios", async () => {
    const marca = Date.now();
    const procurado = `E2E Busca Procurado ${marca}`;
    const outro = `E2E Busca Outro ${marca}`;
    await cadastrar(procurado);
    await visit(driver, "/condominios");
    await cadastrar(outro);

    await (await waitForElement(driver, BUSCA)).sendKeys(`Procurado ${marca}`);
    await waitForTextGone(driver, outro);
    await waitForText(driver, procurado);
  });

  it("US12-CA02: edita um condomínio já cadastrado, como na troca de administradora", async () => {
    const nome = `E2E Edição ${Date.now()}`;
    await cadastrar(nome);

    await (await waitForElement(driver, By.css(`button[aria-label="Editar ${nome}"]`))).click();
    await waitForText(driver, "Editar condomínio");
    expect(await driver.findElement(By.id("nome")).getAttribute("value")).toBe(nome);
    await replaceValue(driver.findElement(By.id("sindico_nome")), "Nova Administradora");
    await salvar();

    await waitForText(driver, `Condomínio ${nome} atualizado com sucesso.`);
    await driver.navigate().refresh();
    await (await waitForElement(driver, BUSCA)).sendKeys(nome);
    await waitForText(driver, "Nova Administradora");
  });

  it("recusa um CNPJ já cadastrado e mostra o erro no diálogo", async () => {
    const cnpj = novoCnpj();
    await cadastrar(`E2E CNPJ Original ${Date.now()}`, cnpj);

    await visit(driver, "/condominios");
    await abrirNovoCondominio(`E2E CNPJ Repetido ${Date.now()}`, cnpj);
    await salvar();

    await waitForText(driver, "Já existe um condomínio com este CNPJ.");
    await waitForButton(driver, "Salvar condomínio");
  });

  it("não envia o formulário com CNPJ inválido", async () => {
    await abrirNovoCondominio(`E2E CNPJ Inválido ${Date.now()}`, "11222333000199");
    await salvar();
    await waitForText(driver, "CNPJ inválido.");
  });
});
