import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession } from "@/app/lib/session";
import { FaturaDetalheView } from "./FaturaDetalheView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Mesmos campos de InstallmentWithDebtorResponse no back.
const parcela = {
  id: "p-2",
  agreement_id: "a-1",
  number: 2,
  due_date: "2026-10-30",
  amount: "300.00",
  condominium_amount: "270.00",
  fee_amount: "30.00",
  payment_date: null,
  remaining_amount: "200.00",
  invoice_number: null,
  invoice_date: null,
  status: "overdue",
  condominium: { id: "c-1", name: "Res. Villa Verde" },
  debtor: { id: "d-1", name: "Bruno Morador", unit: "101" },
};
const pagamento = { id: "pg-1", amount: "100.00", payment_date: "2026-11-04", created_at: "2026-11-04T12:00:00Z" };

type Resposta = { status: number; body: unknown };

function mockApi({ fatura = { status: 200, body: parcela }, pagamentos = { status: 200, body: [pagamento] }, acordo = { status: 200, body: { id: "a-1", status: "active" } } }: { fatura?: Resposta; pagamentos?: Resposta; acordo?: Resposta } = {}) {
  const fn = vi.fn((url: string) => {
    const resposta = url.endsWith("/payments") ? pagamentos : url.includes("/agreements/") ? acordo : fatura;
    return Promise.resolve(new Response(JSON.stringify(resposta.body), { status: resposta.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana", email: "a@example.com", role: "operator" } }, true));

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("#47: detalhe da fatura", () => {
  it("CA01: mostra valor, divisão, situação e a quem pertence", async () => {
    mockApi();
    render(<FaturaDetalheView id="p-2" />);
    expect(await screen.findByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 270,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByText("Atrasada")).toBeInTheDocument();
    expect(screen.getByText("30/10/2026")).toBeInTheDocument();
    expect(screen.getByText("R$ 200,00")).toBeInTheDocument();
    expect(screen.getByText("Bruno Morador · 101")).toBeInTheDocument();
    expect(screen.getByText("Res. Villa Verde")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver acordo" })).toHaveAttribute("href", "/acordos/a-1");
  });

  it("avisa quando o acordo foi cancelado", async () => {
    mockApi({ acordo: { status: 200, body: { id: "a-1", status: "cancelled" } } });
    render(<FaturaDetalheView id="p-2" />);
    expect(await screen.findByText("Acordo cancelado")).toBeInTheDocument();
  });

  it("não mostra o aviso para acordo ativo", async () => {
    mockApi();
    render(<FaturaDetalheView id="p-2" />);
    await screen.findByText("R$ 300,00");
    expect(screen.queryByText("Acordo cancelado")).not.toBeInTheDocument();
  });

  it("lista os pagamentos já registrados", async () => {
    mockApi();
    render(<FaturaDetalheView id="p-2" />);
    expect(await screen.findByText("04/11/2026")).toBeInTheDocument();
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument();
  });

  it("mostra a nota fiscal e a data de pagamento da parcela quitada", async () => {
    mockApi({ fatura: { status: 200, body: { ...parcela, status: "paid", payment_date: "2026-10-29", remaining_amount: "0.00", invoice_number: "NF-77", invoice_date: "2026-10-31" } } });
    render(<FaturaDetalheView id="p-2" />);
    expect(await screen.findByText("Paga")).toBeInTheDocument();
    expect(screen.getByText("29/10/2026")).toBeInTheDocument();
    expect(screen.getByText("NF-77, em 31/10/2026")).toBeInTheDocument();
  });

  it("explica quando não há pagamentos", async () => {
    mockApi({ pagamentos: { status: 200, body: [] } });
    render(<FaturaDetalheView id="p-2" />);
    expect(await screen.findByText("Nenhum pagamento registrado.")).toBeInTheDocument();
  });

  it.each([404, 422])("responde %i como fatura não encontrada, sem oferecer nova tentativa", async (status) => {
    mockApi({ fatura: { status, body: { detail: "Parcela não encontrada." } } });
    render(<FaturaDetalheView id="p-x" />);
    expect(await screen.findByText("Fatura não encontrada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
  });

  it("mostra o erro e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    let falhar = true;
    const fn = vi.fn((url: string) => Promise.resolve(falhar ? new Response(JSON.stringify({ detail: "Erro" }), { status: 500 }) : new Response(JSON.stringify(url.endsWith("/payments") ? [] : url.includes("/agreements/") ? { id: "a-1", status: "active" } : parcela), { status: 200 })));
    vi.stubGlobal("fetch", fn);
    render(<FaturaDetalheView id="p-2" />);
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByText("R$ 300,00")).toBeInTheDocument();
  });
});
