import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CondominioApi } from "@/app/(equipe)/condominios/types";
import type { Devedor } from "@/app/(equipe)/devedores/types";
import { AcordoDetalheView } from "./[id]/AcordoDetalheView";
import { AcordosView } from "./AcordosView";
import type { Acordo, Advogado, Parcela } from "./types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const CONDO_ID = "3f1c2b7e-8a44-4d3e-9c11-2f6a7b8c9d01";

// Mesmos campos das respostas do back.
const condominio: CondominioApi = {
  id: CONDO_ID, name: "Ed. Century", cnpj: null, zip_code: null, street: null, neighborhood: null, city: null, state: null, manager_name: null,
  manager_email: null, manager_phone: null, contract_start_date: null, contract_renewal_date: null, near_renewal: false,
};
const devedor: Devedor = { id: "d-1", condominium_id: CONDO_ID, name: "Cláudio Bezerra", unit: "1101", phone: "61912345678", email: null };
const advogada: Advogado = { id: "l-1", name: "Dra. Sarah", oab_number: "DF12345" };
const acordo: Acordo = {
  id: "a-1", status: "active", total_amount: "5500.00", fee_amount: "1100.00", fee_percentage: "20.00", installment_count: 2,
  condominium: { id: CONDO_ID, name: "Ed. Century" }, debtor: { id: "d-1", name: "Cláudio Bezerra", unit: "1101" }, responsible_lawyer: null,
  cancelled_at: null, cancellation_reason: null,
};
const parcelaBase = { agreement_id: "a-1", condominium_amount: "2200.00", fee_amount: "550.00", payment_date: null, remaining_amount: "2750.00", invoice_number: null, invoice_date: null };
const p1: Parcela = { ...parcelaBase, id: "i-1", number: 1, due_date: "2026-10-10", amount: "2750.00", status: "open" };
const p2: Parcela = { ...parcelaBase, id: "i-2", number: 2, due_date: "2026-11-10", amount: "2750.00", status: "open" };

type Resposta = { status: number; body: unknown };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi({ rota, acordos = [acordo], devedores = [devedor], plano = [p1, p2], dadosAcordo = acordo }: { rota?: Rota; acordos?: Acordo[]; devedores?: Devedor[]; plano?: Parcela[]; dadosAcordo?: Acordo } = {}) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const padrao = (): Resposta => {
      if (url.includes("/condominiums")) return { status: 200, body: [condominio] };
      if (url.includes("/users/lawyers")) return { status: 200, body: [advogada] };
      if (url.includes("/debtors")) return { status: 200, body: devedores };
      if (url.includes("/installments")) return { status: 200, body: plano };
      if (url.includes("/agreements/")) return { status: 200, body: dadosAcordo };
      return { status: 200, body: acordos };
    };
    const resposta = rota?.(url, init) ?? padrao();
    return Promise.resolve(new Response(JSON.stringify(resposta.body), { status: resposta.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const chamada = (fn: ReturnType<typeof mockApi>, metodo: string, n = 0) => fn.mock.calls.filter(([, init]) => init?.method === metodo)[n];
const corpo = (fn: ReturnType<typeof mockApi>, metodo: string, n = 0) => JSON.parse(chamada(fn, metodo, n)[1]?.body as string);

async function abrirCadastro(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Cláudio Bezerra");
  await waitFor(() => expect(screen.getByRole("button", { name: /Novo acordo/ })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: /Novo acordo/ }));
}

async function preencher(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^Condomínio/), CONDO_ID);
  await screen.findByRole("option", { name: "Cláudio Bezerra · 1101" });
  await user.selectOptions(screen.getByLabelText(/^Devedor/), "d-1");
  await user.type(screen.getByLabelText(/Valor total/), "550000");
  await user.type(screen.getByLabelText("Percentual de honorários"), "20");
  await user.type(screen.getByLabelText(/^Parcelas/), "10");
  fireEvent.change(screen.getByLabelText(/1º vencimento/), { target: { value: "2026-10-10" } });
}

