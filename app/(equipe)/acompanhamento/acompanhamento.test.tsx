import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simularCelular } from "@/app/lib/celular.test-utils";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import type { Pagamento, ParcelaDoMes } from "./api";
import { AcompanhamentoView } from "./AcompanhamentoView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const CONDO_ID = "3f1c2b7e-8a44-4d3e-9c11-2f6a7b8c9d01";
const base = {
  agreement_id: "a-1", condominium_amount: "800.00", fee_amount: "200.00", payment_date: null, invoice_number: null, invoice_date: null,
  condominium: { id: CONDO_ID, name: "Ed. Century" },
};
const aberta: ParcelaDoMes = { ...base, id: "i-1", number: 2, due_date: "2026-11-20", amount: "1000.00", remaining_amount: "1000.00", status: "open", debtor: { id: "d-1", name: "Ana Aberta", unit: "101" } };
const atrasada: ParcelaDoMes = { ...base, id: "i-2", number: 3, due_date: "2026-11-02", amount: "500.00", remaining_amount: "500.00", status: "overdue", debtor: { id: "d-2", name: "Bia Atrasada", unit: "102" } };
const paga: ParcelaDoMes = { ...base, id: "i-3", number: 4, due_date: "2026-11-03", amount: "300.00", remaining_amount: "0.00", payment_date: "2026-11-01", status: "paid", debtor: { id: "d-3", name: "Caio Pago", unit: "103" } };
const parcial: ParcelaDoMes = { ...base, id: "i-4", number: 5, due_date: "2026-11-25", amount: "200.00", remaining_amount: "50.00", status: "open", debtor: { id: "d-4", name: "Duda Parcial", unit: "104" } };
const historico: Pagamento[] = [{ id: "p-1", amount: "150.00", payment_date: "2026-11-02", created_at: "2026-11-02T12:00:00Z" }];

