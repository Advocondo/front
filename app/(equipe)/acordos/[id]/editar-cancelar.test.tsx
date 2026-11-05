import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Acordo, Parcela } from "../types";
import { AcordoDetalheView } from "./AcordoDetalheView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Mesmos campos das respostas do back.
const acordo: Acordo = {
  id: "a-1", status: "active", total_amount: "5500.00", fee_amount: "1100.00", fee_percentage: "20.00", installment_count: 2,
  condominium: { id: "c-1", name: "Ed. Century" }, debtor: { id: "d-1", name: "Cláudio Bezerra", unit: "1101" }, responsible_lawyer: null,
  cancelled_at: null, cancellation_reason: null,
};
const cancelado: Acordo = { ...acordo, status: "cancelled", cancelled_at: "2026-11-05T15:00:00Z", cancellation_reason: "Devedor quitou direto" };
const base = { agreement_id: "a-1", condominium_amount: "2200.00", fee_amount: "550.00", payment_date: null, remaining_amount: "2750.00", invoice_number: null, invoice_date: null };
const aberta: Parcela = { ...base, id: "i-1", number: 1, due_date: "2026-10-10", amount: "2750.00", status: "open" };
const aberta2: Parcela = { ...base, id: "i-2", number: 2, due_date: "2026-11-10", amount: "2750.00", status: "overdue" };
const paga: Parcela = { ...aberta, status: "paid", payment_date: "2026-10-10", remaining_amount: "0.00" };
const devedores = [
  { id: "d-1", condominium_id: "c-1", name: "Cláudio Bezerra", unit: "1101", phone: "61912345678", email: null },
  { id: "d-2", condominium_id: "c-1", name: "Dora Nova", unit: "1102", phone: "61912345678", email: null },
];

type Resposta = { status: number; body: unknown };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi({ plano = [aberta, aberta2], dados = acordo, rota }: { plano?: Parcela[]; dados?: Acordo; rota?: Rota } = {}) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const padrao = (): Resposta => {
      if (init?.method) return { status: 200, body: dados };
      if (url.includes("/users/lawyers")) return { status: 200, body: [] };
      if (url.includes("/debtors")) return { status: 200, body: devedores };
      if (url.includes("/installments")) return { status: 200, body: plano };
      if (url.includes("/lawyer-history")) return { status: 200, body: [] };
      return { status: 200, body: dados };
    };
    const r = rota?.(url, init) ?? padrao();
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const chamadas = (fn: ReturnType<typeof mockApi>, metodo: string) => fn.mock.calls.filter(([, init]) => init?.method === metodo);
const corpo = (fn: ReturnType<typeof mockApi>, metodo: string, n = 0) => JSON.parse(chamadas(fn, metodo)[n][1]?.body as string);

afterEach(() => vi.unstubAllGlobals());

