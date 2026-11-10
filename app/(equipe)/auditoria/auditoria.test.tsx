import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simularCelular } from "@/app/lib/celular.test-utils";
import { clearSession, saveSession } from "@/app/lib/session";
import type { RegistroDeAuditoria } from "./api";
import { AuditoriaView, descreverAcao } from "./AuditoriaView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const carla = { id: "u-admin", name: "Carla Admin" };
const marina = { id: "u-op", name: "Marina Dias" };
const acordo = { id: "a-1", debtor: { id: "d-1", name: "José Simão", unit: "Bloco A 101" }, condominium: { id: "c-1", name: "Residencial Mirante" } };
const vazio = { agreement: null, installment_number: null, field: null, target_user: null, added_condominiums: [], removed_condominiums: [] };

// Mesmos campos de AuditEntryResponse no back.
const vinculo: RegistroDeAuditoria = {
  ...vazio, id: "l-3", occurred_at: "2026-03-04T12:00:00Z", category: "users", action: "condominiums_changed", actor: carla,
  old_value: null, new_value: null, target_user: { id: "u-cli", name: "Paulo Síndico" }, added_condominiums: [{ id: "c-1", name: "Residencial Mirante" }],
};
const edicao: RegistroDeAuditoria = {
  ...vazio, id: "l-2", occurred_at: "2026-03-03T01:00:00Z", category: "financial", action: "agreement_edited", actor: carla,
  old_value: "300.00", new_value: "350.00", agreement: acordo, field: "total_amount",
};
const baixa: RegistroDeAuditoria = {
  ...vazio, id: "l-1", occurred_at: "2026-03-02T15:00:00Z", category: "financial", action: "payment_recorded", actor: marina,
  old_value: null, new_value: "150.00", agreement: acordo, installment_number: 1,
};

const usuarios = [
  { ...carla, email: "carla@example.com", role: "admin", status: "active", is_lawyer: false, oab_number: null },
  { ...marina, email: "marina@example.com", role: "operator", status: "active", is_lawyer: false, oab_number: null },
  { id: "u-cli", name: "Paulo Síndico", email: "p@example.com", role: "client", status: "active", is_lawyer: false, oab_number: null },
];

type Resposta = { status: number; body?: unknown };

