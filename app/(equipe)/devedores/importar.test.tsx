import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession } from "@/app/lib/session";
import type { LinhaDaPlanilha } from "./api";
import { DevedoresView } from "./DevedoresView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const CONDO = { id: "c-1", name: "Res. Villa Verde", cnpj: null, zip_code: null, street: null, neighborhood: null, city: null, state: null, manager_name: null, manager_email: null, manager_phone: null, contract_start_date: null, contract_renewal_date: null, near_renewal: false };
const OUTRO = { ...CONDO, id: "c-2", name: "Ed. Parque" };

const base = { errors: [], similar_debtors: [], repeats_row: null };
const valida: LinhaDaPlanilha = { ...base, number: 2, status: "valid", values: { name: "José Simão", unit: "101", phone: "61912345678", email: null } };
const valida2: LinhaDaPlanilha = { ...valida, number: 3, values: { ...valida.values, name: "Ana Lima", unit: "102" } };
const erro: LinhaDaPlanilha = { ...base, number: 4, status: "invalid", values: { name: "Maria Souza", unit: "103", phone: null, email: null }, errors: ["Informe o telefone ou o e-mail do devedor."] };
const parecido: LinhaDaPlanilha = { ...base, number: 5, status: "similar", values: { name: "Jose Simao", unit: "101", phone: null, email: null }, similar_debtors: [{ id: "d-1", condominium_id: "c-1", name: "José Simão", unit: "101", phone: null, email: null }] };
const repetida: LinhaDaPlanilha = { ...base, number: 6, status: "similar", values: { name: "Ana Lima", unit: "102", phone: null, email: null }, repeats_row: 3 };
const semNome: LinhaDaPlanilha = { ...base, number: 7, status: "invalid", values: { name: null, unit: null, phone: null, email: null }, errors: ["Informe o nome."] };

type Resposta = { status: number; body?: unknown; bruto?: string };

function mockApi(importacao: (confirmar: boolean, corpo: FormData) => Resposta) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    let r: Resposta;
    if (url.includes("/debtors/import/template")) r = { status: 200, bruto: "xlsx" };
    else if (url.includes("/debtors/import")) r = importacao((init?.body as FormData).get("confirm") === "true", init?.body as FormData);
    else if (url.includes("/notifications")) r = { status: 200, body: { unread_count: 0, notifications: [] } };
    else if (url.includes("/condominiums")) r = { status: 200, body: [CONDO, OUTRO] };
    else r = { status: 200, body: [] };
    return Promise.resolve(new Response(r.bruto ?? JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const previa = (rows: LinhaDaPlanilha[]): Resposta => ({ status: 200, body: { confirmed: false, imported: 0, rows } });
const envios = (fn: ReturnType<typeof mockApi>) => fn.mock.calls.filter(([url]) => url.endsWith("/debtors/import"));
const planilha = () => new File(["xlsx"], "inadimplentes.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

async function abrir(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("button", { name: "Importar planilha" })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "Importar planilha" }));
}

async function escolher(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^Condomínio/), "c-1");
  await user.upload(screen.getByLabelText("Arquivo da planilha"), planilha());
}

beforeEach(() => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana", email: "a@example.com", role: "operator" } }, true));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearSession();
});

