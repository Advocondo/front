import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PainelView } from "@/app/(equipe)/painel/PainelView";
import { clearSession, saveSession } from "@/app/lib/session";
import { CondominiosView } from "./CondominiosView";
import { diasAte } from "./format";
import type { CondominioApi } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Mesmos campos de CondominiumResponse no back.
const base = { cnpj: null, zip_code: null, street: null, neighborhood: null, city: null, state: null, manager_name: null, manager_email: null, manager_phone: null, contract_start_date: "2025-01-01" };
const perto: CondominioApi = { ...base, id: "c-perto", name: "Cond. Jardins", contract_renewal_date: "2026-12-05", near_renewal: true };
const vencido: CondominioApi = { ...base, id: "c-vencido", name: "Ed. Vencido", contract_renewal_date: "2026-11-01", near_renewal: true };
const longe: CondominioApi = { ...base, id: "c-longe", name: "Res. Longe", contract_renewal_date: "2028-01-01", near_renewal: false };
const semData: CondominioApi = { ...base, id: "c-sem", name: "Sem Data", contract_renewal_date: null, near_renewal: false };

type Resposta = { status: number; body?: unknown };

function mockApi(lista: CondominioApi[], rota: (url: string, init?: RequestInit) => Resposta | undefined = () => undefined) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const r = rota(url, init) ?? (() => {
      if (url.includes("/notifications")) return { status: 200, body: { unread_count: 0, notifications: [] } };
      if (init?.method === "PATCH") return { status: 200, body: perto };
      if (url.includes("/condominiums")) return { status: 200, body: lista };
      if (url.includes("/admin-panel/dashboard")) return { status: 200, body: { active_agreements: 1, monthly_default_rate: 0, overdue_installments: 0, installments_due: 0, paid_commissions: "0.00", period: { month: 11, year: 2026 } } };
      return { status: 200, body: [] };
    })();
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const linha = (nome: string) => screen.getByText(nome).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T15:00:00Z"));
  saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana", email: "a@example.com", role: "admin" } }, true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearSession();
});

describe("US23-CA01: sinalização na lista", () => {
  it("sinaliza quem está perto ou passou da data, com os dias, e deixa os outros sem aviso", async () => {
    mockApi([perto, vencido, longe, semData]);
    render(<CondominiosView />);
    await screen.findByText("Cond. Jardins");
    expect(within(linha("Cond. Jardins")).getByText("Renova em 30 dias")).toBeInTheDocument();
    expect(within(linha("Ed. Vencido")).getByText("Venceu há 4 dias")).toBeInTheDocument();
    expect(within(linha("Res. Longe")).queryByText(/Renova|Venceu/)).not.toBeInTheDocument();
    expect(within(linha("Res. Longe")).queryByRole("button", { name: /Registrar renovação/ })).not.toBeInTheDocument();
    expect(within(linha("Sem Data")).queryByRole("button", { name: /Registrar renovação/ })).not.toBeInTheDocument();
  });

  it.each([
    ["2026-11-05", 0],
    ["2026-11-06", 1],
    ["2026-11-04", -1],
    ["2027-03-14", 129],
  ])("conta os dias até %s no horário de Brasília", (data, dias) => {
    expect(diasAte(data)).toBe(dias);
  });

  it.each([
    ["2026-11-05", "Renova hoje"],
    ["2026-11-06", "Renova amanhã"],
    ["2026-11-04", "Venceu há 1 dia"],
  ])("escreve o prazo de %s", async (data, texto) => {
    mockApi([{ ...perto, contract_renewal_date: data }]);
    render(<CondominiosView />);
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });
});

describe("US23-CA02: registrar renovação", () => {
  const abrir = async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole("button", { name: "Registrar renovação de Cond. Jardins" }));

  it("envia só as datas do contrato, e a lista é recarregada", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi([perto]);
    render(<CondominiosView />);
    await abrir(user);
    expect(screen.getByLabelText(/Renovado em/)).toHaveValue("2026-11-05");
    fireEvent.change(screen.getByLabelText(/Próxima renovação/), { target: { value: "2028-12-05" } });
    const listas = fetchMock.mock.calls.filter(([url]) => url.includes("/condominiums?")).length;
    await user.click(screen.getByRole("button", { name: "Salvar renovação" }));

    expect(await screen.findByText("Renovação de Cond. Jardins registrada com sucesso.")).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patch?.[0]).toMatch(/\/condominiums\/c-perto$/);
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ contract_start_date: "2026-11-05", contract_renewal_date: "2028-12-05" });
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.includes("/condominiums?")).length).toBeGreaterThan(listas));
  });

  it("exige a próxima data, depois da data da renovação, sem chamar o back", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi([perto]);
    render(<CondominiosView />);
    await abrir(user);
    await user.click(screen.getByRole("button", { name: "Salvar renovação" }));
    expect(await screen.findByText("Informe a próxima renovação.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Próxima renovação/), { target: { value: "2026-11-05" } });
    await user.click(screen.getByRole("button", { name: "Salvar renovação" }));
    expect(await screen.findByText("A próxima renovação precisa ser depois da data da renovação.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("mostra a recusa do back e mantém o diálogo aberto", async () => {
    const user = userEvent.setup();
    mockApi([perto], (_url, init) => (init?.method === "PATCH" ? { status: 422, body: { detail: "Não foi possível." } } : undefined));
    render(<CondominiosView />);
    await abrir(user);
    fireEvent.change(screen.getByLabelText(/Próxima renovação/), { target: { value: "2028-12-05" } });
    await user.click(screen.getByRole("button", { name: "Salvar renovação" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível.");
    expect(screen.getByRole("button", { name: "Salvar renovação" })).toBeInTheDocument();
  });
});

describe("US23: aviso no Painel", () => {
  it("lista os contratos perto da renovação, com link para a carteira", async () => {
    mockApi([perto, vencido, longe]);
    render(<PainelView />);
    expect(await screen.findByText("2 contratos perto da renovação")).toBeInTheDocument();
    expect(screen.getByText("Cond. Jardins (05/12/2026), Ed. Vencido (01/11/2026)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver condomínios" })).toHaveAttribute("href", "/condominios");
    expect(screen.queryByText(/Res\. Longe/)).not.toBeInTheDocument();
  });

  it("resume quando são muitos", async () => {
    const muitos = ["A", "B", "C", "D", "E"].map((n) => ({ ...perto, id: n, name: `Cond ${n}` }));
    mockApi(muitos);
    render(<PainelView />);
    expect(await screen.findByText("5 contratos perto da renovação")).toBeInTheDocument();
    expect(screen.getByText(/Cond C \(05\/12\/2026\) e mais 2/)).toBeInTheDocument();
  });

  it("usa o singular", async () => {
    mockApi([perto]);
    render(<PainelView />);
    expect(await screen.findByText("1 contrato perto da renovação")).toBeInTheDocument();
  });

  it("sem contratos perto, não mostra o aviso", async () => {
    mockApi([longe]);
    render(<PainelView />);
    await screen.findByText("Acordos ativos");
    expect(screen.queryByText(/perto da renovação/)).not.toBeInTheDocument();
  });

  it("uma falha ao buscar os condomínios não atrapalha os indicadores", async () => {
    mockApi([], (url) => (url.includes("/condominiums") ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<PainelView />);
    expect(await screen.findByText("Acordos ativos")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar o painel")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