const salvar = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Salvar acordo" }));
const criacaoOk: Rota = (url, init) => (init?.method === "POST" && url.endsWith("/agreements") ? { status: 201, body: acordo } : undefined);

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

describe("Listagem de acordos", () => {
  it("US15-CA01: mostra os ativos, com valores formatados", async () => {
    const fetchMock = mockApi();
    render(<AcordosView />);
    expect(await screen.findByText("Cláudio Bezerra")).toBeInTheDocument();
    expect(screen.getByText("Ed. Century · 1101")).toBeInTheDocument();
    expect(screen.getByText("R$ 5.500,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.100,00")).toBeInTheDocument();
    const listagem = fetchMock.mock.calls.find(([url]) => /\/agreements\?/.test(url));
    expect(listagem?.[0]).toContain("status=active");
  });

  it("busca no servidor e troca o filtro de status", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<AcordosView />);
    await screen.findByText("Cláudio Bezerra");
    await user.type(screen.getByLabelText(/Buscar por devedor/), "claudio");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toMatch(/\/agreements\?.*search=claudio/));
    await user.click(screen.getByRole("button", { name: "Cancelados" }));
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("status=cancelled"));
    await user.click(screen.getByRole("button", { name: "Todos" }));
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).not.toContain("status="));
  });

  it("leva ao detalhe do acordo", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<AcordosView />);
    await user.click(await screen.findByRole("button", { name: "Ver o acordo de Cláudio Bezerra" }));
    expect(push).toHaveBeenCalledWith("/acordos/a-1");
  });

  it("mostra o estado vazio", async () => {
    mockApi({ acordos: [] });
    render(<AcordosView />);
    expect(await screen.findByText("Nenhum acordo ativo")).toBeInTheDocument();
  });

  it("mostra o erro e permite tentar de novo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<AcordosView />);
    expect(await screen.findByText("Não foi possível carregar a lista")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});

