import { describe, expect, it } from "vitest";
import { limparEvento, limparTrilha, opcoesDoSentry, semConsulta } from "./monitoramento";

const SEGREDO = "tok3n-s3creto";

describe("semConsulta", () => {
  it.each([
    [`https://site/convite?token=${SEGREDO}`, "https://site/convite"],
    [`https://site/redefinir-senha?token=${SEGREDO}#x`, "https://site/redefinir-senha"],
    ["https://site/painel#parte", "https://site/painel"],
    ["https://site/painel", "https://site/painel"],
  ])("%s", (entrada, saida) => {
    expect(semConsulta(entrada)).toBe(saida);
  });
});

describe("limparEvento", () => {
  it("tira a consulta do endereço e os dados da requisição", () => {
    const evento = limparEvento({ request: { url: `https://site/convite?token=${SEGREDO}`, query_string: `token=${SEGREDO}`, cookies: { a: "b" }, headers: { Authorization: "Bearer x", Referer: `https://site/?token=${SEGREDO}` }, data: { senha: "x" } } });
    expect(evento.request).toEqual({ url: "https://site/convite" });
  });

  it("tira a consulta de endereços citados em mensagens de erro e na pilha", () => {
    const evento = limparEvento({
      message: `falhou em https://api/debtors?search=Maria`,
      transaction: `/convite?token=${SEGREDO}`,
      exception: { values: [{ value: `erro em /redefinir-senha?token=${SEGREDO} agora`, stacktrace: { frames: [{ abs_path: `https://site/a.js?token=${SEGREDO}`, filename: `https://site/a.js?token=${SEGREDO}` }] } }] },
    });
    expect(JSON.stringify(evento)).not.toContain(SEGREDO);
    expect(JSON.stringify(evento)).not.toContain("Maria");
    expect(evento.message).toBe("falhou em https://api/debtors");
    expect(evento.exception?.values?.[0].value).toBe("erro em /redefinir-senha agora");
  });

  it("limpa e filtra as trilhas que já estavam no evento", () => {
    const evento = limparEvento({ breadcrumbs: [{ category: "console", message: "Maria" }, { category: "navigation", data: { from: `/convite?token=${SEGREDO}`, to: "/painel" } }] });
    expect(evento.breadcrumbs).toEqual([{ category: "navigation", data: { from: "/convite", to: "/painel" } }]);
  });

  it("não quebra um evento sem esses campos", () => {
    expect(limparEvento({})).toEqual({});
  });
});

describe("limparTrilha", () => {
  it.each(["console", "ui.click", "ui.input"])("descarta %s, que pode trazer nome de devedor", (category) => {
    expect(limparTrilha({ category, message: "Maria Souza" })).toBeNull();
  });

  it("mantém a chamada à API, sem a busca", () => {
    const trilha = limparTrilha({ category: "fetch", data: { url: "https://api/debtors?search=Maria", method: "GET", status_code: 500, "http.query": "search=Maria", "http.fragment": "x" } });
    expect(trilha?.data).toEqual({ url: "https://api/debtors", method: "GET", status_code: 500 });
  });
});

describe("opcoesDoSentry", () => {
  it("não envia dados pessoais, desempenho nem gravação de sessão", () => {
    expect(opcoesDoSentry.sendDefaultPii).toBe(false);
    expect(opcoesDoSentry.tracesSampleRate).toBe(0);
    expect(opcoesDoSentry).not.toHaveProperty("replaysSessionSampleRate");
  });
});
