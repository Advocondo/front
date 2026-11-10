import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simularCelular } from "@/app/lib/celular.test-utils";
import { clearSession, getSession, saveSession } from "@/app/lib/session";
import type { AcordoDoCliente } from "./api";
import { PainelClienteView } from "./PainelClienteView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Mesmos campos de AgreementSummary no back, na ordem dele: atrasados primeiro.
const atrasado: AcordoDoCliente = { id: "a-1", condominium_id: "c-villa", condominium_name: "Res. Villa Verde", debtor_id: "d-1", debtor_name: "Ana Moradora", debtor_unit: "101", status: "atrasado", overdue_installments: 2, next_due_date: "2026-12-10" };
const umaParcela: AcordoDoCliente = { ...atrasado, id: "a-4", condominium_id: "c-century", condominium_name: "Ed. Century", debtor_name: "Duda Moradora", overdue_installments: 1, next_due_date: null };
const emDia: AcordoDoCliente = { ...atrasado, id: "a-2", debtor_id: "d-2", debtor_name: "Bruno Morador", debtor_unit: "202", status: "em_dia", overdue_installments: 0 };
const semVencimento: AcordoDoCliente = { ...emDia, id: "a-3", condominium_id: "c-parque", condominium_name: "Cond. Parque", debtor_name: "Caio Morador", next_due_date: null };

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
    expect(within(linha("Ana Moradora")).getByRole("link", { name: "Ana Moradora" })).toHaveAttribute("href", "/painel-cliente/moradores/d-1");
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

describe("US39: relatório do condomínio", () => {
  const nomesBaixados: string[] = [];

  beforeEach(() => {
    nomesBaixados.length = 0;
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:relatorio"), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      nomesBaixados.push(this.download);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  function mockRelatorio(relatorio: () => Response) {
    const fn = vi.fn((url: string) => Promise.resolve(url.includes("/report") ? relatorio() : new Response(JSON.stringify([atrasado, semVencimento]), { status: 200 })));
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  const pdf = () => new Response("%PDF", { status: 200, headers: { "Content-Type": "application/pdf" } });

  it("CA01: cada condomínio baixa o próprio relatório, como PDF", async () => {
    const user = userEvent.setup();
    const fetchMock = mockRelatorio(pdf);
    render(<PainelClienteView />);
    await user.click(await screen.findByRole("button", { name: "Baixar relatório de Cond. Parque" }));
    await waitFor(() => expect(nomesBaixados).toEqual(["relatorio-cond-parque.pdf"]));
    expect(fetchMock.mock.calls.map(([url]) => url).join()).toContain("/client-panel/condominiums/c-parque/report");
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:relatorio");
  });

  it("uma falha no download avisa e não salva nada", async () => {
    const user = userEvent.setup();
    mockRelatorio(() => new Response(JSON.stringify({ detail: "Condomínio não encontrado." }), { status: 404 }));
    render(<PainelClienteView />);
    await user.click(await screen.findByRole("button", { name: "Baixar relatório de Res. Villa Verde" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Condomínio não encontrado.");
    expect(nomesBaixados).toEqual([]);
    expect(screen.getByText("Ana Moradora")).toBeInTheDocument();
  });

  it("dois condomínios com o mesmo nome continuam separados", async () => {
    const gemeo = { ...semVencimento, id: "a-9", condominium_id: "c-gemeo", condominium_name: atrasado.condominium_name, debtor_name: "Gemeo Morador" };
    com([atrasado, gemeo]);
    render(<PainelClienteView />);
    await screen.findByText("Ana Moradora");
    expect(screen.getAllByRole("table")).toHaveLength(2);
  });
});

describe("#47: parcelas do acordo para o Cliente", () => {
  const parcelas = [
    { number: 2, due_date: "2026-10-30", amount: "300.00", remaining_amount: "200.00", status: "overdue" },
    { number: 3, due_date: "2026-11-30", amount: "300.00", remaining_amount: "300.00", status: "open" },
  ];

  function mockParcelas(resposta: { status: number; body: unknown }) {
    const fn = vi.fn((url: string) => {
      const r = url.includes("/installments") ? resposta : { status: 200, body: [atrasado] };
      return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  const abrir = async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole("button", { name: "Ver parcelas de Ana Moradora" }));

  it("CA02: mostra número, vencimento, valor, saldo e situação, sem honorários", async () => {
    const user = userEvent.setup();
    const fetchMock = mockParcelas({ status: 200, body: parcelas });
    render(<PainelClienteView />);
    await abrir(user);

    const dialogo = await screen.findByRole("dialog");
    const atrasada = (await within(dialogo).findByText("30/10/2026")).closest("tr") as HTMLElement;
    expect(within(atrasada).getByText("R$ 300,00")).toBeInTheDocument();
    expect(within(atrasada).getByText("R$ 200,00")).toBeInTheDocument();
    expect(within(atrasada).getByText("Atrasada")).toBeInTheDocument();
    expect(within(dialogo).getByText("Em aberto")).toBeInTheDocument();
    expect(dialogo.textContent).not.toMatch(/honor[aá]rio|comiss[aã]o/i);
    expect(fetchMock.mock.calls.map(([url]) => url).join()).toContain("/client-panel/agreements/a-1/installments");
  });

  it("explica quando não há parcelas em aberto", async () => {
    const user = userEvent.setup();
    mockParcelas({ status: 200, body: [] });
    render(<PainelClienteView />);
    await abrir(user);
    expect(await screen.findByText("Nenhuma parcela em aberto")).toBeInTheDocument();
  });

  it("CA03: um acordo cancelado depois de a lista abrir avisa, em vez de mostrar parcelas", async () => {
    const user = userEvent.setup();
    mockParcelas({ status: 404, body: { detail: "Acordo não encontrado." } });
    render(<PainelClienteView />);
    await abrir(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("não está mais disponível");
    expect(screen.queryByText("30/10/2026")).not.toBeInTheDocument();
  });

  it("fecha o diálogo e volta ao painel", async () => {
    const user = userEvent.setup();
    mockParcelas({ status: 200, body: parcelas });
    render(<PainelClienteView />);
    await abrir(user);
    const dialogo = await screen.findByRole("dialog");
    await within(dialogo).findByText("30/10/2026");
    await user.click(within(dialogo).getAllByRole("button", { name: "Fechar" }).at(-1) as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Moradora")).toBeInTheDocument();
  });
});

describe("#83: Painel do Cliente no celular", () => {
  it("mostra um item por morador, com situação, atraso, vencimento e Parcelas", async () => {
    simularCelular();
    com([atrasado, emDia]);
    render(<PainelClienteView />);
    const lista = await screen.findByRole("list", { name: "Moradores de Res. Villa Verde" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const ana = within(lista).getByText("Ana Moradora").closest("li") as HTMLElement;
    expect(ana).toHaveTextContent("Unidade 101");
    expect(ana).toHaveTextContent("2 parcelas em atraso · próximo vencimento 10/12/2026");
    expect(within(lista).getByText("Bruno Morador").closest("li")).toHaveTextContent("Nada em atraso");
    expect(within(ana).getByRole("link", { name: "Ana Moradora" })).toHaveAttribute("href", "/painel-cliente/moradores/d-1");
    expect(within(ana).getByRole("button", { name: "Ver parcelas de Ana Moradora" })).toBeInTheDocument();
  });
});
