import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CondominioApi } from "@/app/(equipe)/condominios/types";
import { DevedoresView } from "./DevedoresView";
import type { Devedor } from "./types";
import { validate } from "./validation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const VILLA_ID = "3f1c2b7e-8a44-4d3e-9c11-2f6a7b8c9d01";
const PARQUE_ID = "9a7d5e21-1b6c-4f08-8e37-5c4b3a291f02";

// Mesmos campos de CondominiumResponse e DebtorResponse no back.
const condominioBase = {
  cnpj: null, zip_code: null, street: null, neighborhood: null, city: null, state: null, manager_name: null, manager_email: null,
  manager_phone: null, contract_start_date: null, contract_renewal_date: null, near_renewal: false,
};
const villa: CondominioApi = { ...condominioBase, id: VILLA_ID, name: "Res. Villa Verde" };
const parque: CondominioApi = { ...condominioBase, id: PARQUE_ID, name: "Cond. Parque" };
const marcelo: Devedor = { id: "d-1", condominium_id: VILLA_ID, name: "Marcelo Lima", unit: "Bloco B 302", phone: "61912345678", email: null };

type Rota = (url: string, init?: RequestInit) => { status: number; body: unknown } | undefined;

/** Simula a API. O POST e o PATCH vêm da `rota`; as listagens têm um padrão. */
function mockApi({ devedores = [marcelo], condominios = [villa, parque], rota }: { devedores?: Devedor[]; condominios?: CondominioApi[]; rota?: Rota } = {}) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const resposta = rota?.(url, init) ?? (url.includes("/condominiums") ? { status: 200, body: condominios } : { status: 200, body: devedores });
    return Promise.resolve(new Response(JSON.stringify(resposta.body), { status: resposta.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const corpoDoPost = (fn: ReturnType<typeof mockApi>, n = 0) =>
  JSON.parse(fn.mock.calls.filter(([, init]) => init?.method === "POST")[n][1]?.body as string);

async function abrirNovo(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Marcelo Lima");
  await waitFor(() => expect(screen.getAllByRole("button", { name: /Novo devedor/ })[0]).toBeEnabled());
  await user.click(screen.getAllByRole("button", { name: /Novo devedor/ })[0]);
}

async function preencher(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Nome completo/), "Marcelo T. Lima");
  await user.selectOptions(screen.getByLabelText(/^Condomínio/), VILLA_ID);
  await user.type(screen.getByLabelText(/Unidade/), "Bloco B 302");
  await user.type(screen.getByLabelText(/Telefone/), "61912345678");
}

const salvar = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Salvar devedor" }));

afterEach(() => vi.unstubAllGlobals());

describe("validate", () => {
  const valido = { condominium_id: VILLA_ID, name: "Ana", unit: "101", phone: "61912345678", email: "" };

  it("aceita telefone ou e-mail como contato", () => {
    expect(validate(valido)).toEqual({});
    expect(validate({ ...valido, phone: "", email: "ana@example.com" })).toEqual({});
  });

  it("exige ao menos um contato", () => {
    expect(validate({ ...valido, phone: "", email: "" }).phone).toBe("Informe o telefone ou o e-mail do devedor.");
  });

  it("aponta cada campo inválido", () => {
    const erros = validate({ condominium_id: "", name: " ", unit: " ", phone: "123", email: "a@" });
    expect(Object.keys(erros).sort()).toEqual(["condominium_id", "email", "name", "phone", "unit"]);
  });
});

describe("Listagem de devedores", () => {
  it("lista com o nome do condomínio e o telefone formatado", async () => {
    mockApi();
    render(<DevedoresView />);
    expect(await screen.findByText("Marcelo Lima")).toBeInTheDocument();
    expect(screen.getByText("Bloco B 302")).toBeInTheDocument();
    expect(screen.getByText("(61) 91234-5678")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "Res. Villa Verde" })).toBeInTheDocument();
  });

  it("busca e filtra por condomínio no servidor", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<DevedoresView />);
    await screen.findByText("Marcelo Lima");
    await user.type(screen.getByLabelText("Buscar por nome ou unidade"), "lima");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toMatch(/\/debtors\?.*search=lima/));
    await user.selectOptions(screen.getByLabelText("Filtrar por condomínio"), PARQUE_ID);
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain(`condominium_id=${PARQUE_ID}`));
  });

  it("mostra o estado vazio com o próximo passo", async () => {
    mockApi({ devedores: [] });
    render(<DevedoresView />);
    expect(await screen.findByText("Nenhum devedor cadastrado")).toBeInTheDocument();
  });

  it("sem condomínio cadastrado, orienta e não deixa abrir o cadastro", async () => {
    mockApi({ devedores: [], condominios: [] });
    render(<DevedoresView />);
    expect(await screen.findByText("Cadastre um condomínio primeiro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para Condomínios" })).toHaveAttribute("href", "/condominios");
    screen.getAllByRole("button", { name: /Novo devedor/ }).slice(0, 1).forEach((botao) => expect(botao).toBeDisabled());
  });

  it("mostra o erro e permite tentar de novo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<DevedoresView />);
    expect(await screen.findByText("Não foi possível carregar a lista")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});

