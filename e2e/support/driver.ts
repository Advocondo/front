import { Browser, Builder, By, Key, until, type Locator, type WebDriver, type WebElement } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import firefox from "selenium-webdriver/firefox";
import { env } from "./env";

const ESPERA_MS = 10_000;

/** O Selenium Manager baixa o driver compatível com o navegador instalado. */
export function createDriver(): Promise<WebDriver> {
  const builder = new Builder();
  if (env.browser === "firefox") {
    const options = new firefox.Options();
    if (env.headless) options.addArguments("-headless");
    return builder.forBrowser(Browser.FIREFOX).setFirefoxOptions(options).build();
  }
  const options = new chrome.Options();
  if (env.headless) options.addArguments("--headless=new");
  options.addArguments("--window-size=1440,900");
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

/** Espera este texto aparecer em algum elemento da página. */
export function waitForText(driver: WebDriver, texto: string): Promise<WebElement> {
  return waitForElement(driver, By.xpath(`//*[contains(normalize-space(text()), "${texto}")]`));
}

/** Espera este texto sair da página, como a linha que a busca filtrou ou um diálogo fechado. */
export async function waitForTextGone(driver: WebDriver, texto: string): Promise<void> {
  await driver.wait(async () => {
    const achados = await driver.findElements(By.xpath(`//*[contains(normalize-space(text()), "${texto}")]`));
    return achados.length === 0;
  }, ESPERA_MS);
}

/** Troca o conteúdo de um campo como o usuário faria, para o React receber os eventos. */
export async function replaceValue(element: WebElement, valor: string): Promise<void> {
  await element.sendKeys(Key.chord(Key.CONTROL, "a"), Key.BACK_SPACE);
  await element.sendKeys(valor);
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