describe("Cadastro de acordo", () => {
  it("US16-CA01 e US17-CA01: mostra a prévia com a divisão e o período", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await preencher(user);

    const previa = screen.getByLabelText("Parcelamento gerado");
    expect(previa).toHaveTextContent("10 parcelas de R$ 550,00");
    expect(previa).toHaveTextContent("R$ 440,00 para o condomínio + R$ 110,00 de honorários");
    expect(previa).toHaveTextContent("De 10/10/2026 a 10/07/2027");
    expect(previa).toHaveTextContent("R$ 4.400,00");
    expect(screen.getByLabelText("Unidade")).toHaveValue("1101");
  });

  it("avisa quando a última parcela absorve os centavos", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await user.type(screen.getByLabelText(/Valor total/), "10000");
    await user.type(screen.getByLabelText("Percentual de honorários"), "10");
    await user.type(screen.getByLabelText(/^Parcelas/), "3");
    fireEvent.change(screen.getByLabelText(/1º vencimento/), { target: { value: "2026-01-31" } });
    expect(screen.getByLabelText("Parcelamento gerado")).toHaveTextContent("3 parcelas de R$ 33,33 (a última de R$ 33,34)");
  });

  it("envia exatamente os campos que o back aceita, com os honorários em percentual", async () => {
    const fetchMock = mockApi({ rota: criacaoOk });
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await preencher(user);
    await salvar(user);

    expect(await screen.findByText(/cadastrado com sucesso/)).toBeInTheDocument();
    expect(corpo(fetchMock, "POST")).toEqual({
      condominium_id: CONDO_ID,
      debtor_id: "d-1",
      total_amount: "5500.00",
      installment_count: 10,
      first_due_date: "2026-10-10",
      fee_percentage: "20.00",
      fee_amount: null,
    });
    expect(chamada(fetchMock, "PUT")).toBeUndefined();
  });

  it("com valor fixo, envia só o valor em reais", async () => {
    const fetchMock = mockApi({ rota: criacaoOk });
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await preencher(user);
    await user.click(screen.getByLabelText("Valor fixo"));
    await user.type(screen.getByLabelText("Valor dos honorários"), "50000");
    await salvar(user);

    await screen.findByText(/cadastrado com sucesso/);
    expect(corpo(fetchMock, "POST")).toMatchObject({ fee_percentage: null, fee_amount: "500.00" });
  });

  it("US15-CA02: não salva sem os campos obrigatórios", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await salvar(user);

    for (const erro of ["Selecione o condomínio.", "Selecione o devedor.", "Informe o valor total da dívida.", "Informe um percentual de 0 a 100.", "Informe de 1 a 120 parcelas.", "Informe o primeiro vencimento."]) {
      expect(await screen.findByText(erro)).toBeInTheDocument();
    }
    expect(chamada(fetchMock, "POST")).toBeUndefined();
  });

  it("não salva com honorários acima do total nem parcela abaixo de um centavo", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await user.type(screen.getByLabelText(/Valor total/), "5");
    await user.click(screen.getByLabelText("Valor fixo"));
    await user.type(screen.getByLabelText("Valor dos honorários"), "6");
    await user.type(screen.getByLabelText(/^Parcelas/), "6");
    await salvar(user);
    expect(await screen.findByText("Os honorários não podem ser maiores que o valor total.")).toBeInTheDocument();
    expect(screen.getByText("Cada parcela precisa ter pelo menos R$ 0,01.")).toBeInTheDocument();
  });

  it("trocar o condomínio limpa o devedor, que é de outro condomínio", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await preencher(user);
    await user.selectOptions(screen.getByLabelText(/^Condomínio/), "");
    expect(screen.getByLabelText(/^Devedor/)).toHaveValue("");
    expect(screen.getByLabelText(/^Devedor/)).toBeDisabled();
  });

  it("depois de cadastrar, atribui o responsável escolhido", async () => {
    const fetchMock = mockApi({ rota: criacaoOk });
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await preencher(user);
    await user.selectOptions(screen.getByLabelText(/Advogado responsável/), "l-1");
    await salvar(user);

    await screen.findByText(/cadastrado com sucesso/);
    expect(chamada(fetchMock, "PUT")[0]).toMatch(/\/agreements\/a-1\/responsible-lawyer$/);
    expect(corpo(fetchMock, "PUT")).toEqual({ lawyer_id: "l-1" });
  });

  it("se a atribuição falhar, avisa que o acordo foi cadastrado, sem pedir para salvar de novo", async () => {
    mockApi({ rota: (url, init) => criacaoOk(url, init) ?? (init?.method === "PUT" ? { status: 422, body: { detail: "Advogado inválido." } } : undefined) });
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await preencher(user);
    await user.selectOptions(screen.getByLabelText(/Advogado responsável/), "l-1");
    await salvar(user);

    expect(await screen.findByText(/O acordo foi cadastrado, mas não foi possível atribuir o responsável/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar acordo" })).not.toBeInTheDocument();
  });

  it("mostra a recusa do servidor e os erros por campo", async () => {
    let tentativa = 0;
    mockApi({
      rota: (_, init) => {
        if (init?.method !== "POST") return undefined;
        tentativa += 1;
        return tentativa === 1
          ? { status: 422, body: { detail: "O devedor informado não pertence a este condomínio." } }
          : { status: 422, body: { detail: [{ loc: ["body", "fee_amount"], msg: "Value error, Honorários recusados." }] } };
      },
    });
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await preencher(user);
    await salvar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("não pertence a este condomínio");
    await salvar(user);
    expect(await screen.findByText("Honorários recusados.")).toBeInTheDocument();
  });

  it("cadastra um devedor novo sem sair do formulário e já o seleciona", async () => {
    const novo: Devedor = { ...devedor, id: "d-2", name: "Nova Pessoa", unit: "202" };
    let criado = false;
    mockApi({
      rota: (url, init) => {
        if (init?.method === "POST" && url.endsWith("/debtors")) {
          criado = true;
          return { status: 201, body: novo };
        }
        if (url.includes("/debtors?")) return { status: 200, body: criado ? [devedor, novo] : [devedor] };
        return undefined;
      },
    });
    const user = userEvent.setup();
    render(<AcordosView />);
    await abrirCadastro(user);
    await user.selectOptions(screen.getByLabelText(/^Condomínio/), CONDO_ID);
    await user.click(await screen.findByRole("button", { name: "Cadastrar novo devedor" }));

    await user.type(screen.getByLabelText(/Nome completo/), "Nova Pessoa");
    await user.type(screen.getByLabelText(/^Unidade \*?$|^Unidade/, { selector: "#devedor-unidade" }), "202");
    await user.type(screen.getByLabelText(/Telefone/), "61912345678");
    await user.click(screen.getByRole("button", { name: "Salvar devedor" }));

    await waitFor(() => expect(screen.getByLabelText(/^Devedor/)).toHaveValue("d-2"));
    expect(screen.getByLabelText("Unidade", { selector: "#acordo-unidade" })).toHaveValue("202");
  });
});