type Resposta = { status: number; body?: unknown };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi({ rota, parcelas = [aberta, atrasada, paga, parcial] }: { rota?: Rota; parcelas?: ParcelaDoMes[] } = {}) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const padrao = (): Resposta => {
      if (url.includes("/condominiums")) return { status: 200, body: [] };
      if (url.includes("/users/lawyers")) return { status: 200, body: [{ id: "l-1", name: "Dra. Sarah", oab_number: "DF1" }] };
      if (url.includes("/payments")) return { status: 200, body: historico };
      return { status: 200, body: parcelas };
    };
    const resposta = rota?.(url, init) ?? padrao();
    return Promise.resolve(new Response(resposta.body === undefined ? null : JSON.stringify(resposta.body), { status: resposta.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const entrarComo = (role: Role) => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u", name: "X", email: "x@example.com", role } }, true);
const corpoDe = (fn: ReturnType<typeof mockApi>, metodo: string) => JSON.parse(fn.mock.calls.find(([, init]) => init?.method === metodo)?.[1]?.body as string);
/** O cartão de total com este rótulo: os cartões vêm antes das abas, que repetem "Em aberto". */
function cartao(rotulo: string): HTMLElement {
  let elemento = screen.getAllByText(rotulo)[0];
  while (!elemento.textContent?.includes("R$") && elemento.parentElement) elemento = elemento.parentElement;
  return elemento;
}
const chamadaDe = (fn: ReturnType<typeof mockApi>, metodo: string) => fn.mock.calls.find(([, init]) => init?.method === metodo);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearSession();
});

describe("US25: faturas do mês", () => {
  it("CA01: mostra devedor, condomínio, valor e situação", async () => {
    mockApi();
    render(<AcompanhamentoView />);
    const linha = (await screen.findByText("Ana Aberta")).closest("tr") as HTMLElement;
    expect(within(linha).getByText("Ed. Century · 101")).toBeInTheDocument();
    expect(within(linha).getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(within(linha).getByText("Em aberto")).toBeInTheDocument();
    expect(within(screen.getByText("Bia Atrasada").closest("tr") as HTMLElement).getByText("Atrasada")).toBeInTheDocument();
    expect(within(screen.getByText("Caio Pago").closest("tr") as HTMLElement).getByText("Paga")).toBeInTheDocument();
  });

  it("abre no mês atual no Brasil, mesmo quando já é outro dia em UTC", async () => {
    vi.setSystemTime(new Date("2026-12-01T02:00:00Z")); // ainda 30/11 às 23h em Brasília
    const fetchMock = mockApi();
    render(<AcompanhamentoView />);
    expect(await screen.findByText("Novembro 2026")).toBeInTheDocument();
    expect(fetchMock.mock.calls.find(([url]) => url.includes("/installments?"))?.[0]).toMatch(/year=2026&month=11/);
  });

  it("navega entre os meses, inclusive na virada do ano", async () => {
    vi.setSystemTime(new Date("2026-12-15T15:00:00Z"));
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Próximo mês" }));
    expect(screen.getByText("Janeiro 2027")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toMatch(/year=2027&month=1(&|$)/));
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByText("Novembro 2026")).toBeInTheDocument();
  });

  it("os totais somam o mês inteiro, descontando o que já foi pago do saldo", async () => {
    mockApi();
    render(<AcompanhamentoView />);
    await screen.findByText("Ana Aberta");
    expect(cartao("Previsto")).toHaveTextContent("R$ 2.000,00");
    expect(cartao("Recebido")).toHaveTextContent("R$ 450,00");
    expect(cartao("Em aberto")).toHaveTextContent("R$ 1.050,00");
    expect(cartao("Atrasado")).toHaveTextContent("R$ 500,00");
  });

  it("CA02: as abas filtram por situação sem mudar os totais", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<AcompanhamentoView />);
    await screen.findByText("Ana Aberta");
    await user.click(screen.getByRole("tab", { name: /Atrasadas/ }));
    expect(screen.getByText("Bia Atrasada")).toBeInTheDocument();
    expect(screen.queryByText("Ana Aberta")).not.toBeInTheDocument();
    expect(cartao("Previsto")).toHaveTextContent("R$ 2.000,00");
  });

  it("CA02: filtra por responsável no servidor", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<AcompanhamentoView />);
    await screen.findByRole("option", { name: "Dra. Sarah" });
    await user.selectOptions(screen.getByLabelText("Filtrar por responsável"), "l-1");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("responsible_lawyer_id=l-1"));
  });

  it("busca todas as páginas do mês", async () => {
    const pagina = Array.from({ length: 200 }, (_, i) => ({ ...aberta, id: `x-${i}` }));
    const fetchMock = mockApi({ rota: (url) => (url.includes("/installments?") ? { status: 200, body: url.includes("offset=0") ? pagina : [aberta] } : undefined) });
    render(<AcompanhamentoView />);
    await waitFor(() => expect(cartao("Previsto")).toHaveTextContent("R$ 201.000,00"));
    expect(fetchMock.mock.calls.some(([url]) => url.includes("offset=200"))).toBe(true);
  });

  it("mostra o estado vazio e o erro", async () => {
    mockApi({ parcelas: [] });
    const { unmount } = render(<AcompanhamentoView />);
    expect(await screen.findByText("Nenhuma fatura neste mês")).toBeInTheDocument();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<AcompanhamentoView />);
    expect(await screen.findByText("Não foi possível carregar as faturas")).toBeInTheDocument();
  });
});