describe("US14-CA01: validação antes de confirmar", () => {
  it("escolher o arquivo só valida, sem gravar, e aponta as linhas com problema", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => previa([valida, valida2, erro, parecido, repetida, semNome]));
    render(<DevedoresView />);
    await abrir(user);
    await escolher(user);

    expect(await screen.findByRole("button", { name: "Importar 2 registros válidos" })).toBeEnabled();
    expect(envios(fetchMock)).toHaveLength(1);
    const corpo = envios(fetchMock)[0][1]?.body as FormData;
    expect(corpo.get("confirm")).toBe("false");
    expect(corpo.get("condominium_id")).toBe("c-1");
    expect(corpo.get("file")).toBeInstanceOf(File);

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("Linha 4 · Maria Souza · 103")).toBeInTheDocument();
    expect(within(dialogo).getByText("Informe o telefone ou o e-mail do devedor.")).toBeInTheDocument();
    expect(within(dialogo).getByText("Parecido com quem já está cadastrado: José Simão (101).")).toBeInTheDocument();
    expect(within(dialogo).getByText("Repete a linha 3 da planilha.")).toBeInTheDocument();
    expect(within(dialogo).getByText("Linha 7")).toBeInTheDocument();
    expect(within(dialogo).getByText("Linhas válidas").parentElement?.parentElement).toHaveTextContent("2");
    expect(within(dialogo).getByText("Ficam de fora").parentElement?.parentElement).toHaveTextContent("4");
  });

  it("não valida sem condomínio, e valida ao escolher", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => previa([valida]));
    render(<DevedoresView />);
    await abrir(user);
    await user.upload(screen.getByLabelText("Arquivo da planilha"), planilha());
    expect(screen.getByText("Selecione o condomínio para validar a planilha.")).toBeInTheDocument();
    expect(envios(fetchMock)).toHaveLength(0);
    await user.selectOptions(screen.getByLabelText(/^Condomínio/), "c-1");
    expect(await screen.findByRole("button", { name: "Importar 1 registro válido" })).toBeInTheDocument();
  });

  it("trocar o condomínio valida de novo, porque os parecidos dependem dele", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(() => previa([valida]));
    render(<DevedoresView />);
    await abrir(user);
    await escolher(user);
    await screen.findByRole("button", { name: "Importar 1 registro válido" });
    await user.selectOptions(screen.getByLabelText(/^Condomínio/), "c-2");
    await waitFor(() => expect(envios(fetchMock)).toHaveLength(2));
    expect((envios(fetchMock)[1][1]?.body as FormData).get("condominium_id")).toBe("c-2");
  });

  it("uma planilha recusada mostra o motivo, sem nada para importar", async () => {
    const user = userEvent.setup();
    mockApi(() => ({ status: 422, body: { detail: "Faltam colunas na planilha: Unidade. Use o modelo de planilha." } }));
    render(<DevedoresView />);
    await abrir(user);
    await escolher(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Faltam colunas na planilha: Unidade.");
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("sem linhas válidas, não há o que importar", async () => {
    const user = userEvent.setup();
    mockApi(() => previa([erro]));
    render(<DevedoresView />);
    await abrir(user);
    await escolher(user);
    await screen.findByText("Linha 4 · Maria Souza · 103");
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });
});

describe("US14-CA02: importação", () => {
  it("confirma reenviando o arquivo, avisa quantos entraram e recarrega a lista", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi((confirmar) => (confirmar ? { status: 200, body: { confirmed: true, imported: 2, rows: [valida, valida2, erro] } } : previa([valida, valida2, erro])));
    render(<DevedoresView />);
    await abrir(user);
    await escolher(user);
    const listas = () => fetchMock.mock.calls.filter(([url]) => url.includes("/debtors?")).length;
    await screen.findByRole("button", { name: "Importar 2 registros válidos" });
    const antes = listas();
    await user.click(screen.getByRole("button", { name: "Importar 2 registros válidos" }));

    expect(await screen.findByText("2 devedores importados. 1 linha ficou de fora.")).toBeInTheDocument();
    expect((envios(fetchMock)[1][1]?.body as FormData).get("confirm")).toBe("true");
    expect((envios(fetchMock)[1][1]?.body as FormData).get("file")).toBeInstanceOf(File);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(listas()).toBeGreaterThan(antes));
  });

  it("usa o singular, e não fala de linhas de fora quando não há", async () => {
    const user = userEvent.setup();
    mockApi((confirmar) => (confirmar ? { status: 200, body: { confirmed: true, imported: 1, rows: [valida] } } : previa([valida])));
    render(<DevedoresView />);
    await abrir(user);
    await escolher(user);
    await user.click(await screen.findByRole("button", { name: "Importar 1 registro válido" }));
    expect(await screen.findByText("1 devedor importado.")).toBeInTheDocument();
  });

  it("se a confirmação não gravou nada, mantém o diálogo e mostra o porquê", async () => {
    const user = userEvent.setup();
    mockApi((confirmar) => (confirmar ? { status: 200, body: { confirmed: true, imported: 0, rows: [parecido] } } : previa([valida])));
    render(<DevedoresView />);
    await abrir(user);
    await escolher(user);
    await user.click(await screen.findByRole("button", { name: "Importar 1 registro válido" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhuma linha foi importada.");
    expect(screen.getByText(/Parecido com quem já está cadastrado/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("mostra a falha ao importar, e dá para tentar de novo", async () => {
    const user = userEvent.setup();
    let falhar = true;
    mockApi((confirmar) => (confirmar && falhar ? { status: 500, body: { detail: "Erro" } } : confirmar ? { status: 200, body: { confirmed: true, imported: 1, rows: [valida] } } : previa([valida])));
    render(<DevedoresView />);
    await abrir(user);
    await escolher(user);
    await user.click(await screen.findByRole("button", { name: "Importar 1 registro válido" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    falhar = false;
    fireEvent.click(screen.getByRole("button", { name: "Importar 1 registro válido" }));
    expect(await screen.findByText("1 devedor importado.")).toBeInTheDocument();
  });
});

describe("Modelo e acesso", () => {
  it("baixa o modelo de planilha", async () => {
    const user = userEvent.setup();
    const nomes: string[] = [];
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      nomes.push(this.download);
    });
    mockApi(() => previa([]));
    render(<DevedoresView />);
    await abrir(user);
    await user.click(screen.getByRole("button", { name: "Baixar modelo de planilha" }));
    await waitFor(() => expect(nomes).toEqual(["modelo-inadimplentes.xlsx"]));
  });

  it("começa com o condomínio do filtro da tela", async () => {
    const user = userEvent.setup();
    mockApi(() => previa([]));
    render(<DevedoresView />);
    await screen.findByRole("option", { name: "Ed. Parque" });
    await user.selectOptions(screen.getByLabelText("Filtrar por condomínio"), "c-2");
    await abrir(user);
    expect(screen.getByLabelText(/^Condomínio/)).toHaveValue("c-2");
  });
});
