import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FaturaDetalheView } from "@/app/(equipe)/faturas/[id]/FaturaDetalheView";
import { MetasView } from "@/app/(equipe)/metas/MetasView";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import type { ParcelaDoMes } from "./api";
import { AcompanhamentoView } from "./AcompanhamentoView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const base = { agreement_id: "a-1", condominium: { id: "c-1", name: "Ed. Century" }, debtor: { id: "d-1", name: "Luciana Freire", unit: "903" }, number: 2, due_date: "2026-11-10", amount: "1250.00", condominium_amount: "1000.00", fee_amount: "250.00", payment_date: null, remaining_amount: "1250.00", invoice_number: null, invoice_date: null, status: "open" as const };
const aberta: ParcelaDoMes = { ...base, id: "p-aberta", debtor: { id: "d-2", name: "Marcelo Aberto", unit: "101" } };
const semNota: ParcelaDoMes = { ...base, id: "p-sem", status: "paid", payment_date: "2026-11-03", remaining_amount: "0.00" };
const comNota: ParcelaDoMes = { ...semNota, id: "p-com", debtor: { id: "d-3", name: "Jorge Matias", unit: "204" }, invoice_number: "000124", invoice_date: "2026-11-04" };

type Resposta = { status: number; body?: unknown; bruto?: string };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi({ parcelas = [aberta, semNota, comNota], pendencias = [semNota], rota }: { parcelas?: ParcelaDoMes[]; pendencias?: ParcelaDoMes[]; rota?: Rota } = {}) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const padrao = (): Resposta => {
      if (url.includes("/notifications")) return { status: 200, body: { unread_count: 0, notifications: [] } };
      if (url.includes("/reports/export")) return { status: 200, bruto: "xlsx" };
      if (init?.method) return { status: 200, body: semNota };
      if (url.includes("/paid-without-invoice")) return { status: 200, body: pendencias };
      if (url.includes("/users/lawyers")) return { status: 200, body: [{ id: "l-1", name: "Dra. Sarah", oab_number: "DF1" }] };
      if (url.includes("/condominiums")) return { status: 200, body: [{ id: "c-1", name: "Ed. Century" }] };
      if (url.includes("/installments")) return { status: 200, body: parcelas };
      return { status: 200, body: [] };
    };
    const r = rota?.(url, init) ?? padrao();
    return Promise.resolve(new Response(r.bruto ?? JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const entrarComo = (role: Role) => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana", email: "a@example.com", role } }, true);
const linha = (nome: string) => screen.getByText(nome).closest("tr") as HTMLElement;
const envio = (fn: ReturnType<typeof mockApi>, metodo: string) => fn.mock.calls.find(([, init]) => init?.method === metodo);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T15:00:00Z"));
  entrarComo("admin");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearSession();
});