describe("US26: dar baixa", () => {
  const abrir = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Dar baixa na parcela 2 de Ana Aberta" }));
  };
  const confirmar = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
  const pagoOk: Rota = (_, init) => (init?.method === "POST" ? { status: 200, body: { ...aberta, status: "paid", remaining_amount: "0.00" } } : undefined);

  it("CA01: valor integral quita a parcela, sem enviar valor, e recarrega a lista", async () => {
    const fetchMock = mockApi({ rota: pagoOk });
    const user = userEvent.setup();
    await abrir(user);
    expect(screen.getByLabelText(/Valor pago/)).toHaveValue("1.000,00");
    expect(screen.getByLabelText(/^Data/)).toHaveValue("2026-11-04");
    expect(screen.queryByText("Pagamento parcial")).not.toBeInTheDocument();
    const antes = fetchMock.mock.calls.length;
    await confirmar(user);

    expect(await screen.findByText("Baixa registrada com sucesso.")).toBeInTheDocument();
    expect(chamadaDe(fetchMock, "POST")?.[0]).toMatch(/\/installments\/i-1\/payment$/);
    expect(corpoDe(fetchMock, "POST")).toEqual({ payment_date: "2026-11-04" });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(antes + 1));
  });

  it("não aceita data futura, sem valor nem acima do saldo", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    await abrir(user);
    fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: "2026-11-05" } });
    await user.clear(screen.getByLabelText(/Valor pago/));
    await confirmar(user);
    expect(await screen.findByText("A data do pagamento não pode ser futura.")).toBeInTheDocument();
    expect(screen.getByText("Informe o valor pago.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Valor pago/), "100001");
    fireEvent.change(screen.getByLabelText(/^Data/), { target: { value: "" } });
    await confirmar(user);
    expect(await screen.findByText("O valor pago passa do saldo de R$ 1.000,00.")).toBeInTheDocument();
    expect(screen.getByText("Informe a data do pagamento.")).toBeInTheDocument();
    expect(chamadaDe(fetchMock, "POST")).toBeUndefined();
  });

  it("mostra a recusa do servidor e os erros por campo", async () => {
    let tentativa = 0;
    mockApi({
      rota: (_, init) => {
        if (init?.method !== "POST") return undefined;
        tentativa += 1;
        return tentativa === 1 ? { status: 422, body: { detail: "Acordo cancelado não aceita esta operação." } } : { status: 422, body: { detail: [{ loc: ["body", "amount"], msg: "Value error, Valor recusado." }] } };
      },
    });
    const user = userEvent.setup();
    await abrir(user);
    await confirmar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Acordo cancelado");
    await confirmar(user);
    expect(await screen.findByText("Valor recusado.")).toBeInTheDocument();
  });
});

describe("US28: pagamento parcial", () => {
  it("CA01: um valor menor avisa o saldo, envia o valor e não marca como paga", async () => {
    const fetchMock = mockApi({ rota: (_, init) => (init?.method === "POST" ? { status: 200, body: { ...aberta, remaining_amount: "300.00" } } : undefined) });
    const user = userEvent.setup();
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Dar baixa na parcela 2 de Ana Aberta" }));
    const valor = screen.getByLabelText(/Valor pago/);
    await user.clear(valor);
    await user.type(valor, "70000");
    expect(screen.getByText("Pagamento parcial")).toBeInTheDocument();
    expect(screen.getByText(/Saldo de R\$ 300,00 continua em aberto/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

    expect(await screen.findByText("Pagamento parcial registrado com sucesso.")).toBeInTheDocument();
    expect(corpoDe(fetchMock, "POST")).toEqual({ payment_date: "2026-11-04", amount: "700.00" });
  });

  it("a parcela parcial mostra o saldo e oferece a baixa só do que falta", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<AcompanhamentoView />);
    const linha = (await screen.findByText("Duda Parcial")).closest("tr") as HTMLElement;
    expect(within(linha).getByText("Parcial")).toBeInTheDocument();
    expect(within(linha).getByText("saldo R$ 50,00")).toBeInTheDocument();
    await user.click(within(linha).getByRole("button", { name: /Dar baixa/ }));
    expect(screen.getByLabelText(/Valor pago/)).toHaveValue("50,00");
  });

  it("CA02: o histórico mostra cada valor pago e o saldo", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Pagamentos da parcela 5 de Duda Parcial" }));
    expect(await screen.findByText("R$ 150,00")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByText("02/11/2026")).toBeInTheDocument();
    expect(screen.getByText("Saldo em aberto: R$ 50,00")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/installments/i-4/payments"))).toBe(true);
  });

  it("parcela sem pagamento não oferece o histórico", async () => {
    mockApi();
    render(<AcompanhamentoView />);
    await screen.findByText("Ana Aberta");
    expect(screen.queryByRole("button", { name: /Pagamentos da parcela 2/ })).not.toBeInTheDocument();
  });
});

