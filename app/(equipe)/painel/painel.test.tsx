import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { RequireAuth } from "@/app/components/RequireAuth";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import { PainelView } from "./PainelView";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

// Mesmos campos das respostas do back.
const indicadores = { active_agreements: 9, monthly_default_rate: 33.33, overdue_installments: 1, installments_due: 3, paid_commissions: "564.00", period: { month: 11, year: 2026 } };
const sarah = { user_id: "u-sarah", user_name: "Sarah Holanda", target_amount: "4000.00", achieved_amount: "1070.00", attainment_percentage: "26.75" };
const paulo = { user_id: "u-paulo", user_name: "Paulo Sem Meta", target_amount: null, achieved_amount: "0.00", attainment_percentage: null };

type Resposta = { status: number; body?: unknown };

function mockApi(rota?: (url: string) => Resposta | undefined) {
  const fn = vi.fn((url: string) => {
    const resposta = rota?.(url) ?? (url.includes("/admin-panel/dashboard") ? { status: 200, body: indicadores } : { status: 200, body: [sarah, paulo] });
    return Promise.resolve(new Response(JSON.stringify(resposta.body), { status: resposta.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const entrarComo = (role: Role) => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Quem Entrou", email: "q@example.com", role } }, true);
const cartao = (rotulo: string) => screen.getByText(rotulo).parentElement?.parentElement as HTMLElement;

beforeEach(() => {
  replace.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T15:00:00Z"));
  entrarComo("admin");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearSession();
});

describe("US34: Painel", () => {
  it("mostra os três indicadores do mês atual", async () => {
    const fetchMock = mockApi();
    render(<PainelView />);
    expect(await screen.findByText("33,33%")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("R$ 564,00")).toBeInTheDocument();
    expect(screen.getByText("1 de 3 parcelas do mês em atraso")).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([url]) => url).join()).toContain("/admin-panel/dashboard?year=2026&month=11");
  });

  it("deixa claro que os acordos ativos não dependem do mês", async () => {
    mockApi();
    render(<PainelView />);
    await screen.findByText("33,33%");
    expect(within(cartao("Acordos ativos")).getByText("Hoje, em todos os condomínios")).toBeInTheDocument();
  });

  it("CA02: trocar o mês busca os indicadores daquele período, inclusive na virada do ano", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi((url) => (url.includes("dashboard?year=2026&month=12") ? { status: 200, body: { ...indicadores, monthly_default_rate: 0, overdue_installments: 0, installments_due: 0 } } : undefined));
    render(<PainelView />);
    await screen.findByText("33,33%");

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(await screen.findByText("Nenhuma parcela vence neste mês")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dezembro 2026" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await screen.findByRole("heading", { name: "Janeiro 2027" });
    await waitFor(() => expect(fetchMock.mock.calls.map(([url]) => url).join()).toContain("year=2027&month=1"));
  });

  it("não mostra os números do mês anterior enquanto carrega o novo", async () => {
    const user = userEvent.setup();
    let liberar: (r: Response) => void = () => {};
    const fn = vi.fn((url: string) => {
      if (url.includes("month=10") && url.includes("dashboard")) return new Promise<Response>((resolve) => { liberar = resolve; });
      return Promise.resolve(new Response(JSON.stringify(url.includes("dashboard") ? indicadores : []), { status: 200 }));
    });
    vi.stubGlobal("fetch", fn);
    render(<PainelView />);
    await screen.findByText("33,33%");

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(await screen.findByText("Carregando indicadores…")).toBeInTheDocument();
    expect(screen.queryByText("33,33%")).not.toBeInTheDocument();
    liberar(new Response(JSON.stringify({ ...indicadores, monthly_default_rate: 5 }), { status: 200 }));
    expect(await screen.findByText("5%")).toBeInTheDocument();
  });

  it("CA01: Atualizar busca os dados de novo", async () => {
    const user = userEvent.setup();
    let ativos = 9;
    mockApi((url) => (url.includes("dashboard") ? { status: 200, body: { ...indicadores, active_agreements: ativos } } : undefined));
    render(<PainelView />);
    await screen.findByText("9");
    ativos = 10;
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(screen.getByText("Atualizado em 04/11/2026 12:00.")).toBeInTheDocument();
  });

  it("mostra o atingimento da equipe, e quem não tem meta", async () => {
    mockApi();
    render(<PainelView />);
    await screen.findByText("Sarah Holanda");
    expect(screen.getByRole("progressbar", { name: "Atingimento de Sarah Holanda" })).toHaveAttribute("aria-valuenow", "27");
    expect(screen.getByText("R$ 1.070,00 de R$ 4.000,00")).toBeInTheDocument();
    expect(screen.getByText("Sem meta neste mês")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Metas e comissões" })).toHaveAttribute("href", "/metas");
  });

  it("explica quando não há equipe", async () => {
    mockApi((url) => (url.includes("/goals") ? { status: 200, body: [] } : undefined));
    render(<PainelView />);
    expect(await screen.findByText("Nenhum colaborador ativo")).toBeInTheDocument();
  });

  it("mostra o erro e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    let falhar = true;
    mockApi((url) => (falhar && url.includes("dashboard") ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<PainelView />);
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByText("33,33%")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar o painel")).not.toBeInTheDocument();
  });
});

describe("Acesso ao Painel", () => {
  it("o item do menu aparece só para o Administrador", () => {
    const { unmount } = render(<PlataformaShell activeId="painel" title="T"><p>x</p></PlataformaShell>);
    expect(screen.getByRole("button", { name: /Painel/ })).toBeInTheDocument();
    unmount();

    entrarComo("operator");
    render(<PlataformaShell activeId="acordos" title="T"><p>x</p></PlataformaShell>);
    expect(screen.queryByRole("button", { name: /Painel/ })).not.toBeInTheDocument();
  });

  it("a Equipe Operacional que abre a página volta para a tela dela", async () => {
    entrarComo("operator");
    render(<RequireAuth roles={["admin"]}><p>conteúdo</p></RequireAuth>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/condominios"));
    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
  });
});
