import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simularCelular } from "@/app/lib/celular.test-utils";
import { clearSession, saveSession } from "@/app/lib/session";
import type { HistoricoDoMorador } from "../../api";
import { HistoricoMoradorView } from "./HistoricoMoradorView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Mesmos campos de DebtorPaymentHistory no back.
const historico: HistoricoDoMorador = {
  debtor_name: "Ana Moradora",
  debtor_unit: "101",
  months: [
    { month: "2026-09", paid_amount: "300.00", open_amount: "0.00", status: "pago" },
    { month: "2026-10", paid_amount: "100.10", open_amount: "199.90", status: "atrasado" },
    { month: "2026-11", paid_amount: "0.00", open_amount: "300.00", status: "em_aberto" },
  ],
};

function mockApi(resposta: () => { status: number; body: unknown }) {
  const fn = vi.fn(() => {
    const { status, body } = resposta();
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const linha = (mes: string) => screen.getByText(mes).closest("tr") as HTMLElement;

beforeEach(() => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Rita", email: "r@example.com", role: "client" } }, true));

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("US38: histórico de pagamentos do morador", () => {
  it("CA01: mostra o total pago e em aberto por competência, com a situação", async () => {
    mockApi(() => ({ status: 200, body: historico }));
    render(<HistoricoMoradorView id="d-1" />);
    await screen.findByText("Setembro 2026");
    expect(within(linha("Setembro 2026")).getByText("Pago")).toBeInTheDocument();
    expect(within(linha("Outubro 2026")).getByText("R$ 100,10")).toBeInTheDocument();
    expect(within(linha("Outubro 2026")).getByText("R$ 199,90")).toBeInTheDocument();
    expect(within(linha("Outubro 2026")).getByText("Atrasado")).toBeInTheDocument();
    expect(within(linha("Novembro 2026")).getByText("Em aberto")).toBeInTheDocument();
  });

  it("identifica o morador e soma os totais sem erro de centavos", async () => {
    mockApi(() => ({ status: 200, body: historico }));
    render(<HistoricoMoradorView id="d-1" />);
    expect(await screen.findByText("Ana Moradora · Unidade 101")).toBeInTheDocument();
    expect(screen.getByText("Total pago").parentElement?.parentElement).toHaveTextContent("R$ 400,10");
    expect(screen.getByText("Total em aberto").parentElement?.parentElement).toHaveTextContent("R$ 499,90");
  });

  it("CA01: não fala em honorários nem em comissões", async () => {
    mockApi(() => ({ status: 200, body: historico }));
    const { container } = render(<HistoricoMoradorView id="d-1" />);
    await screen.findByText("Setembro 2026");
    expect(container.textContent).not.toMatch(/honor[aá]rio|comiss[aã]o/i);
  });

  it("volta ao painel", async () => {
    mockApi(() => ({ status: 200, body: historico }));
    render(<HistoricoMoradorView id="d-1" />);
    expect(await screen.findByRole("link", { name: /Voltar ao painel/ })).toHaveAttribute("href", "/painel-cliente");
  });

  it.each([404, 422])("responde %i como morador não encontrado", async (status) => {
    mockApi(() => ({ status, body: { detail: "Devedor não encontrado." } }));
    render(<HistoricoMoradorView id="d-outro" />);
    expect(await screen.findByText("Morador não encontrado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(screen.queryByText("Total pago")).not.toBeInTheDocument();
  });

  it("explica quando o morador não tem parcelas", async () => {
    mockApi(() => ({ status: 200, body: { ...historico, months: [] } }));
    render(<HistoricoMoradorView id="d-1" />);
    expect(await screen.findByText("Nenhuma parcela")).toBeInTheDocument();
  });

  it("mostra o erro e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    let falhar = true;
    mockApi(() => (falhar ? { status: 500, body: { detail: "Erro" } } : { status: 200, body: historico }));
    render(<HistoricoMoradorView id="d-1" />);
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByText("Setembro 2026")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar o histórico")).not.toBeInTheDocument();
  });
});

describe("#83: histórico do morador no celular", () => {
  it("mostra uma linha por competência, com situação e valores", async () => {
    simularCelular();
    mockApi(() => ({ status: 200, body: historico }));
    render(<HistoricoMoradorView id="d-1" />);
    const lista = await screen.findByRole("list", { name: "Competências" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const outubro = within(lista).getByText("Outubro 2026").closest("li") as HTMLElement;
    expect(outubro).toHaveTextContent("Pago R$ 100,10 · em aberto R$ 199,90");
    expect(within(outubro).getByText("Atrasado")).toBeInTheDocument();
  });
});