describe("US26-CA02: correção e estorno", () => {
  const abrirPagamentos = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Pagamentos da parcela 4 de Caio Pago" }));
    await screen.findByText("Parcela quitada.");
  };

  it("a Equipe Operacional só consulta o histórico", async () => {
    entrarComo("operator");
    mockApi();
    await abrirPagamentos(userEvent.setup());
    await screen.findByText("R$ 150,00");
    expect(screen.queryByRole("button", { name: "Corrigir data" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Estornar pagamentos" })).not.toBeInTheDocument();
  });

  it("o Administrador corrige a data da baixa", async () => {
    entrarComo("admin");
    const fetchMock = mockApi({ rota: (_, init) => (init?.method === "PUT" ? { status: 200, body: paga } : undefined) });
    const user = userEvent.setup();
    await abrirPagamentos(user);
    const botao = await screen.findByRole("button", { name: "Corrigir data" });
    expect(botao).toBeDisabled(); // data igual à atual
    fireEvent.change(screen.getByLabelText("Corrigir a data da baixa"), { target: { value: "2026-11-02" } });
    await user.click(botao);
    expect(await screen.findByText("Data da baixa corrigida com sucesso.")).toBeInTheDocument();
    expect(corpoDe(fetchMock, "PUT")).toEqual({ payment_date: "2026-11-02" });
  });

  it("não aceita corrigir para uma data futura", async () => {
    entrarComo("admin");
    mockApi();
    await abrirPagamentos(userEvent.setup());
    const botao = await screen.findByRole("button", { name: "Corrigir data" });
    fireEvent.change(screen.getByLabelText("Corrigir a data da baixa"), { target: { value: "2026-11-05" } });
    expect(botao).toBeDisabled();
  });

  it("o estorno pede confirmação antes de apagar", async () => {
    entrarComo("admin");
    const fetchMock = mockApi({ rota: (_, init) => (init?.method === "DELETE" ? { status: 200, body: { ...paga, status: "open" } } : undefined) });
    const user = userEvent.setup();
    await abrirPagamentos(user);
    await user.click(await screen.findByRole("button", { name: "Estornar pagamentos" }));
    expect(chamadaDe(fetchMock, "DELETE")).toBeUndefined();
    expect(screen.getByText(/Todos os pagamentos desta parcela serão apagados/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));
    expect(await screen.findByText("Pagamentos estornados com sucesso.")).toBeInTheDocument();
    expect(chamadaDe(fetchMock, "DELETE")?.[0]).toMatch(/\/installments\/i-3\/payment$/);
  });

  it("mostra a recusa do servidor", async () => {
    entrarComo("admin");
    mockApi({ rota: (_, init) => (init?.method === "DELETE" ? { status: 403, body: { detail: "Você não tem permissão para esta operação." } } : undefined) });
    const user = userEvent.setup();
    await abrirPagamentos(user);
    await user.click(await screen.findByRole("button", { name: "Estornar pagamentos" }));
    await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não tem permissão");
  });
});

describe("#83: faturas do mês no celular", () => {
  it("mostra um cartão por parcela, com a baixa ao alcance, em vez da tabela", async () => {
    simularCelular();
    mockApi();
    render(<AcompanhamentoView />);
    const lista = await screen.findByRole("list", { name: "Faturas do mês" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const cartaoDaAna = within(lista).getByText("Ana Aberta").closest("li") as HTMLElement;
    expect(within(cartaoDaAna).getByText("Ed. Century · 101")).toBeInTheDocument();
    expect(within(cartaoDaAna).getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(within(cartaoDaAna).getByRole("link", { name: "Ver a parcela 2 de Ana Aberta" })).toHaveAttribute("href", "/faturas/i-1");
    expect(cartaoDaAna).toHaveTextContent("vence 20/11/2026");

    await userEvent.click(within(cartaoDaAna).getByRole("button", { name: "Dar baixa na parcela 2 de Ana Aberta" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("sem parcelas, mostra o estado vazio", async () => {
    simularCelular();
    mockApi({ parcelas: [] });
    render(<AcompanhamentoView />);
    expect(await screen.findByText("Nenhuma fatura neste mês")).toBeInTheDocument();
  });
});
