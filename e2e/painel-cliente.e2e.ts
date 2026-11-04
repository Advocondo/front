import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, waitForElement, waitForPath, waitForText } from "./support/driver";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, createUser, linkCondominiums, type TestCondominium, type TestUser } from "./support/seed";

const VENCIDO = "2020-01-31";
const FUTURO = "2030-01-31";

// US37: https://advocondo.github.io/docs/historias/ep06-painel-cliente/#us37
describe("Painel do Cliente", () => {
  let driver: WebDriver;
  let cliente: TestUser;
  let vinculado: TestCondominium;
  let semVinculo: TestCondominium;
  const carimbo = Date.now();
  const atrasado = `E2E Atrasado ${carimbo}`;
  const emDia = `E2E Em Dia ${carimbo}`;
  const deOutro = `E2E De Outro ${carimbo}`;

  async function acordo(condominio: TestCondominium, nome: string, unidade: string, vencimento: string): Promise<void> {
    const devedor = await createDebtor(condominio.id, nome, unidade);
    await createAgreement(condominio.id, devedor.id, vencimento);
  }

  async function entrar(usuario: TestUser): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, usuario.email, usuario.password);
    await waitForPath(driver, "/painel-cliente");
  }

  const textoDaLinha = async (nome: string): Promise<string> => (await waitForElement(driver, By.xpath(`//tr[contains(., "${nome}")]`))).getText();

  beforeAll(async () => {
    driver = await createDriver();
    vinculado = await createCondominium(`E2E Painel Cliente ${carimbo}`);
    semVinculo = await createCondominium(`E2E Fora do Painel ${carimbo}`);
    await acordo(vinculado, atrasado, "101", VENCIDO);
    await acordo(vinculado, emDia, "102", FUTURO);
    await acordo(semVinculo, deOutro, "201", VENCIDO);
    cliente = await createUser("client");
    await linkCondominiums(cliente.id, [vinculado.id]);
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("US37-CA01: mostra só os acordos do condomínio vinculado", async () => {
    await entrar(cliente);
    await waitForText(driver, vinculado.name);
    await waitForText(driver, atrasado);
    const pagina = await driver.findElement(By.css("body")).getText();
    expect(pagina).not.toContain(deOutro);
    expect(pagina).not.toContain(semVinculo.name);
  });

  it("US37-CA02: mostra a situação simplificada, sem valores", async () => {
    await entrar(cliente);
    expect(await textoDaLinha(atrasado)).toContain("Atrasado");
    expect(await textoDaLinha(emDia)).toContain("Em dia");
    expect(await driver.findElement(By.css("body")).getText()).not.toMatch(/R\$|honor[aá]rio|comiss[aã]o/i);
  });

  it("US10-CA02: sem vínculo, a tela explica que não há acordos", async () => {
    await entrar(await createUser("client"));
    await waitForText(driver, "Nenhum acordo para mostrar");
  });
});
