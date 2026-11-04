import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, replaceValue, setDateValue, visit, waitForButton, waitForElement, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, createUser, type TestCondominium, type TestUser } from "./support/seed";

const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const hojeNaTela = hoje.split("-").reverse().join("/");
/** Um dia do mês passado, para a parcela vencer antes de hoje. */
const [anoAtual, mesAtual] = hoje.split("-").map(Number);
const mesPassado = mesAtual === 1 ? `${anoAtual - 1}-12-15` : `${anoAtual}-${String(mesAtual - 1).padStart(2, "0")}-15`;

// US25, US26 e US28: https://advocondo.github.io/docs/historias/ep04-parcelas/
describe("Faturas do mês", () => {
  let driver: WebDriver;
  let condominio: TestCondominium;
  let operador: TestUser;
  let sequencia = 0;

  /** Cada teste tem um devedor próprio com um acordo de 3 parcelas de R$ 300,00. */
  async function novaFatura(primeiroVencimento = hoje, condominioId = condominio.id): Promise<string> {
    sequencia += 1;
    const nome = `E2E Fatura ${Date.now()}${sequencia}`;
    const devedor = await createDebtor(condominioId, nome, `Unidade ${Date.now()}${sequencia}`);
    await createAgreement(condominioId, devedor.id, primeiroVencimento);
    return nome;
  }

  const linha = (nome: string) => waitForElement(driver, By.xpath(`//tr[.//a[normalize-space()="${nome}"]]`));

  async function abrirBaixa(nome: string): Promise<void> {
    await (await waitForElement(driver, By.css(`button[aria-label="Dar baixa na parcela 1 de ${nome}"]`))).click();
    await waitForElement(driver, By.id("baixa-valor"));
  }

  async function confirmar(): Promise<void> {
    await (await waitForButton(driver, "Confirmar pagamento")).click();
  }

  async function abrirPagamentos(nome: string): Promise<void> {
    await (await waitForElement(driver, By.css(`button[aria-label="Pagamentos da parcela 1 de ${nome}"]`))).click();
    await waitForText(driver, "Pagamentos da parcela 1");
  }

  async function entrar(email: string, senha: string): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, email, senha);
    await waitForPath(driver, email === env.adminEmail ? "/painel" : "/condominios");
  }

  beforeAll(async () => {
    condominio = await createCondominium(`E2E Faturas ${Date.now()}`);
    operador = await createUser("operator");
    driver = await createDriver();
    await entrar(env.adminEmail, env.adminPassword);
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await visit(driver, "/acompanhamento");
    await waitForElement(driver, By.id("filtro-condominio"));
  });

  it("a barra lateral leva às faturas do mês", async () => {
    await visit(driver, "/condominios");
    await (await waitForElement(driver, By.xpath('//nav//*[normalize-space()="Faturas do mês"]'))).click();
    await waitForPath(driver, "/acompanhamento");
  });

  it("US25-CA01: lista o devedor, o condomínio, o valor e a situação", async () => {
    const nome = await novaFatura();
    await driver.navigate().refresh();
    const texto = await (await linha(nome)).getText();
    expect(texto).toContain(condominio.name);
    expect(texto).toContain("R$ 300,00");
    expect(texto).toContain("Em aberto");
  });

  it("US25-CA02: filtra por condomínio", async () => {
    const outro = await createCondominium(`E2E Faturas Outro ${Date.now()}`);
    const aqui = await novaFatura();
    const la = await novaFatura(hoje, outro.id);
    await driver.navigate().refresh();
    await linha(aqui);
    await (await waitForElement(driver, By.css(`#filtro-condominio option[value="${outro.id}"]`))).click();
    await waitForTextGone(driver, aqui);
    await linha(la);
  });

  it("US25-CA02 e US27: a parcela vencida aparece como atrasada no mês dela, e na aba", async () => {
    const nome = await novaFatura(mesPassado);
    await (await waitForElement(driver, By.css('button[aria-label="Mês anterior"]'))).click();
    expect(await (await linha(nome)).getText()).toContain("Atrasada");
    await (await waitForElement(driver, By.xpath('//button[contains(normalize-space(), "Pagas")]'))).click();
    await waitForTextGone(driver, nome);
    await (await waitForElement(driver, By.xpath('//button[contains(normalize-space(), "Atrasadas")]'))).click();
    await linha(nome);
  });

  it("US26-CA01: dar baixa marca a parcela como paga, com a data informada", async () => {
    const nome = await novaFatura();
    await driver.navigate().refresh();
    await abrirBaixa(nome);
    await confirmar();

    await waitForText(driver, "Baixa registrada com sucesso.");
    await driver.navigate().refresh();
    const texto = await (await linha(nome)).getText();
    expect(texto).toContain("Paga");
    expect(texto).toContain(`pago em ${hojeNaTela}`);
  });

  it("US26: não aceita data futura", async () => {
    const nome = await novaFatura();
    await driver.navigate().refresh();
    await abrirBaixa(nome);
    await setDateValue(driver, await driver.findElement(By.id("baixa-data")), "2099-01-01");
    await confirmar();
    await waitForText(driver, "A data do pagamento não pode ser futura.");
  });

  it("US28: pagamento parcial mantém o saldo em aberto e fica no histórico", async () => {
    const nome = await novaFatura();
    await driver.navigate().refresh();
    await abrirBaixa(nome);
    await replaceValue(await driver.findElement(By.id("baixa-valor")), "10000");
    await waitForText(driver, "Saldo de R$ 200,00 continua em aberto");
    await confirmar();

    await waitForText(driver, "Pagamento parcial registrado com sucesso.");
    await driver.navigate().refresh();
    const texto = await (await linha(nome)).getText();
    expect(texto).toContain("Parcial");
    expect(texto).toContain("saldo R$ 200,00");

    await abrirPagamentos(nome);
    await waitForText(driver, "R$ 100,00");
    await waitForText(driver, "Saldo em aberto: R$ 200,00");
    await (await waitForButton(driver, "Fechar")).click();

    await abrirBaixa(nome);
    expect(await driver.findElement(By.id("baixa-valor")).getAttribute("value")).toBe("200,00");
    await confirmar();
    await waitForText(driver, "Baixa registrada com sucesso.");
    await driver.navigate().refresh();
    expect(await (await linha(nome)).getText()).toContain("Paga");
  });

  it("recusa pagar mais que o saldo", async () => {
    const nome = await novaFatura();
    await driver.navigate().refresh();
    await abrirBaixa(nome);
    await replaceValue(await driver.findElement(By.id("baixa-valor")), "30001");
    await confirmar();
    await waitForText(driver, "O valor pago passa do saldo de R$ 300,00.");
  });

  describe("US26-CA02: correção e estorno", () => {
    async function faturaPaga(): Promise<string> {
      const nome = await novaFatura();
      await driver.navigate().refresh();
      await abrirBaixa(nome);
      await confirmar();
      await waitForText(driver, "Baixa registrada com sucesso.");
      return nome;
    }

    it("o Administrador estorna, com confirmação, e a parcela volta a ficar em aberto", async () => {
      const nome = await faturaPaga();
      await abrirPagamentos(nome);
      await (await waitForButton(driver, "Estornar pagamentos")).click();
      await (await waitForButton(driver, "Confirmar estorno")).click();
      await waitForText(driver, "Pagamentos estornados com sucesso.");
      await driver.navigate().refresh();
      expect(await (await linha(nome)).getText()).toContain("Em aberto");
    });

    it("o Administrador corrige a data da baixa", async () => {
      const nome = await faturaPaga();
      await abrirPagamentos(nome);
      await setDateValue(driver, await waitForElement(driver, By.id("correcao-data")), mesPassado);
      await (await waitForButton(driver, "Corrigir data")).click();
      await waitForText(driver, "Data da baixa corrigida com sucesso.");
      await driver.navigate().refresh();
      expect(await (await linha(nome)).getText()).toContain(`pago em ${mesPassado.split("-").reverse().join("/")}`);
    });

    it("a Equipe Operacional não vê a correção nem o estorno", async () => {
      const nome = await faturaPaga();
      await entrar(operador.email, operador.password);
      await visit(driver, "/acompanhamento");
      await abrirPagamentos(nome);
      await waitForText(driver, "Parcela quitada.");
      expect(await driver.findElements(By.xpath('//button[normalize-space()="Estornar pagamentos"]'))).toHaveLength(0);
      expect(await driver.findElements(By.id("correcao-data"))).toHaveLength(0);
      await entrar(env.adminEmail, env.adminPassword);
    });
  });

  it("o detalhe do acordo também registra a baixa", async () => {
    const nome = await novaFatura();
    await driver.navigate().refresh();
    await (await waitForElement(driver, By.xpath(`//a[normalize-space()="${nome}"]`))).click();
    await (await waitForElement(driver, By.css(`button[aria-label="Dar baixa na parcela 1 de ${nome}"]`))).click();
    await waitForElement(driver, By.id("baixa-valor"));
    await confirmar();
    await waitForText(driver, "Baixa registrada com sucesso.");
    await waitForText(driver, "1 de 3 parcelas pagas (33%)");
  });
});
