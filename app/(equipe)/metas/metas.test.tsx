import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import type { MetaDoColaborador, MinhaMeta } from "./api";
import { MetasView } from "./MetasView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Mesmos campos das respostas do back.
const minhaMeta: MinhaMeta = { id: "g-1", user_id: "u-1", year: 2026, month: 11, target_amount: "4000.00", achieved_amount: "1070.00", attainment_percentage: "26.75" };
const bia: MetaDoColaborador = { user_id: "u-bia", user_name: "Bia Equipe", target_amount: "4000.00", achieved_amount: "1000.00", attainment_percentage: "25.00" };
const caio: MetaDoColaborador = { user_id: "u-caio", user_name: "Caio Sem Meta", target_amount: null, achieved_amount: "0.00", attainment_percentage: null };
const resumoOperador = { goal: "4000.00", accumulated_commission: "214.00", remaining_to_goal: "3786.00", period: { month: 11, year: 2026 } };
const resumoEscritorio = { office_total_revenue: "564.00", team_commissions: [{ user_id: "u-bia", user_name: "Bia Equipe", commission: "45.12" }], period: { month: 11, year: 2026 } };
const indicadores = { active_agreements: 7, monthly_default_rate: 12.5, overdue_installments: 1, installments_due: 8, paid_commissions: "564.00", period: { month: 11, year: 2026 } };

type Resposta = { status: number; body?: unknown };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi(rota?: Rota) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const padrao = (): Resposta => {
      if (url.includes("/goals/me")) return { status: 200, body: minhaMeta };
      if (url.includes("/operator-panel/financial")) return { status: 200, body: resumoOperador };
      if (url.includes("/admin-panel/financial")) return { status: 200, body: resumoEscritorio };
      if (url.includes("/admin-panel/dashboard")) return { status: 200, body: indicadores };
      return { status: 200, body: [bia, caio] };
    };
    const resposta = rota?.(url, init) ?? padrao();
    return Promise.resolve(new Response(resposta.body === undefined ? null : JSON.stringify(resposta.body), { status: resposta.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const entrarComo = (role: Role) => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Quem Entrou", email: "x@example.com", role } }, true);
const urls = (fn: ReturnType<typeof mockApi>) => fn.mock.calls.map(([url]) => url);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearSession();
});

describe("US32: visão do colaborador", () => {
  beforeEach(() => entrarComo("operator"));

  it("CA01: mostra a própria meta, o atingimento, quanto falta e a comissão", async () => {
    mockApi();
    render(<MetasView />);
    expect(await screen.findByText("26,8%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Atingimento da minha meta" })).toHaveAttribute("aria-valuenow", "27");
    expect(screen.getByText("R$ 4.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.070,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.930,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 214,00")).toBeInTheDocument();
    expect(screen.getByText("Você vê só os seus números")).toBeInTheDocument();
  });

  it("CA02: nunca consulta nem mostra dados do escritório ou de colegas", async () => {
    const fetchMock = mockApi();
    render(<MetasView />);
    await screen.findByText("26,8%");
    expect(urls(fetchMock).some((u) => u.includes("/admin-panel") || /\/goals\?/.test(u))).toBe(false);
    expect(screen.queryByText("Metas por colaborador")).not.toBeInTheDocument();
    expect(screen.queryByText("Faturamento do mês")).not.toBeInTheDocument();
  });

  it("explica que os dois números têm bases diferentes", async () => {
    mockApi();
    render(<MetasView />);
    expect(await screen.findByText("Honorários recebidos dos acordos que cadastrei")).toBeInTheDocument();
    expect(screen.getByText(/nos acordos em que você é o advogado responsável/)).toBeInTheDocument();
  });

  it("mês sem meta é um estado normal, não um erro", async () => {
    mockApi((url) => (url.includes("/goals/me") ? { status: 404, body: { detail: "Meta não encontrada." } } : undefined));
    render(<MetasView />);
    expect(await screen.findByText("Sem meta neste mês")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar os dados")).not.toBeInTheDocument();
    expect(screen.getByText("R$ 214,00")).toBeInTheDocument();
  });

  it("meta superada mostra o percentual real, com a barra cheia", async () => {
    mockApi((url) => (url.includes("/goals/me") ? { status: 200, body: { ...minhaMeta, achieved_amount: "4400.00", attainment_percentage: "110.00" } } : undefined));
    render(<MetasView />);
    expect(await screen.findByText("110%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Meta atingida")).toBeInTheDocument();
  });

  it("em outro mês, busca a meta daquele mês e avisa que a comissão é só do atual", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<MetasView />);
    await screen.findByText("26,8%");
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByText("Outubro 2026")).toBeInTheDocument();
    expect(await screen.findByText("A comissão acumulada só está disponível para o mês atual.")).toBeInTheDocument();
    expect(urls(fetchMock).at(-1)).toMatch(/\/goals\/me\?year=2026&month=10/);
  });

  it("mostra o erro de carga e permite tentar de novo", async () => {
    let falhar = true;
    mockApi((url) => (url.includes("/goals/me") && falhar ? { status: 500 } : undefined));
    const user = userEvent.setup();
    render(<MetasView />);
    expect(await screen.findByText("Não foi possível carregar os dados")).toBeInTheDocument();
    falhar = false;
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("26,8%")).toBeInTheDocument();
  });
});