describe("Cadastro de devedor", () => {
  it("envia exatamente os campos que o back aceita e confirma com um aviso", async () => {
    const fetchMock = mockApi({ rota: (_, init) => (init?.method === "POST" ? { status: 201, body: { ...marcelo, id: "d-2" } } : undefined) });
    const user = userEvent.setup();
    render(<DevedoresView />);
    await abrirNovo(user);
    await preencher(user);
    await salvar(user);

    expect(await screen.findByText(/cadastrado com sucesso/)).toBeInTheDocument();
    expect(corpoDoPost(fetchMock)).toEqual({
      condominium_id: VILLA_ID,
      name: "Marcelo T. Lima",
      unit: "Bloco B 302",
      phone: "61912345678",
      email: null,
      confirm_duplicate: false,
    });
  });

  it("não envia sem contato", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<DevedoresView />);
    await abrirNovo(user);
    await user.type(screen.getByLabelText(/Nome completo/), "Ana");
    await user.selectOptions(screen.getByLabelText(/^Condomínio/), VILLA_ID);
    await user.type(screen.getByLabelText(/Unidade/), "101");
    await salvar(user);
    expect(await screen.findByText("Informe o telefone ou o e-mail do devedor.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("com a lista filtrada, já traz o condomínio escolhido", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<DevedoresView />);
    await screen.findByText("Marcelo Lima");
    await waitFor(() => expect(screen.getByRole("option", { name: "Cond. Parque" })).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("Filtrar por condomínio"), PARQUE_ID);
    await abrirNovo(user);
    expect(screen.getByLabelText(/^Condomínio/)).toHaveValue(PARQUE_ID);
  });

  it("mostra no campo os erros de validação do servidor", async () => {
    mockApi({ rota: (_, init) => (init?.method === "POST" ? { status: 422, body: { detail: [{ loc: ["body", "unit"], msg: "Value error, Unidade recusada." }] } } : undefined) });
    const user = userEvent.setup();
    render(<DevedoresView />);
    await abrirNovo(user);
    await preencher(user);
    await salvar(user);
    expect(await screen.findByText("Unidade recusada.")).toBeInTheDocument();
  });

  it("mostra um alerta com a recusa do servidor", async () => {
    mockApi({ rota: (_, init) => (init?.method === "POST" ? { status: 422, body: { detail: "Condomínio não encontrado." } } : undefined) });
    const user = userEvent.setup();
    render(<DevedoresView />);
    await abrirNovo(user);
    await preencher(user);
    await salvar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Condomínio não encontrado.");
  });
});

