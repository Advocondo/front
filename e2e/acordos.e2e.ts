import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, replaceValue, setDateValue, visit, waitForButton, waitForElement, waitForPath, waitForText, waitForTextGone } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { createAgreement, createCondominium, createDebtor, createLawyer, type TestCondominium, type TestDebtor, type TestLawyer } from "./support/seed";

const BUSCA = By.css('input[aria-label="Buscar por devedor, condomínio ou responsável"]');

// US15, US16 e US17: https://advocondo.github.io/docs/historias/ep03-cadastro-acordos/
describe("Acordos", () => {
  let driver: WebDriver;
  let condominio: TestCondominium;
  let advogado: TestLawyer;
  let sequencia = 0;

  /** Cada teste usa um devedor próprio, para achar o seu acordo pela busca. */
  async function novoDevedor(): Promise<TestDebtor> {
    sequencia += 1;
    return createDebtor(condominio.id, `E2E Acordo ${Date.now()}${sequencia}`, `Unidade ${Date.now()}${sequencia}`);
  }

  async function escolher(selectId: string, valor: string): Promise<void> {
    await (await waitForElement(driver, By.css(`#${selectId} option[value="${valor}"]`))).click();
  }

  async function preencherNovoAcordo(devedor: TestDebtor, valores = { total: "550000", percentual: "20", parcelas: "10" }): Promise<void> {
    await (await waitForButton(driver, "Novo acordo")).click();
    await escolher("acordo-condominio", condominio.id);
    await escolher("acordo-devedor", devedor.id);
    await driver.findElement(By.id("acordo-total")).sendKeys(valores.total);
    await driver.findElement(By.id("acordo-honorarios")).sendKeys(valores.percentual);
    await driver.findElement(By.id("acordo-parcelas")).sendKeys(valores.parcelas);
    await setDateValue(driver, await driver.findElement(By.id("acordo-vencimento")), "2030-01-31");
  }

  async function salvarAcordo(devedor: TestDebtor): Promise<void> {
    await (await waitForButton(driver, "Salvar acordo")).click();
    await waitForText(driver, `Acordo de ${devedor.name} cadastrado com sucesso.`);
  }

  /** Cadastra e abre o detalhe. */
  async function abrirAcordoNovo(devedor: TestDebtor, valores?: { total: string; percentual: string; parcelas: string }): Promise<void> {
    await preencherNovoAcordo(devedor, valores);
    await salvarAcordo(devedor);
    await (await waitForElement(driver, By.css(`button[aria-label="Ver o acordo de ${devedor.name}"]`))).click();
    await waitForText(driver, "Detalhes do acordo");
    await waitForElement(driver, By.css('button[aria-label="Editar parcela 1"]'));
  }

  /** O texto das células da linha de uma parcela. */
  async function linhaDaParcela(numero: number, total: number): Promise<string> {
    return driver.findElement(By.xpath(`//tr[td[normalize-space()="${numero}/${total}"]]`)).getText();
  }

  beforeAll(async () => {
    condominio = await createCondominium(`E2E Acordos ${Date.now()}`);
    advogado = await createLawyer(`E2E Advogada ${Date.now()}`);
    driver = await createDriver();
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(async () => {
    await visit(driver, "/acordos");
    await waitForElement(driver, BUSCA);
  });

  it("US15-CA01 e CA03: cadastra, e o acordo aparece nos ativos, vinculado ao condomínio", async () => {
    const devedor = await novoDevedor();
    await preencherNovoAcordo(devedor);
    await salvarAcordo(devedor);

    await driver.navigate().refresh();
    await (await waitForElement(driver, BUSCA)).sendKeys(devedor.name);
    await waitForText(driver, `${condominio.name} · ${devedor.unit}`);
    await waitForText(driver, "R$ 5.500,00");
  });

  describe("US22: buscar e filtrar", () => {
    async function acordoCom(condominioId: string): Promise<TestDebtor> {
      sequencia += 1;
      const devedor = await createDebtor(condominioId, `E2E Busca ${Date.now()}${sequencia}`, `Unidade ${Date.now()}${sequencia}`);
      await createAgreement(condominioId, devedor.id);
      return devedor;
    }

    it("CA01: encontra por parte do nome do devedor", async () => {
      const procurado = await acordoCom(condominio.id);
      const outro = await acordoCom(condominio.id);
      await driver.navigate().refresh();
      await (await waitForElement(driver, BUSCA)).sendKeys(procurado.name.slice(9));
      await waitForTextGone(driver, outro.name);
      await waitForText(driver, procurado.name);
    });

    it("CA02: combina condomínio, status e responsável", async () => {
      const outroCondominio = await createCondominium(`E2E Busca Outro ${Date.now()}`);
      const aqui = await acordoCom(condominio.id);
      const la = await acordoCom(outroCondominio.id);
      await driver.navigate().refresh();
      await waitForText(driver, aqui.name);

      await (await waitForElement(driver, By.css(`#filtro-condominio option[value="${outroCondominio.id}"]`))).click();
      await waitForTextGone(driver, aqui.name);
      await waitForText(driver, la.name);

      await (await waitForElement(driver, By.xpath('//button[normalize-space()="Cancelados"]'))).click();
      await waitForTextGone(driver, la.name);
      await waitForText(driver, "Nenhum acordo encontrado");

      await (await waitForElement(driver, By.xpath('//button[normalize-space()="Ativos"]'))).click();
      await waitForText(driver, la.name);
      await (await waitForElement(driver, By.css(`#filtro-responsavel option[value="${advogado.id}"]`))).click();
      await waitForTextGone(driver, la.name);
    });
  });

  it("US15-CA02: não salva sem os campos obrigatórios", async () => {
    await (await waitForButton(driver, "Novo acordo")).click();
    await (await waitForButton(driver, "Salvar acordo")).click();
    await waitForText(driver, "Selecione o condomínio.");
    await waitForText(driver, "Informe o valor total da dívida.");
    await waitForButton(driver, "Salvar acordo");
  });

  it("US16-CA01: a prévia separa condomínio e honorários por parcela", async () => {
    await preencherNovoAcordo(await novoDevedor());
    await waitForText(driver, "10 parcelas de R$ 550,00");
    await waitForText(driver, "R$ 440,00 para o condomínio + R$ 110,00 de honorários");
  });

  it("atribui o advogado responsável escolhido no cadastro", async () => {
    const devedor = await novoDevedor();
    await preencherNovoAcordo(devedor);
    await escolher("acordo-advogado", advogado.id);
    await salvarAcordo(devedor);
    await (await waitForElement(driver, BUSCA)).sendKeys(devedor.name);
    await waitForText(driver, advogado.name);
  });

  it("cadastra um devedor novo sem sair do formulário", async () => {
    sequencia += 1;
    const nome = `E2E Devedor Novo ${Date.now()}${sequencia}`;
    await (await waitForButton(driver, "Novo acordo")).click();
    await escolher("acordo-condominio", condominio.id);
    await (await waitForButton(driver, "Cadastrar novo devedor")).click();
    await (await waitForElement(driver, By.id("devedor-nome"))).sendKeys(nome);
    await driver.findElement(By.id("devedor-unidade")).sendKeys(`Unidade ${Date.now()}${sequencia}`);
    await driver.findElement(By.id("devedor-telefone")).sendKeys("61912345678");
    await (await waitForButton(driver, "Salvar devedor")).click();

    await waitForTextGone(driver, "Nome completo");
    await driver.wait(async () => {
      const valor = await driver.findElement(By.id("acordo-devedor")).getAttribute("value");
      return valor !== "";
    }, 10_000);
  });

  it("US16 e US17-CA01: o detalhe mostra a divisão e os vencimentos mensais", async () => {
    await abrirAcordoNovo(await novoDevedor());
    const primeira = await linhaDaParcela(1, 10);
    expect(primeira).toContain("31/01/2030");
    expect(primeira).toContain("R$ 550,00");
    expect(primeira).toContain("R$ 440,00");
    expect(primeira).toContain("R$ 110,00");
    // Fevereiro não tem dia 31: vence no último dia do mês.
    expect(await linhaDaParcela(2, 10)).toContain("28/02/2030");
    await waitForText(driver, "R$ 4.400,00");
  });

  it("US17-CA02: os centavos que sobram vão para a última parcela", async () => {
    await abrirAcordoNovo(await novoDevedor(), { total: "10000", percentual: "10", parcelas: "3" });
    expect(await linhaDaParcela(1, 3)).toContain("R$ 33,33");
    expect(await linhaDaParcela(2, 3)).toContain("R$ 33,33");
    expect(await linhaDaParcela(3, 3)).toContain("R$ 33,34");
  });

  describe("US17-CA03: edição de uma parcela", () => {
    it("mudar o valor passa a diferença para as parcelas seguintes", async () => {
      await abrirAcordoNovo(await novoDevedor(), { total: "90000", percentual: "10", parcelas: "3" });
      await driver.findElement(By.css('button[aria-label="Editar parcela 1"]')).click();
      await replaceValue(await waitForElement(driver, By.id("parcela-valor")), "40000");
      await (await waitForButton(driver, "Salvar parcela")).click();

      await waitForText(driver, "Parcela atualizada com sucesso.");
      expect(await linhaDaParcela(1, 3)).toContain("R$ 400,00");
      expect(await linhaDaParcela(2, 3)).toContain("R$ 250,00");
      expect(await linhaDaParcela(3, 3)).toContain("R$ 250,00");
      await waitForText(driver, "R$ 900,00");
    });

    it("muda o vencimento só da parcela editada", async () => {
      await abrirAcordoNovo(await novoDevedor(), { total: "90000", percentual: "10", parcelas: "3" });
      await driver.findElement(By.css('button[aria-label="Editar parcela 2"]')).click();
      await setDateValue(driver, await waitForElement(driver, By.id("parcela-vencimento")), "2030-03-05");
      await (await waitForButton(driver, "Salvar parcela")).click();

      await waitForText(driver, "Parcela atualizada com sucesso.");
      expect(await linhaDaParcela(2, 3)).toContain("05/03/2030");
      expect(await linhaDaParcela(1, 3)).toContain("31/01/2030");
    });

    it("recusa mudar o valor da última parcela, que não tem seguinte para absorver", async () => {
      await abrirAcordoNovo(await novoDevedor(), { total: "90000", percentual: "10", parcelas: "2" });
      await driver.findElement(By.css('button[aria-label="Editar parcela 2"]')).click();
      await replaceValue(await waitForElement(driver, By.id("parcela-valor")), "10000");
      await (await waitForButton(driver, "Salvar parcela")).click();
      await waitForText(driver, "Não há parcela seguinte");
    });
  });
});
