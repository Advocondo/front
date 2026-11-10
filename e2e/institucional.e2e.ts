import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDriver, replaceValue, visit, waitForButton, waitForElement, waitForHydration, waitForPath, waitForText } from "./support/driver";
import { env } from "./support/env";
import { openLogin, submitLogin } from "./support/login";
import { apiToken, createUser, ensureAdmin, type TestUser } from "./support/seed";
import type { LandingContent } from "../app/_landing/types";

// Um PNG de 1x1 válido: o back confere o conteúdo, não só a extensão.
const PNG_MINIMO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// US04: https://advocondo.github.io/docs/historias/ep01-portal-autenticacao/#us04
describe("Conteúdo institucional", () => {
  let driver: WebDriver;
  let adminToken: string;
  let operador: TestUser;

  async function entrarComoAdmin() {
    await openLogin(driver);
    await submitLogin(driver, env.adminEmail, env.adminPassword);
    await waitForPath(driver, "/painel");
  }

  beforeAll(async () => {
    driver = await createDriver();
    adminToken = await ensureAdmin();
    operador = await createUser("operator");
  });

  afterAll(async () => {
    await driver?.quit();
  });

  beforeEach(entrarComoAdmin);

  it("US04-CA01: salva uma seção e publica a alteração na landing", async () => {
    const currentResponse = await fetch(`${env.apiUrl}/landing`, { cache: "no-store" });
    expect(currentResponse.ok).toBe(true);
    const current = await currentResponse.json() as LandingContent;
    const priorTitle = current.hero.title;
    const newTitle = `${priorTitle} E2E ${Date.now()}`;

    try {
      await visit(driver, "/institucional");
      const title = await waitForElement(driver, By.id("landing-hero-title"));
      await waitForHydration(driver, title);
      await replaceValue(title, newTitle);
      await (await waitForButton(driver, "Salvar seção")).click();
      await waitForText(driver, "foi salva");

      await visit(driver, "/");
      await waitForText(driver, newTitle);
      const published = await fetch(`${env.apiUrl}/landing`, { cache: "no-store" }).then((response) => response.json()) as LandingContent;
      expect(published.hero.title).toBe(newTitle);
    } finally {
      const restored = await fetch(`${env.apiUrl}/landing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ hero: { ...current.hero, title: priorTitle } }),
      });
      expect(restored.ok).toBe(true);
    }
  });

  it("envia a foto de um novo integrante e publica a equipe com ela", async () => {
    const current = await fetch(`${env.apiUrl}/landing`, { cache: "no-store" }).then((response) => response.json()) as LandingContent;
    const indice = current.team.members.length;
    const nome = `E2E Integrante ${Date.now()}`;
    const caminho = join(tmpdir(), `e2e-foto-${Date.now()}.png`);
    writeFileSync(caminho, PNG_MINIMO);

    try {
      await visit(driver, "/institucional");
      await waitForHydration(driver, await waitForElement(driver, By.id("landing-hero-title")));
      await (await waitForElement(driver, By.xpath('//nav[@aria-label="Seções do conteúdo institucional"]//button[normalize-space()="Equipe"]'))).click();
      await (await waitForButton(driver, "Adicionar integrante")).click();
      await waitForText(driver, "Não salva");
      await (await waitForElement(driver, By.id(`landing-team-members-${indice}-name`))).sendKeys(nome);
      await (await waitForElement(driver, By.id(`landing-team-members-${indice}-role`))).sendKeys("Estagiário");
      await (await waitForElement(driver, By.css(`input[aria-label="Enviar foto do integrante ${indice + 1}"]`))).sendKeys(caminho);
      await waitForElement(driver, By.css(`img[alt="Foto do integrante ${indice + 1}"]`));
      await (await waitForButton(driver, "Salvar seção")).click();
      await waitForText(driver, "foi salva");

      const published = await fetch(`${env.apiUrl}/landing`, { cache: "no-store" }).then((response) => response.json()) as LandingContent;
      const novo = published.team.members.find((member) => member.name === nome);
      expect(novo?.photo_id).toBeTruthy();
      expect((await fetch(`${env.apiUrl}/landing/images/${novo!.photo_id}`)).status).toBe(200);
      await visit(driver, "/");
      await waitForText(driver, nome);
    } finally {
      // Voltar a equipe ao que era: o back apaga a foto que ficou sem uso.
      const restored = await fetch(`${env.apiUrl}/landing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ team: current.team }),
      });
      expect(restored.ok).toBe(true);
    }
  });

  it("US04-CA02: outro perfil não acessa a tela e recebe 403 na API", async () => {
    await openLogin(driver);
    await submitLogin(driver, operador.email, operador.password);
    await waitForPath(driver, "/condominios");
    await visit(driver, "/institucional");
    await waitForPath(driver, "/condominios");

    const current = await fetch(`${env.apiUrl}/landing`, { cache: "no-store" }).then((response) => response.json()) as LandingContent;
    const response = await fetch(`${env.apiUrl}/landing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await apiToken(operador)}` },
      body: JSON.stringify({ hero: current.hero }),
    });
    expect(response.status).toBe(403);
  });
});
