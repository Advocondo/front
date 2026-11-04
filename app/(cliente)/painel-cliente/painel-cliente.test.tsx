import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getSession, saveSession } from "@/app/lib/session";
import type { AcordoDoCliente } from "./api";
import { PainelClienteView } from "./PainelClienteView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Mesmos campos de AgreementSummary no back, na ordem dele: atrasados primeiro.
const atrasado: AcordoDoCliente = { id: "a-1", condominium_name: "Res. Villa Verde", debtor_id: "d-1", debtor_name: "Ana Moradora", debtor_unit: "101", status: "atrasado", overdue_installments: 2, next_due_date: "2026-12-10" };
const umaParcela: AcordoDoCliente = { ...atrasado, id: "a-4", condominium_name: "Ed. Century", debtor_name: "Duda Moradora", overdue_installments: 1, next_due_date: null };
const emDia: AcordoDoCliente = { ...atrasado, id: "a-2", debtor_id: "d-2", debtor_name: "Bruno Morador", debtor_unit: "202", status: "em_dia", overdue_installments: 0 };
const semVencimento: AcordoDoCliente = { ...emDia, id: "a-3", condominium_name: "Cond. Parque", debtor_name: "Caio Morador", next_due_date: null };

function mockApi(resposta: () => { status: number; body: unknown }) {
  const fn = vi.fn(() => {
    const { status, body } = resposta();
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const com = (lista: AcordoDoCliente[]) => mockApi(() => ({ status: 200, body: lista }));
const linha = (nome: string) => screen.getByText(nome).closest("tr") as HTMLElement;

beforeEach(() => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Rita Síndica", email: "r@example.com", role: "client" } }, true));

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("US37: Painel do Cliente", () => {
  it("CA01: agrupa por condomínio os acordos que o back devolve", async () => {
    com([atrasado, emDia, semVencimento]);
    render(<PainelClienteView />);
    expect(await screen.findByText("Res. Villa Verde")).toBeInTheDocument();
    expect(screen.getByText("Cond. Parque")).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(within(screen.getAllByRole("table")[0]).getByText("Ana Moradora")).toBeInTheDocument();
    expect(within(screen.getAllByRole("table")[0]).getByText("Bruno Morador")).toBeInTheDocument();
    expect(within(screen.getAllByRole("table")[1]).getByText("Caio Morador")).toBeInTheDocument();
  });

  it("CA02: mostra a situação simplificada e os totais", async () => {
    com([atrasado, emDia, semVencimento]);
    render(<PainelClienteView />);
    await screen.findByText("Ana Moradora");
    expect(within(linha("Ana Moradora")).getByText("Atrasado")).toBeInTheDocument();
    expect(within(linha("Ana Moradora")).getByText("2 parcelas")).toBeInTheDocument();
    expect(within(linha("Bruno Morador")).getByText("Em dia")).toBeInTheDocument();
    expect(screen.getByText("Acordos em dia").parentElement?.parentElement).toHaveTextContent("2");
    expect(screen.getByText("Acordos atrasados").parentElement?.parentElement).toHaveTextContent("1");
  });

  it("CA02: nenhum valor em reais, honorário ou comissão aparece na tela", async () => {
    com([atrasado, emDia]);
    const { container } = render(<PainelClienteView />);
    await screen.findByText("Ana Moradora");
    expect(container.textContent).not.toMatch(/R\$|honor[aá]rio|comiss[aã]o/i);
  });

  it("mostra a unidade, o vencimento em formato brasileiro e o singular de uma parcela", async () => {
    com([atrasado, umaParcela]);
    render(<PainelClienteView />);
    await screen.findByText("Ana Moradora");
    expect(within(linha("Ana Moradora")).getByText("10/12/2026")).toBeInTheDocument();
    expect(within(linha("Ana Moradora")).getByText("Unidade 101")).toBeInTheDocument();
    expect(within(linha("Duda Moradora")).getByText("1 parcela")).toBeInTheDocument();
  });

  it("US10-CA02: sem acordos, explica e indica com quem falar", async () => {
    com([]);
    render(<PainelClienteView />);
    expect(await screen.findByText("Nenhum acordo para mostrar")).toBeInTheDocument();
    expect(screen.getByText(/fale com o escritório/)).toBeInTheDocument();
    expect(screen.queryByText("Acordos em dia")).not.toBeInTheDocument();
  });

  it("mostra o erro e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    let falhar = true;
    mockApi(() => (falhar ? { status: 500, body: { detail: "Erro" } } : { status: 200, body: [atrasado] }));
    render(<PainelClienteView />);
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByText("Ana Moradora")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar os acordos")).not.toBeInTheDocument();
  });

  it("mostra quem entrou e permite sair", async () => {
    const user = userEvent.setup();
    com([]);
    render(<PainelClienteView />);
    expect(screen.getByText("Rita Síndica")).toBeInTheDocument();
    await screen.findByText("Nenhum acordo para mostrar");
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(getSession()).toBeNull();
  });
});