describe("US29: nota fiscal nas faturas do mês", () => {
  it("mostra a nota de quem tem e sinaliza quem está paga sem nota", async () => {
    mockApi();
    render(<AcompanhamentoView />);
    await screen.findByText("Luciana Freire");
    expect(within(linha("Luciana Freire")).getByText("Sem nota fiscal")).toBeInTheDocument();
    expect(within(linha("Jorge Matias")).getByText("NF 000124")).toBeInTheDocument();
    expect(within(linha("Marcelo Aberto")).queryByText("Sem nota fiscal")).not.toBeInTheDocument();
    expect(within(linha("Marcelo Aberto")).queryByRole("button", { name: /nota/i })).not.toBeInTheDocument();
  });

  it("CA01: registra o número e a data, mantendo os zeros à esquerda", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Registrar a nota da parcela 2 de Luciana Freire" }));
    await user.type(screen.getByLabelText(/^Número/), "00a0124");
    expect(screen.getByLabelText(/^Número/)).toHaveValue("000124");
    await user.click(screen.getByRole("button", { name: "Salvar nota fiscal" }));

    expect(await screen.findByText("Nota fiscal registrada com sucesso.")).toBeInTheDocument();
    const chamada = envio(fetchMock, "PUT");
    expect(chamada?.[0]).toMatch(/\/installments\/p-sem\/invoice$/);
    expect(JSON.parse(chamada?.[1]?.body as string)).toEqual({ number: "000124", issue_date: "2026-11-05" });
  });

  it("alterar traz a nota atual preenchida", async () => {
    const user = userEvent.setup();
    mockApi();
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Alterar a nota da parcela 2 de Jorge Matias" }));
    expect(screen.getByLabelText(/^Número/)).toHaveValue("000124");
    expect(screen.getByLabelText(/Data de emissão/)).toHaveValue("2026-11-04");
    expect(screen.getByRole("heading", { name: "Alterar nota fiscal" })).toBeInTheDocument();
  });

  it("recusa número vazio e data futura sem chamar o back", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Registrar a nota da parcela 2 de Luciana Freire" }));
    fireEvent.change(screen.getByLabelText(/Data de emissão/), { target: { value: "2027-01-01" } });
    await user.click(screen.getByRole("button", { name: "Salvar nota fiscal" }));
    expect(await screen.findByText("Informe o número da nota fiscal.")).toBeInTheDocument();
    expect(screen.getByText("A data de emissão não pode ser futura.")).toBeInTheDocument();
    expect(envio(fetchMock, "PUT")).toBeUndefined();
  });

  it("mostra a recusa do back", async () => {
    const user = userEvent.setup();
    mockApi({ rota: (_url, init) => (init?.method === "PUT" ? { status: 422, body: { detail: "A parcela ainda não foi paga." } } : undefined) });
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Registrar a nota da parcela 2 de Luciana Freire" }));
    await user.type(screen.getByLabelText(/^Número/), "1");
    await user.click(screen.getByRole("button", { name: "Salvar nota fiscal" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A parcela ainda não foi paga.");
  });

  it("CA02: em Pagas, o filtro mostra só as sem nota do mês, com a contagem", async () => {
    const user = userEvent.setup();
    mockApi();
    render(<AcompanhamentoView />);
    await screen.findByText("Luciana Freire");
    expect(screen.queryByRole("button", { name: /Pagas sem nota fiscal ·/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Pagas/ }));
    await user.click(await screen.findByRole("button", { name: "Pagas sem nota fiscal · 1" }));
    expect(screen.getByText("Luciana Freire")).toBeInTheDocument();
    expect(screen.queryByText("Jorge Matias")).not.toBeInTheDocument();
  });

  it("CA02: a lista de pendências vale para todos os meses e permite registrar ali", async () => {
    const user = userEvent.setup();
    const antiga = { ...semNota, id: "p-antiga", debtor: { id: "d-9", name: "Tânia Antiga", unit: "1" }, payment_date: "2025-03-10" };
    let pendencias = [antiga];
    const fetchMock = mockApi({ rota: (url, init) => (url.includes("/paid-without-invoice") ? { status: 200, body: pendencias } : init?.method === "PUT" ? ((pendencias = []), { status: 200, body: antiga }) : undefined) });
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Todas as pendências de nota" }));
    expect(await screen.findByText("Tânia Antiga · parcela 2")).toBeInTheDocument();
    expect(screen.getByText(/pago em 10\/03\/2025/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar a nota da parcela 2 de Tânia Antiga" }));
    await user.type(screen.getByLabelText(/^Número/), "55");
    await user.click(screen.getByRole("button", { name: "Salvar nota fiscal" }));
    expect(await screen.findByText("Nenhuma parcela paga sem nota fiscal.")).toBeInTheDocument();
    expect(envio(fetchMock, "PUT")?.[0]).toMatch(/\/installments\/p-antiga\/invoice$/);
  });
});

describe("US29: nota na baixa", () => {
  const abrirBaixa = async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole("button", { name: "Dar baixa na parcela 2 de Marcelo Aberto" }));

  it("na baixa integral, grava a baixa e depois a nota", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcompanhamentoView />);
    await abrirBaixa(user);
    await user.click(screen.getByRole("checkbox", { name: /Nota fiscal já emitida/ }));
    await user.type(screen.getByLabelText(/Número da nota/), "000124");
    await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

    expect(await screen.findByText("Baixa registrada com sucesso.")).toBeInTheDocument();
    expect(JSON.parse(envio(fetchMock, "PUT")?.[1]?.body as string)).toEqual({ number: "000124", issue_date: "2026-11-05" });
    const ordem = fetchMock.mock.calls.filter(([, init]) => init?.method).map(([, init]) => init?.method);
    expect(ordem).toEqual(["POST", "PUT"]);
  });

  it("marcada, exige o número antes de gravar a baixa", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcompanhamentoView />);
    await abrirBaixa(user);
    await user.click(screen.getByRole("checkbox", { name: /Nota fiscal já emitida/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    expect(await screen.findByText("Informe o número da nota fiscal.")).toBeInTheDocument();
    expect(envio(fetchMock, "POST")).toBeUndefined();
  });

  it("uma falha na nota não parece falha na baixa, que já foi gravada", async () => {
    const user = userEvent.setup();
    mockApi({ rota: (_url, init) => (init?.method === "PUT" ? { status: 500, body: { detail: "Erro" } } : undefined) });
    render(<AcompanhamentoView />);
    await abrirBaixa(user);
    await user.click(screen.getByRole("checkbox", { name: /Nota fiscal já emitida/ }));
    await user.type(screen.getByLabelText(/Número da nota/), "1");
    await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));
    expect(await screen.findByText("Baixa registrada, mas a nota fiscal não foi salva. Registre a nota de novo.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("em pagamento parcial, não oferece a nota, que o back só aceita em parcela quitada", async () => {
    const user = userEvent.setup();
    mockApi();
    render(<AcompanhamentoView />);
    await abrirBaixa(user);
    await user.clear(screen.getByLabelText(/Valor pago/));
    await user.type(screen.getByLabelText(/Valor pago/), "10000");
    expect(screen.queryByRole("checkbox", { name: /Nota fiscal já emitida/ })).not.toBeInTheDocument();
  });
});

describe("US29: nota na fatura", () => {
  const fatura = (parcela: ParcelaDoMes) => (url: string, init?: RequestInit): Resposta | undefined => {
    if (init?.method) return undefined;
    if (url.endsWith("/payments")) return { status: 200, body: [] };
    if (url.includes("/installments/")) return { status: 200, body: parcela };
    if (url.includes("/agreements/")) return { status: 200, body: { id: "a-1", status: "active" } };
    return undefined;
  };

  it("oferece registrar na parcela paga e mostra quando falta", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ rota: fatura(semNota) });
    render(<FaturaDetalheView id="p-sem" />);
    await user.click(await screen.findByRole("button", { name: "Registrar nota fiscal" }));
    await user.type(screen.getByLabelText(/^Número/), "9");
    await user.click(screen.getByRole("button", { name: "Salvar nota fiscal" }));
    expect(await screen.findByText("Nota fiscal registrada com sucesso.")).toBeInTheDocument();
    expect(envio(fetchMock, "PUT")?.[0]).toMatch(/\/installments\/p-sem\/invoice$/);
  });

  it("não oferece na parcela em aberto", async () => {
    mockApi({ rota: fatura(aberta) });
    render(<FaturaDetalheView id="p-aberta" />);
    await screen.findByText("Dados da fatura");
    expect(screen.queryByRole("button", { name: /nota fiscal/ })).not.toBeInTheDocument();
  });
});