describe("US19: editar acordo", () => {
  async function abrir(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Editar acordo" }));
    await screen.findByRole("option", { name: "Dora Nova · 1102" });
  }

  it("vem preenchido, e sem mudança não há o que salvar", async () => {
    const user = userEvent.setup();
    mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    expect(screen.getByLabelText(/Valor total/)).toHaveValue("5.500,00");
    expect(screen.getByLabelText("Percentual de honorários")).toHaveValue("20");
    expect(screen.getByLabelText(/^Devedor/)).toHaveValue("d-1");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
  });

  it("envia só o que mudou e recarrega as parcelas, que foram recalculadas", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    const antes = fetchMock.mock.calls.filter(([url]) => url.includes("/installments")).length;
    await user.clear(screen.getByLabelText(/Valor total/));
    await user.type(screen.getByLabelText(/Valor total/), "400000");
    expect(screen.getByText("Honorários de R$ 800,00, com R$ 3.200,00 de repasse ao condomínio.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Acordo atualizado com sucesso.")).toBeInTheDocument();
    expect(corpo(fetchMock, "PATCH")).toEqual({ total_amount: "4000.00", confirm_paid_installments: false });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.includes("/installments")).length).toBeGreaterThan(antes));
  });

  it("troca o devedor por outro do mesmo condomínio", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    await user.selectOptions(screen.getByLabelText(/^Devedor/), "d-2");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await screen.findByText("Acordo atualizado com sucesso.");
    expect(corpo(fetchMock, "PATCH")).toEqual({ debtor_id: "d-2", confirm_paid_installments: false });
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/debtors") && url.includes("condominium_id=c-1"))).toBe(true);
  });

  it("muda os honorários para valor fixo, sem enviar percentual", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    await user.click(screen.getByRole("radio", { name: "Valor fixo" }));
    await user.clear(screen.getByLabelText("Valor dos honorários"));
    await user.type(screen.getByLabelText("Valor dos honorários"), "90000");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await screen.findByText("Acordo atualizado com sucesso.");
    expect(corpo(fetchMock, "PATCH")).toEqual({ fee_amount: "900.00", confirm_paid_installments: false });
  });

  it("recusa honorários maiores que o total, sem chamar o back", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    await user.click(screen.getByRole("radio", { name: "Valor fixo" }));
    await user.clear(screen.getByLabelText("Valor dos honorários"));
    await user.type(screen.getByLabelText("Valor dos honorários"), "900000");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Os honorários não podem ser maiores que o valor total.")).toBeInTheDocument();
    expect(chamadas(fetchMock, "PATCH")).toHaveLength(0);
  });

  describe("CA01: confirmação extra", () => {
    it("com parcela paga, avisa e só envia depois de marcar a confirmação", async () => {
      const user = userEvent.setup();
      const fetchMock = mockApi({ plano: [paga, aberta2] });
      render(<AcordoDetalheView id="a-1" />);
      await abrir(user);
      expect(screen.getByText("Este acordo tem 1 parcela paga")).toBeInTheDocument();

      await user.clear(screen.getByLabelText(/Valor total/));
      await user.type(screen.getByLabelText(/Valor total/), "600000");
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
      expect(await screen.findByText("Marque a confirmação para alterar um acordo com parcelas pagas.")).toBeInTheDocument();
      expect(chamadas(fetchMock, "PATCH")).toHaveLength(0);

      await user.click(screen.getByRole("checkbox", { name: /Confirmo a alteração/ }));
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
      await screen.findByText("Acordo atualizado com sucesso.");
      expect(corpo(fetchMock, "PATCH")).toEqual({ total_amount: "6000.00", confirm_paid_installments: true });
    });

    it("sem parcela paga, não pede confirmação", async () => {
      const user = userEvent.setup();
      mockApi();
      render(<AcordoDetalheView id="a-1" />);
      await abrir(user);
      expect(screen.queryByRole("checkbox", { name: /Confirmo a alteração/ })).not.toBeInTheDocument();
    });

    it("se alguém deu baixa depois de a tela abrir, o 409 do back faz a confirmação aparecer", async () => {
      const user = userEvent.setup();
      let tentativas = 0;
      const fetchMock = mockApi({
        rota: (_url, init) => {
          if (init?.method !== "PATCH") return undefined;
          tentativas += 1;
          return tentativas === 1 ? { status: 409, body: { detail: "Este acordo já tem parcelas pagas. Confirme a alteração para continuar." } } : undefined;
        },
      });
      render(<AcordoDetalheView id="a-1" />);
      await abrir(user);
      await user.clear(screen.getByLabelText(/Valor total/));
      await user.type(screen.getByLabelText(/Valor total/), "600000");
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Confirme a alteração");
      await user.click(screen.getByRole("checkbox", { name: /Confirmo a alteração/ }));
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
      await screen.findByText("Acordo atualizado com sucesso.");
      expect(corpo(fetchMock, "PATCH", 1).confirm_paid_installments).toBe(true);
    });
  });

  it("mostra a recusa do back e mantém o diálogo aberto", async () => {
    const user = userEvent.setup();
    mockApi({ rota: (_url, init) => (init?.method === "PATCH" ? { status: 422, body: { detail: "O novo valor total precisa ser maior que o valor das parcelas já pagas." } } : undefined) });
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    await user.clear(screen.getByLabelText(/Valor total/));
    await user.type(screen.getByLabelText(/Valor total/), "100");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("maior que o valor das parcelas já pagas");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });
});

