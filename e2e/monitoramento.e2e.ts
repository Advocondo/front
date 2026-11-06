import { createServer, type Server } from "node:http";
import { By, type WebDriver } from "selenium-webdriver";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriver, visit, waitForElement } from "./support/driver";

const SEGREDO = "E2E-TOKEN-SECRETO";
const PORTA = process.env.E2E_SENTRY_PORTA;

// #43. Sem E2E_SENTRY_PORTA, confere que nada sai. Com ela, recebe os eventos em um servidor falso:
// ver "Monitoramento" em e2e/README.md. Nunca aponte para um Sentry de verdade.
describe("Monitoramento de erros", () => {
  let driver: WebDriver;
  let coletor: Server | undefined;
  const recebidos: string[] = [];

  beforeAll(async () => {
    driver = await createDriver();
    if (!PORTA) return;
    coletor = createServer((pedido, resposta) => {
      const partes: Buffer[] = [];
      pedido.on("data", (parte: Buffer) => partes.push(parte));
      pedido.on("end", () => {
        recebidos.push(Buffer.concat(partes).toString("utf8"));
        resposta.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" });
        resposta.end("{}");
      });
    });
    await new Promise<void>((pronto) => coletor?.listen(Number(PORTA), pronto));
  });

  afterAll(async () => {
    await driver?.quit();
    coletor?.close();
  });

  async function dispararErro(tipo: "erro" | "promessa", mensagem: string): Promise<void> {
    await visit(driver, `/redefinir-senha?token=${SEGREDO}`);
    await waitForElement(driver, By.id("nova-senha"));
    // Por uma tag script, como o código da página: pelo canal do Selenium, o navegador pode tratar a
    // rejeição como vinda de fora, e o evento que o Sentry escuta não dispara.
    const codigo = tipo === "erro" ? `setTimeout(() => { throw new Error(${JSON.stringify(mensagem)}); }, 0);` : `Promise.reject(new Error(${JSON.stringify(mensagem)}));`;
    await driver.executeScript("const tag = document.createElement('script'); tag.textContent = arguments[0]; document.head.appendChild(tag);", codigo);
  }

  it.runIf(!PORTA)("sem DSN, nada é enviado", async () => {
    await dispararErro("erro", "e2e sem dsn");
    await driver.sleep(1500);
    const envios = await driver.executeScript<string[]>("return performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes('/envelope/'));");
    expect(envios).toEqual([]);
  });

  it.runIf(PORTA).each([
    ["erro" as const, "e2e erro nao tratado"],
    ["promessa" as const, "e2e promessa rejeitada"],
  ])("com DSN, %s chega ao coletor, sem o token do endereço", async (tipo, mensagem) => {
    await dispararErro(tipo, mensagem);
    await driver.wait(() => recebidos.some((corpo) => corpo.includes(mensagem)), 15_000);
    expect(recebidos.join("\n")).not.toContain(SEGREDO);
    // A página fica no endereço, sem o que vem depois do "?".
    expect(recebidos.join("\n")).toContain("/redefinir-senha");
  });
});