describe("US35: exportar", () => {
  const nomes: string[] = [];

  beforeEach(() => {
    nomes.length = 0;
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      nomes.push(this.download);
    });
  });

  const urlDaExportacao = (fn: ReturnType<typeof mockApi>) => new URL(fn.mock.calls.find(([url]) => url.includes("/reports/export"))?.[0] as string);

  it("CA01: leva o mês, o condomínio, o responsável e a aba da tela", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcompanhamentoView />);
    await screen.findByRole("option", { name: "Ed. Century" });
    await user.selectOptions(screen.getByLabelText("Filtrar por condomínio"), "c-1");
    await user.selectOptions(screen.getByLabelText("Filtrar por responsável"), "l-1");
    await user.click(screen.getByRole("tab", { name: /Atrasadas/ }));
    await user.click(screen.getByRole("button", { name: "Exportar planilha" }));

    await waitFor(() => expect(nomes).toEqual(["acompanhamento_2026_11.xlsx"]));
    expect(Object.fromEntries(urlDaExportacao(fetchMock).searchParams)).toEqual({ year: "2026", month: "11", condominium_id: "c-1", responsible_lawyer_id: "l-1", status: "overdue" });
  });

  it("sem filtros, envia só o mês", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Exportar planilha" }));
    await waitFor(() => expect(nomes).toHaveLength(1));
    expect(Object.fromEntries(urlDaExportacao(fetchMock).searchParams)).toEqual({ year: "2026", month: "11" });
  });

  it("só o Administrador vê o botão", async () => {
    entrarComo("operator");
    mockApi();
    render(<AcompanhamentoView />);
    await screen.findByText("Luciana Freire");
    expect(screen.queryByRole("button", { name: "Exportar planilha" })).not.toBeInTheDocument();
  });

  it("mostra a falha ao exportar", async () => {
    const user = userEvent.setup();
    mockApi({ rota: (url) => (url.includes("/reports/export") ? { status: 500, body: { detail: "Erro" } } : undefined) });
    render(<AcompanhamentoView />);
    await user.click(await screen.findByRole("button", { name: "Exportar planilha" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(nomes).toEqual([]);
  });
});

describe("US33: visão consolidada em Metas", () => {
  const indicadores = { active_agreements: 7, monthly_default_rate: 12.5, overdue_installments: 1, installments_due: 8, paid_commissions: "564.00", period: { month: 11, year: 2026 } };
  const bia = { user_id: "u-bia", user_name: "Bia Equipe", target_amount: "4000.00", achieved_amount: "1070.00", attainment_percentage: "26.75" };
  const resumo = { office_total_revenue: "564.00", team_commissions: [{ user_id: "u-bia", user_name: "Bia Equipe", commission: "214.00" }, { user_id: "u-ex", user_name: "Caio Inativo", commission: "50.00" }, { user_id: "u-zero", user_name: "Zero Comissão", commission: "0.00" }], period: { month: 11, year: 2026 } };

  function mockMetas() {
    const fn = vi.fn((url: string) => {
      const body = url.includes("/notifications") ? { unread_count: 0, notifications: [] } : url.includes("/admin-panel/financial") ? resumo : url.includes("/admin-panel/dashboard") ? indicadores : [bia];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("CA01: mostra o faturamento e o total de comissões da equipe", async () => {
    mockMetas();
    render(<MetasView />);
    expect(await screen.findByText("R$ 564,00")).toBeInTheDocument();
    expect(screen.getByText("Comissões da equipe").parentElement?.parentElement).toHaveTextContent("R$ 264,00");
    expect(screen.getByText("Honorários recebidos no mês")).toBeInTheDocument();
  });

  it("CA01: quem tem comissão mas não está nas metas aparece, para o total fechar", async () => {
    mockMetas();
    render(<MetasView />);
    const fora = await screen.findByText("Caio Inativo");
    expect(fora.closest("li")).toHaveTextContent("R$ 50,00");
    expect(screen.queryByText("Zero Comissão")).not.toBeInTheDocument();
  });

  it("em outro mês, não inventa o total, que a API só tem do mês atual", async () => {
    const user = userEvent.setup();
    const fetchMock = mockMetas();
    render(<MetasView />);
    await screen.findByText("Caio Inativo");
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await waitFor(() => expect(screen.getByText("Comissões da equipe").parentElement?.parentElement).toHaveTextContent("—"));
    expect(screen.queryByText("Caio Inativo")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("CA02: a Equipe Operacional não vê o consolidado", async () => {
    entrarComo("operator");
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("/goals/me") ? { id: "g", user_id: "u", year: 2026, month: 11, target_amount: "1.00", achieved_amount: "0.00", attainment_percentage: "0.00" } : url.includes("/notifications") ? { unread_count: 0, notifications: [] } : { goal: null, accumulated_commission: "0.00", remaining_to_goal: null, period: { month: 11, year: 2026 } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<MetasView />);
    await screen.findByText("Minha meta do mês");
    expect(screen.queryByText("Comissões da equipe")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/admin-panel"))).toBe(false);
  });
});