describe("US36: visão do Administrador", () => {
  beforeEach(() => entrarComo("admin"));

  it("mostra os indicadores e a equipe, com e sem meta", async () => {
    const fetchMock = mockApi();
    render(<MetasView />);
    expect(await screen.findByText("Bia Equipe")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.000,00 de R$ 4.000,00")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    // Na linha da pessoa e no total da equipe, que aqui tem só ela.
    expect(screen.getAllByText("R$ 45,12")).toHaveLength(2);
    expect(screen.getByText("Sem meta neste mês")).toBeInTheDocument();
    expect(screen.getByText("R$ 564,00")).toBeInTheDocument();
    expect(screen.getByText("12,5%")).toBeInTheDocument();
    expect(urls(fetchMock).some((u) => u.includes("/operator-panel") || u.includes("/goals/me"))).toBe(false);
  });

  it("define a meta pela linha, no mês da tela, e recarrega", async () => {
    const fetchMock = mockApi((_, init) => (init?.method === "PUT" ? { status: 200, body: {} } : undefined));
    const user = userEvent.setup();
    render(<MetasView />);
    await user.click(await screen.findByRole("button", { name: "Definir a meta de Caio Sem Meta" }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByLabelText(/Colaborador/)).toHaveValue("u-caio");
    expect(within(dialogo).getByLabelText(/Colaborador/)).toBeDisabled();
    await user.type(within(dialogo).getByLabelText(/Meta/), "450000");
    expect(within(dialogo).getByLabelText(/Meta/)).toHaveValue("4.500,00");
    const antes = fetchMock.mock.calls.length;
    await user.click(within(dialogo).getByRole("button", { name: "Salvar meta" }));

    expect(await screen.findByText("Meta de Caio Sem Meta salva com sucesso.")).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(put?.[0]).toMatch(/\/users\/u-caio\/goals\/2026\/11$/);
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({ target_amount: "4500.00" });
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(antes + 1));
  });

  it("a edição abre com o valor atual", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<MetasView />);
    await user.click(await screen.findByRole("button", { name: "Definir a meta de Bia Equipe" }));
    expect(within(screen.getByRole("dialog")).getByLabelText(/Meta/)).toHaveValue("4.000,00");
  });

  it("o botão geral deixa escolher o colaborador, e valida os campos", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<MetasView />);
    await screen.findByText("Bia Equipe");
    await user.click(screen.getByRole("button", { name: /^Definir meta$/ }));
    const dialogo = screen.getByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar meta" }));
    expect(await screen.findByText("Selecione o colaborador.")).toBeInTheDocument();
    expect(screen.getByText("Informe o valor da meta.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("mostra a recusa do servidor e os erros por campo", async () => {
    let tentativa = 0;
    mockApi((_, init) => {
      if (init?.method !== "PUT") return undefined;
      tentativa += 1;
      return tentativa === 1 ? { status: 422, body: { detail: "Só membros da Equipe Operacional podem ter meta." } } : { status: 422, body: { detail: [{ loc: ["body", "target_amount"], msg: "Value error, Valor recusado." }] } };
    });
    const user = userEvent.setup();
    render(<MetasView />);
    await user.click(await screen.findByRole("button", { name: "Definir a meta de Bia Equipe" }));
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Só membros da Equipe Operacional");
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));
    expect(await screen.findByText("Valor recusado.")).toBeInTheDocument();
  });

  it("em outro mês, não pede a comissão, que a API só tem do mês atual", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<MetasView />);
    await screen.findByText("Bia Equipe");
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(await screen.findByText("As comissões por colaborador só estão disponíveis para o mês atual.")).toBeInTheDocument();
    expect(screen.queryByText("R$ 45,12")).not.toBeInTheDocument();
    const ultimasChamadas = urls(fetchMock).slice(-2);
    expect(ultimasChamadas.some((u) => /\/goals\?year=2026&month=12/.test(u))).toBe(true);
    expect(ultimasChamadas.some((u) => /\/admin-panel\/dashboard\?year=2026&month=12/.test(u))).toBe(true);
  });

  it("sem colaborador ativo, orienta a convidar", async () => {
    mockApi((url) => (/\/goals\?/.test(url) ? { status: 200, body: [] } : undefined));
    render(<MetasView />);
    expect(await screen.findByText("Nenhum colaborador ativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Definir meta/ })).toBeDisabled();
  });

  it("mostra o erro de carga", async () => {
    mockApi((url) => (/\/goals\?/.test(url) ? { status: 403, body: { detail: "Você não tem permissão para esta operação." } } : undefined));
    render(<MetasView />);
    expect(await screen.findByText("Você não tem permissão para esta operação.")).toBeInTheDocument();
  });
});

it("o item Metas e comissões aparece no menu da equipe", () => {
  entrarComo("operator");
  render(<PlataformaShell activeId="acordos" title="T"><p>c</p></PlataformaShell>);
  expect(screen.getByText("Metas e comissões")).toBeInTheDocument();
});