describe("US13-CA01: alerta de duplicidade", () => {
  const alertaParecido = {
    status: 409,
    body: { detail: "Já existe devedor com dados parecidos neste condomínio.", similar_debtors: [marcelo] },
  };

  /** O primeiro POST recebe o alerta; o seguinte, se houver, cadastra. */
  function apiComParecido() {
    let tentativas = 0;
    return mockApi({
      rota: (_, init) => {
        if (init?.method !== "POST") return undefined;
        tentativas += 1;
        return tentativas === 1 ? alertaParecido : { status: 201, body: { ...marcelo, id: "d-2", name: "Marcelo T. Lima" } };
      },
    });
  }

  async function chegarAoAlerta(user: ReturnType<typeof userEvent.setup>) {
    render(<DevedoresView />);
    await abrirNovo(user);
    await preencher(user);
    await salvar(user);
    return screen.findByRole("alert");
  }

  it("mostra os parecidos e não cadastra", async () => {
    apiComParecido();
    const alerta = await chegarAoAlerta(userEvent.setup());
    expect(alerta).toHaveTextContent("Já existe um devedor parecido");
    expect(within(alerta).getByText("Marcelo Lima · Res. Villa Verde · Bloco B 302")).toBeInTheDocument();
    expect(screen.getByText("Novo devedor", { selector: "h2, [role=dialog] *" })).toBeInTheDocument();
  });

  it("depois de conferir, cadastra mesmo assim com a confirmação", async () => {
    const fetchMock = apiComParecido();
    const user = userEvent.setup();
    await chegarAoAlerta(user);
    await user.click(screen.getByRole("button", { name: "Salvar mesmo assim" }));
    expect(await screen.findByText(/Marcelo T. Lima cadastrado com sucesso/)).toBeInTheDocument();
    expect(corpoDoPost(fetchMock, 1).confirm_duplicate).toBe(true);
  });

  it("mudar o nome, a unidade ou o condomínio exige conferir de novo", async () => {
    const fetchMock = apiComParecido();
    const user = userEvent.setup();
    await chegarAoAlerta(user);
    await user.type(screen.getByLabelText(/Unidade/), "A");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await salvar(user);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(2));
    expect(corpoDoPost(fetchMock, 1).confirm_duplicate).toBe(false);
  });

  it("mudar só o contato mantém o alerta", async () => {
    apiComParecido();
    const user = userEvent.setup();
    await chegarAoAlerta(user);
    await user.type(screen.getByLabelText(/^E-mail/), "a");
    expect(screen.getByRole("button", { name: "Salvar mesmo assim" })).toBeInTheDocument();
  });

  it("usar o cadastro existente fecha o diálogo e mostra o devedor na lista", async () => {
    const fetchMock = apiComParecido();
    const user = userEvent.setup();
    await chegarAoAlerta(user);
    await user.click(screen.getByRole("button", { name: "Usar o cadastro de Marcelo Lima" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Buscar por nome ou unidade")).toHaveValue("Marcelo Lima");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toMatch(/search=Marcelo/));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });
});

describe("Edição de devedor", () => {
  it("abre preenchida, não deixa trocar o condomínio e envia só o que pode mudar", async () => {
    const fetchMock = mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 200, body: { ...marcelo, unit: "Bloco C 101" } } : undefined) });
    const user = userEvent.setup();
    render(<DevedoresView />);
    await user.click(await screen.findByRole("button", { name: "Editar Marcelo Lima" }));

    expect(screen.getByLabelText(/Nome completo/)).toHaveValue("Marcelo Lima");
    expect(screen.getByLabelText(/Telefone/)).toHaveValue("(61) 91234-5678");
    expect(screen.getByLabelText(/^Condomínio/)).toBeDisabled();

    const unidade = screen.getByLabelText(/Unidade/);
    await user.clear(unidade);
    await user.type(unidade, "Bloco C 101");
    await salvar(user);

    expect(await screen.findByText(/atualizado com sucesso/)).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patch?.[0]).toMatch(/\/debtors\/d-1$/);
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ name: "Marcelo Lima", unit: "Bloco C 101", phone: "61912345678", email: null });
  });
});
