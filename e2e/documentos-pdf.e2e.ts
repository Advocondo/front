import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, it } from "vitest";
import { createDriver, visit, waitForButton, waitForElement, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { apiToken, cancelAgreement, createAgreement, createCondominium, createDebtor, createUser, linkCondominiums, type TestUser } from "./support/seed";

// O conteúdo decide o tipo no back: basta o começo de um PDF de verdade.
const PDF_MINIMO = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n";

// US21 e US24: https://advocondo.github.io/docs/historias/ep03-cadastro-acordos/
describe("Documentos e PDF do acordo", () => {
  let driver: WebDriver;
  let acordo: string;
  let dono: TestUser;
  let semAcesso: TestUser;
  let linkDoPdf: string;

  async function entrar(email: string, senha: string, destino: string): Promise<void> {
    await openLogin(driver);
    await submitLogin(driver, email, senha);
    await waitForPath(driver, destino);
  }

  /** O navegador sem interface não guarda o arquivo: confere o que seria salvo. */
  async function vigiarDownloads(): Promise<void> {
    await driver.executeScript(`
      window.__arquivos = [];
      const original = URL.createObjectURL;
      URL.createObjectURL = (arquivo) => { window.__arquivos.push(arquivo.type); return original.call(URL, arquivo); };
    `);
  }

  beforeAll(async () => {
    driver = await createDriver();
    const condominio = await createCondominium(`E2E Documentos ${Date.now()}`);
    const devedor = await createDebtor(condominio.id, `E2E Documentos ${Date.now()}`, "101");
    acordo = (await createAgreement(condominio.id, devedor.id)).id;
    dono = await createUser("client");
    await linkCondominiums(dono.id, [condominio.id]);
    semAcesso = await createUser("client");
    await entrar(env.adminEmail, env.adminPassword, "/painel");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  it("US21-CA01: anexa um arquivo, e ele aparece para baixar", async () => {
    const caminho = join(tmpdir(), `e2e-termo-${Date.now()}.pdf`);
    writeFileSync(caminho, PDF_MINIMO);
    await visit(driver, `/acordos/${acordo}`);
    await (await waitForElement(driver, By.css('input[aria-label="Arquivo do documento"]'))).sendKeys(caminho);
    await waitForText(driver, "anexado com sucesso.");
    await vigiarDownloads();
    await (await waitForElement(driver, By.css('button[aria-label^="Baixar e2e-termo"]'))).click();
    await driver.wait(async () => (await driver.executeScript<string[]>("return window.__arquivos")).length === 1, 10_000);
  });

  it("recusa um arquivo que não é PDF, PNG nem JPEG", async () => {
    const caminho = join(tmpdir(), `e2e-falso-${Date.now()}.pdf`);
    writeFileSync(caminho, "isto não é um pdf");
    await visit(driver, `/acordos/${acordo}`);
    await (await waitForElement(driver, By.css('input[aria-label="Arquivo do documento"]'))).sendKeys(caminho);
    await waitForText(driver, "Tipo de arquivo não aceito");
  });

  it("US24-CA01 e CA02: gera o PDF, e o download traz um PDF", async () => {
    await visit(driver, `/acordos/${acordo}`);
    await (await waitForButton(driver, "Gerar PDF")).click();
    await waitForText(driver, "PDF gerado com sucesso.");
    await vigiarDownloads();
    await (await waitForElement(driver, By.css('button[aria-label^="Baixar acordo-"]'))).click();
    await driver.wait(async () => (await driver.executeScript<string[]>("return window.__arquivos")).includes("application/pdf"), 10_000);

    const resposta = await fetch(`${env.apiUrl}/agreements/${acordo}/pdfs`, { headers: { Authorization: `Bearer ${await apiToken(dono)}` } });
    const [pdf] = (await resposta.json()) as { id: string }[];
    linkDoPdf = `/pdf/${acordo}/${pdf.id}`;
  });

  it("US24-CA03: o link abre para o Cliente do condomínio", async () => {
    await entrar(dono.email, dono.password, "/painel-cliente");
    await visit(driver, linkDoPdf);
    await waitForButton(driver, "Baixar PDF");
  });

  it("US24-CA03: o link não abre para outro Cliente", async () => {
    await entrar(semAcesso.email, semAcesso.password, "/painel-cliente");
    await visit(driver, linkDoPdf);
    await waitForText(driver, "PDF não encontrado");
  });

  it("sem sessão, o link leva ao login", async () => {
    await (await waitForElement(driver, By.xpath('//a[normalize-space()="Ir para a tela inicial"]'))).click();
    await (await waitForElement(driver, By.xpath('//button[contains(normalize-space(), "Sair")]'))).click();
    await waitForPath(driver, "/login");
    await visit(driver, linkDoPdf);
    await waitForPath(driver, "/login");
  });

  it("US21-CA02: os documentos continuam depois do cancelamento", async () => {
    await cancelAgreement(acordo);
    await entrar(env.adminEmail, env.adminPassword, "/painel");
    await visit(driver, `/acordos/${acordo}`);
    await waitForText(driver, "Acordo cancelado");
    await waitForElement(driver, By.css('button[aria-label^="Baixar e2e-termo"]'));
  });
});