describe("US20: cancelar acordo", () => {
  const abrir = async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole("button", { name: "Cancelar acordo" }));
  const confirmar = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getAllByRole("button", { name: "Cancelar acordo" }).at(-1) as HTMLElement);

  it("exige o motivo, avisa das parcelas sem pagamento e envia a confirmação", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    expect(screen.getByText("2 parcelas sem pagamento")).toBeInTheDocument();
    expect(screen.getByText(/Somam R\$ 5\.500,00/)).toBeInTheDocument();

    await confirmar(user);
    expect(await screen.findByText("Informe o motivo do cancelamento.")).toBeInTheDocument();
    expect(chamadas(fetchMock, "POST")).toHaveLength(0);

    await user.type(screen.getByLabelText(/^Motivo/), "  Devedor quitou direto  ");
    await confirmar(user);
    expect(await screen.findByText("Acordo cancelado com sucesso.")).toBeInTheDocument();
    expect(chamadas(fetchMock, "POST")[0][0]).toMatch(/\/agreements\/a-1\/cancel$/);
    expect(corpo(fetchMock, "POST")).toEqual({ reason: "Devedor quitou direto", confirm_open_installments: true });
  });

  it("sem parcelas em aberto, não há aviso nem confirmação", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ plano: [paga] });
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    expect(screen.queryByText(/sem pagamento/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Motivo/), "Encerrado");
    await confirmar(user);
    await screen.findByText("Acordo cancelado com sucesso.");
    expect(corpo(fetchMock, "POST").confirm_open_installments).toBe(false);
  });

  it("se a lista estava velha, mostra a recusa do back e a segunda tentativa confirma", async () => {
    const user = userEvent.setup();
    let tentativas = 0;
    const fetchMock = mockApi({
      plano: [paga],
      rota: (_url, init) => {
        if (init?.method !== "POST") return undefined;
        tentativas += 1;
        return tentativas === 1 ? { status: 409, body: { detail: "Há 1 parcela sem pagamento, somando R$ 10,00. Confirme para cancelar o acordo." } } : undefined;
      },
    });
    render(<AcordoDetalheView id="a-1" />);
    await abrir(user);
    await user.type(screen.getByLabelText(/^Motivo/), "Encerrado");
    await confirmar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Há 1 parcela sem pagamento");
    await confirmar(user);
    await screen.findByText("Acordo cancelado com sucesso.");
    expect(corpo(fetchMock, "POST", 1).confirm_open_installments).toBe(true);
  });

  it("CA02: cancelado, mostra quando e por quê, mantém o histórico e tira as ações", async () => {
    mockApi({ dados: cancelado, plano: [paga, aberta2] });
    render(<AcordoDetalheView id="a-1" />);
    expect(await screen.findByText("Acordo cancelado em 05/11/2026 12:00")).toBeInTheDocument();
    expect(screen.getByText("Devedor quitou direto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagamentos da parcela 1/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar acordo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar acordo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dar baixa/ })).not.toBeInTheDocument();
    expect(screen.getByText("Paga")).toBeInTheDocument();
    expect(screen.getByText("Fora da cobrança")).toBeInTheDocument();
    expect(screen.queryByText("Atrasada")).not.toBeInTheDocument();
  });

  it("explica quando foi cancelado sem motivo, como os cancelamentos feitos pela API", async () => {
    mockApi({ dados: { ...cancelado, cancellation_reason: null } });
    render(<AcordoDetalheView id="a-1" />);
    expect(await screen.findByText("Sem motivo registrado.")).toBeInTheDocument();
  });

  it("Reativar desfaz o cancelamento", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ dados: cancelado });
    render(<AcordoDetalheView id="a-1" />);
    await user.click(await screen.findByRole("button", { name: "Reativar acordo" }));
    expect(await screen.findByText("Acordo reativado com sucesso.")).toBeInTheDocument();
    expect(chamadas(fetchMock, "POST")[0][0]).toMatch(/\/agreements\/a-1\/reactivate$/);
  });

  it("mostra a falha ao reativar", async () => {
    const user = userEvent.setup();
    mockApi({ dados: cancelado, rota: (_url, init) => (init?.method === "POST" ? { status: 422, body: { detail: "O acordo não está cancelado." } } : undefined) });
    render(<AcordoDetalheView id="a-1" />);
    await user.click(await screen.findByRole("button", { name: "Reativar acordo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O acordo não está cancelado.");
  });
});