describe("Detalhes do acordo", () => {
  it("US16-CA01: mostra a divisão de cada parcela e os totais", async () => {
    mockApi();
    render(<AcordoDetalheView id="a-1" />);
    expect(await screen.findByRole("heading", { name: "Cláudio Bezerra" })).toBeInTheDocument();
    expect(screen.getByText("R$ 5.500,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 4.400,00")).toBeInTheDocument();
    expect(screen.getByText("Honorários (20%)")).toBeInTheDocument();
    const linha = screen.getByRole("cell", { name: "1/2" }).closest("tr") as HTMLElement;
    expect(within(linha).getByText("10/10/2026")).toBeInTheDocument();
    expect(within(linha).getByText("R$ 2.750,00")).toBeInTheDocument();
    expect(within(linha).getByText("R$ 2.200,00")).toBeInTheDocument();
    expect(within(linha).getByText("R$ 550,00")).toBeInTheDocument();
    expect(screen.getByText("0 de 2 parcelas pagas (0%)")).toBeInTheDocument();
  });

  it("mostra o percentual quebrado com vírgula", async () => {
    mockApi({ dadosAcordo: { ...acordo, fee_percentage: "12.50" } });
    render(<AcordoDetalheView id="a-1" />);
    expect(await screen.findByText("Honorários (12,50%)")).toBeInTheDocument();
  });

  it("só oferece a edição de parcelas que o back aceita editar", async () => {
    const paga: Parcela = { ...p1, status: "paid", payment_date: "2026-10-05", remaining_amount: "0.00" };
    const parcial: Parcela = { ...p2, remaining_amount: "100.00" };
    const atrasada: Parcela = { ...p2, id: "i-3", number: 3, status: "overdue" };
    mockApi({ plano: [paga, parcial, atrasada] });
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByRole("heading", { name: "Cláudio Bezerra" });
    expect(screen.getByText("pago em 05/10/2026")).toBeInTheDocument();
    expect(screen.getByText("1 de 3 parcelas pagas (33%)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar parcela 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar parcela 2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar parcela 3" })).toBeInTheDocument();
  });

  it("acordo cancelado não oferece edição", async () => {
    mockApi({ dadosAcordo: { ...acordo, status: "cancelled" } });
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByRole("heading", { name: "Cláudio Bezerra" });
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar parcela 1" })).not.toBeInTheDocument();
  });

  it("mostra o erro de carregamento", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ detail: "Acordo não encontrado." }), { status: 404 }))));
    render(<AcordoDetalheView id="a-1" />);
    expect(await screen.findByText("Acordo não encontrado.")).toBeInTheDocument();
  });

  describe("US17-CA03: edição de parcela", () => {
    const editar = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole("button", { name: "Editar parcela 1" }));
    };
    const salvarParcela = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Salvar parcela" }));

    it("envia só o valor alterado e mostra o plano que o back devolve", async () => {
      const novoPlano = [{ ...p1, amount: "3000.00" }, { ...p2, amount: "2500.00" }];
      const fetchMock = mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 200, body: novoPlano } : undefined) });
      const user = userEvent.setup();
      render(<AcordoDetalheView id="a-1" />);
      await editar(user);
      const valor = screen.getByLabelText(/^Valor/);
      expect(valor).toHaveValue("2.750,00");
      await user.clear(valor);
      await user.type(valor, "300000");
      await salvarParcela(user);

      expect(await screen.findByText("Parcela atualizada com sucesso.")).toBeInTheDocument();
      expect(chamada(fetchMock, "PATCH")[0]).toMatch(/\/installments\/i-1$/);
      expect(corpo(fetchMock, "PATCH")).toEqual({ amount: "3000.00" });
      expect(screen.getByText("R$ 3.000,00")).toBeInTheDocument();
      expect(screen.getByText("R$ 2.500,00")).toBeInTheDocument();
    });

    it("envia só a data alterada", async () => {
      const fetchMock = mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 200, body: [p1, p2] } : undefined) });
      const user = userEvent.setup();
      render(<AcordoDetalheView id="a-1" />);
      await editar(user);
      fireEvent.change(screen.getByLabelText(/Vencimento/), { target: { value: "2026-10-20" } });
      await salvarParcela(user);
      await screen.findByText("Parcela atualizada com sucesso.");
      expect(corpo(fetchMock, "PATCH")).toEqual({ due_date: "2026-10-20" });
    });

    it("sem mudança, fecha sem chamar o back", async () => {
      const fetchMock = mockApi();
      const user = userEvent.setup();
      render(<AcordoDetalheView id="a-1" />);
      await editar(user);
      await salvarParcela(user);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(chamada(fetchMock, "PATCH")).toBeUndefined();
    });

    it("não envia sem valor nem data", async () => {
      const fetchMock = mockApi();
      const user = userEvent.setup();
      render(<AcordoDetalheView id="a-1" />);
      await editar(user);
      await user.clear(screen.getByLabelText(/^Valor/));
      fireEvent.change(screen.getByLabelText(/Vencimento/), { target: { value: "" } });
      await salvarParcela(user);
      expect(await screen.findByText("Informe o valor da parcela.")).toBeInTheDocument();
      expect(screen.getByText("Informe o vencimento.")).toBeInTheDocument();
      expect(chamada(fetchMock, "PATCH")).toBeUndefined();
    });

    it("mostra a recusa do back, como a última parcela sem seguinte para absorver", async () => {
      mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 422, body: { detail: "Não há parcela seguinte sem pagamento para absorver a diferença de valor." } } : undefined) });
      const user = userEvent.setup();
      render(<AcordoDetalheView id="a-1" />);
      await editar(user);
      await user.type(screen.getByLabelText(/^Valor/), "1");
      await salvarParcela(user);
      expect(await screen.findByRole("alert")).toHaveTextContent("absorver a diferença");
    });

    it("mostra no campo o erro de validação do back", async () => {
      mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 422, body: { detail: [{ loc: ["body", "amount"], msg: "Value error, Valor recusado." }] } } : undefined) });
      const user = userEvent.setup();
      render(<AcordoDetalheView id="a-1" />);
      await editar(user);
      await user.type(screen.getByLabelText(/^Valor/), "1");
      await salvarParcela(user);
      expect(await screen.findByText("Valor recusado.")).toBeInTheDocument();
    });
  });
});