function mockApi(trilha: (url: URL) => Resposta = () => ({ status: 200, body: { total: 3, entries: [vinculo, edicao, baixa] } })) {
  const fn = vi.fn((url: string) => {
    const endereco = new URL(url);
    const r = endereco.pathname === "/users" ? { status: 200, body: usuarios } : trilha(endereco);
    return Promise.resolve(new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const chamadasDaTrilha = (fn: ReturnType<typeof mockApi>) => fn.mock.calls.map(([url]) => new URL(url)).filter((u) => u.pathname === "/audit");
const ultimaBusca = (fn: ReturnType<typeof mockApi>) => Object.fromEntries(chamadasDaTrilha(fn).at(-1)!.searchParams);

beforeEach(() => {
  saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-admin", name: "Carla Admin", email: "carla@example.com", role: "admin" } }, true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("#72: trilha de auditoria", () => {
  it("CA01: mostra quem fez, quando, a ação, o alvo e o valor, da mais recente para a mais antiga", async () => {
    mockApi();
    render(<AuditoriaView />);
    expect(await screen.findByText("3 registros")).toBeInTheDocument();

    const linhas = screen.getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toHaveTextContent("Carla Admin");
    expect(linhas[0]).toHaveTextContent("Condomínios alterados");
    expect(linhas[0]).toHaveTextContent("Paulo Síndico");
    expect(linhas[0]).toHaveTextContent("Vinculados: Residencial Mirante");
    // 01:00 UTC de 3 de março ainda é 2 de março em Brasília.
    expect(linhas[1]).toHaveTextContent("02/03/2026 22:00");
    expect(linhas[1]).toHaveTextContent("Valor total do acordo");
    expect(linhas[1]).toHaveTextContent("de R$ 300,00 para R$ 350,00");
    expect(linhas[2]).toHaveTextContent("Marina Dias");
    expect(linhas[2]).toHaveTextContent("Baixa da parcela 1");
    expect(linhas[2]).toHaveTextContent("+ R$ 150,00");
    expect(within(linhas[2]).getByRole("link", { name: "José Simão · Bloco A 101" })).toHaveAttribute("href", "/acordos/a-1");
    expect(linhas[2]).toHaveTextContent("Residencial Mirante");
  });

  it("CA02: os filtros de autor, tipo e período vão juntos para a API", async () => {
    const fn = mockApi();
    render(<AuditoriaView />);
    await screen.findByText("3 registros");

    const autor = screen.getByLabelText("Autor");
    await waitFor(() => expect(within(autor).getAllByRole("option").map((o) => o.textContent)).toEqual(["Todos os autores", "Carla Admin", "Marina Dias"]));
    await userEvent.selectOptions(autor, "Marina Dias");
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "Financeiro (acordos e parcelas)");
    await userEvent.type(screen.getByLabelText("De"), "2026-03-01");
    await userEvent.type(screen.getByLabelText("Até"), "2026-03-02");

    await waitFor(() => expect(ultimaBusca(fn)).toEqual({ limit: "50", offset: "0", actor_id: "u-op", category: "financial", date_from: "2026-03-01", date_to: "2026-03-02" }));

    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() => expect(ultimaBusca(fn)).toEqual({ limit: "50", offset: "0" }));
  });

  it("período com início depois do fim não consulta a API", async () => {
    const fn = mockApi();
    render(<AuditoriaView />);
    await screen.findByText("3 registros");
    await userEvent.type(screen.getByLabelText("De"), "2026-03-05");
    const antes = chamadasDaTrilha(fn).length;
    await userEvent.type(screen.getByLabelText("Até"), "2026-03-01");

    expect(await screen.findByRole("alert")).toHaveTextContent("A data inicial não pode ser depois da data final.");
    expect(chamadasDaTrilha(fn).length).toBe(antes);
  });

  it("carrega mais registros enquanto houver", async () => {
    const fn = mockApi((url) => ({
      status: 200,
      body: url.searchParams.get("offset") === "0" ? { total: 3, entries: [vinculo, edicao] } : { total: 3, entries: [edicao, baixa] },
    }));
    render(<AuditoriaView />);
    await screen.findByText("3 registros");
    expect(screen.getAllByRole("row")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: /Carregar mais/ }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(4));
    expect(ultimaBusca(fn).offset).toBe("2");
    expect(screen.queryByRole("button", { name: /Carregar mais/ })).not.toBeInTheDocument();
  });

  it("sem registros, explica o que aparece aqui; com filtro, pede para revisar", async () => {
    mockApi(() => ({ status: 200, body: { total: 0, entries: [] } }));
    render(<AuditoriaView />);
    expect(await screen.findByText("Nenhuma ação registrada")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "Usuários");
    expect(await screen.findByText("Nenhum registro encontrado")).toBeInTheDocument();
  });

  it("uma falha oferece tentar de novo", async () => {
    let falhar = true;
    mockApi(() => (falhar ? { status: 500, body: { detail: "Erro" } } : { status: 200, body: { total: 1, entries: [baixa] } }));
    render(<AuditoriaView />);
    expect(await screen.findByText("Não foi possível carregar a trilha")).toBeInTheDocument();
    falhar = false;
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("1 registro")).toBeInTheDocument();
  });

  it("descreve uma mudança de situação sem autor", () => {
    const semAutor = { ...vinculo, action: "status_changed", actor: null, old_value: "active", new_value: "inactive", added_condominiums: [] } as RegistroDeAuditoria;
    expect(descreverAcao(semAutor)).toEqual({ acao: "Situação alterada", detalhe: "De Ativo para Inativo" });
  });
});

describe("#83: trilha de auditoria no celular", () => {
  it("mostra um cartão por ação, com autor, data, ação, alvo e detalhe", async () => {
    simularCelular();
    mockApi();
    render(<AuditoriaView />);
    const lista = await screen.findByRole("list", { name: "Registros de auditoria" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const cartoes = within(lista).getAllByRole("listitem");
    expect(cartoes).toHaveLength(3);
    expect(cartoes[2]).toHaveTextContent("Marina Dias");
    expect(cartoes[2]).toHaveTextContent("02/03/2026 12:00");
    expect(cartoes[2]).toHaveTextContent("Baixa da parcela 1");
    expect(cartoes[2]).toHaveTextContent("+ R$ 150,00");
    expect(within(cartoes[2]).getByRole("link", { name: "José Simão · Bloco A 101" })).toHaveAttribute("href", "/acordos/a-1");
  });
});
