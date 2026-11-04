import { Browser, Builder, until, type Locator, type WebDriver, type WebElement } from "selenium-webdriver";
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
