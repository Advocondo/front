import { Browser, Builder, By, error, Key, until, WebDriver, WebElement, type Locator } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import firefox from "selenium-webdriver/firefox";
import { env } from "./env";

const ESPERA_MS = 10_000;

let pausaInstalada = false;

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Aplica `E2E_DELAY_MS` antes de abrir uma página, clicar e digitar, as ações que se veem na tela.
 * É feito uma vez, no próprio Selenium, para valer em todo teste sem cada um precisar lembrar.
 * As esperas de elementos não mudam, e um clique feito por script não pausa.
 *
 * O clique também espera o aviso de sucesso sair da frente: ele fica uns segundos no canto da
 * tela e cobre o que estiver embaixo (ver LACUNAS.md). Quem usa espera ou fecha o aviso.
 */
function instalarPausa(): void {
  if (pausaInstalada) return;
  pausaInstalada = true;
  const pausar = () => dormir(env.delayMs);

  const clicar = WebElement.prototype.click;
  WebElement.prototype.click = async function (this: WebElement) {
    await pausar();
    const limite = Date.now() + ESPERA_MS;
    for (;;) {
      try {
        return await clicar.call(this);
      } catch (e) {
        if (!(e instanceof error.ElementClickInterceptedError) || Date.now() > limite) throw e;
        await dormir(200);
      }
    }
  };
  const digitar = WebElement.prototype.sendKeys;
  WebElement.prototype.sendKeys = async function (this: WebElement, ...teclas: Parameters<WebElement["sendKeys"]>) {
    await pausar();
    return digitar.apply(this, teclas);
  };
  const abrir = WebDriver.prototype.get;
  WebDriver.prototype.get = async function (this: WebDriver, url: string) {
    await pausar();
    return abrir.call(this, url);
  };
}

/** Largura e altura de um celular comum, as dos protótipos mobile. */
export const CELULAR = { width: 390, height: 844 };

/**
 * O Selenium Manager baixa o driver compatível com o navegador instalado. `celular` emula a tela de
 * um celular: o Chrome sem janela não fica mais estreito que 500px, então mudar o tamanho não basta.
 */
export function createDriver({ celular = false }: { celular?: boolean } = {}): Promise<WebDriver> {
  instalarPausa();
  const builder = new Builder();
  if (env.browser === "firefox") {
    const options = new firefox.Options();
    if (env.headless) options.addArguments("-headless");
    options.windowSize(celular ? CELULAR : { width: 1440, height: 900 });
    return builder.forBrowser(Browser.FIREFOX).setFirefoxOptions(options).build();
  }
  const options = new chrome.Options();
  if (env.headless) options.addArguments("--headless=new");
  // O chromedriver espera { deviceMetrics }, que os tipos do selenium-webdriver não descrevem.
  if (celular) options.setMobileEmulation({ deviceMetrics: { ...CELULAR, pixelRatio: 2 } } as unknown as Parameters<chrome.Options["setMobileEmulation"]>[0]);
  else options.addArguments("--window-size=1440,900");
  return builder.forBrowser(Browser.CHROME).setChromeOptions(options).build();
}

/** Abre um caminho do front, como "/condominios". */
export function visit(driver: WebDriver, path: string): Promise<void> {
  return driver.get(new URL(path, env.baseUrl).href);
}

export function waitForElement(driver: WebDriver, locator: Locator): Promise<WebElement> {
  return driver.wait(until.elementLocated(locator), ESPERA_MS);
}

/** Espera um botão com este texto visível, para clicar nele. */
export function waitForButton(driver: WebDriver, texto: string): Promise<WebElement> {
  return waitForElement(driver, By.xpath(`//button[normalize-space()="${texto}"]`));
}

/**
 * O elemento mais interno que contém o texto inteiro, mesmo quando a tela o monta em partes, como
 * `Responsável: {nome}`. Ignora `script` e `style`: o Next guarda o texto da página em scripts, e
 * isso faria o teste achar um texto que a pessoa não vê.
 */
function comTexto(texto: string): Locator {
  const contem = `contains(normalize-space(.), "${texto}")`;
  return By.xpath(`//*[not(self::script or self::style) and ${contem} and not(*[${contem}])]`);
}

/** Espera este texto aparecer em algum elemento da página. */
export function waitForText(driver: WebDriver, texto: string): Promise<WebElement> {
  return waitForElement(driver, comTexto(texto));
}

/** Espera este texto sair da página, como a linha que a busca filtrou ou um diálogo fechado. */
export async function waitForTextGone(driver: WebDriver, texto: string): Promise<void> {
  await driver.wait(async () => {
    const achados = await driver.findElements(comTexto(texto));
    return achados.length === 0;
  }, ESPERA_MS);
}

/**
 * Espera a busca da tela terminar: toda linha da tabela contém o termo. Ver o termo na tela não basta,
 * porque a linha procurada já estava na lista completa, e o clique seguinte pegaria a primeira linha.
 */
export async function waitForFilteredRows(driver: WebDriver, termo: string): Promise<void> {
  await driver.wait(async () => {
    const linhas = await driver.findElements(By.css("main table tbody tr"));
    if (linhas.length === 0) return false;
    try {
      const textos = await Promise.all(linhas.map((linha) => linha.getText()));
      return textos.every((texto) => texto.includes(termo));
    } catch (e) {
      if (e instanceof error.StaleElementReferenceError) return false;
      throw e;
    }
  }, ESPERA_MS);
}

/** Clica procurando o elemento de novo a cada tentativa, para o caso de a tela redesenhá-lo no caminho. */
export async function clickFresh(driver: WebDriver, locator: Locator): Promise<void> {
  const limite = Date.now() + ESPERA_MS;
  for (;;) {
    try {
      await (await waitForElement(driver, locator)).click();
      return;
    } catch (e) {
      if (!(e instanceof error.StaleElementReferenceError) || Date.now() > limite) throw e;
    }
  }
}

/** Troca o conteúdo de um campo como o usuário faria, para o React receber os eventos. */
export async function replaceValue(element: WebElement, valor: string): Promise<void> {
  await element.sendKeys(Key.chord(Key.CONTROL, "a"), Key.BACK_SPACE);
  await element.sendKeys(valor);
}

/** Preenche um campo de data pelo valor ISO: digitar depende do idioma do navegador. */
export async function setDateValue(driver: WebDriver, element: WebElement, isoDate: string): Promise<void> {
  await driver.executeScript(
    `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(arguments[0], arguments[1]);
     arguments[0].dispatchEvent(new Event("input", { bubbles: true }));`,
    element,
    isoDate,
  );
}

/**
 * Espera o React assumir o elemento. Antes disso, o HTML do servidor já aparece, mas um
 * clique em "enviar" faria o envio nativo do formulário em vez de chamar o código da tela.
 */
export async function waitForHydration(driver: WebDriver, element: WebElement): Promise<void> {
  await driver.wait(
    () => driver.executeScript<boolean>("return Object.keys(arguments[0]).some((k) => k.startsWith('__reactProps'))", element),
    ESPERA_MS,
  );
}

/** Espera a navegação terminar no caminho indicado, inclusive por redirecionamento. */
export async function waitForPath(driver: WebDriver, path: string): Promise<void> {
  await driver.wait(until.urlIs(new URL(path, env.baseUrl).href), ESPERA_MS);
}
