import { By, type WebDriver } from "selenium-webdriver";
import { visit, waitForElement, waitForHydration } from "./driver";

/** Sai de qualquer sessão anterior e deixa o navegador na tela de login. */
export async function openLogin(driver: WebDriver): Promise<void> {
  await visit(driver, "/login");
  await driver.executeScript("localStorage.clear(); sessionStorage.clear();");
  await visit(driver, "/login");
  await waitForElement(driver, By.id("email"));
}

export async function submitLogin(driver: WebDriver, email: string, password: string): Promise<void> {
  await waitForHydration(driver, await waitForElement(driver, By.id("email")));
  await driver.findElement(By.id("email")).sendKeys(email);
  await driver.findElement(By.id("senha")).sendKeys(password);
  await driver.findElement(By.css('button[type="submit"]')).click();
}
