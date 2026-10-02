import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CondominiosPage from "./page";
import type { Condominio } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const base = {
  cnpj: null, cep: null, logradouro: null, bairro: null, sindico_email: null, sindico_telefone: null, contrato_inicio: null,
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
};
const villa: Condominio = { ...base, id: 1, nome: "Res. Villa Verde", cidade: "Águas Claras", uf: "DF", sindico_nome: "Marcos Tavares", contrato_renovacao: "2027-01-01" };
const parque: Condominio = { ...base, id: 2, nome: "Cond. Parque das Águas", cidade: null, uf: null, sindico_nome: null, contrato_renovacao: null };

function mockList(rows: Condominio[]) {
  const fn = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(rows), { status: 200 })));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.unstubAllGlobals());

describe("Listagem de condomínios", () => {
  it("lista os condomínios com localidade, síndico e renovação formatados", async () => {
    mockList([villa, parque]);
    render(<CondominiosPage />);
    expect(await screen.findByText("Res. Villa Verde")).toBeInTheDocument();
    expect(screen.getByText("Águas Claras/DF")).toBeInTheDocument();
    expect(screen.getByText("Marcos Tavares")).toBeInTheDocument();
    expect(screen.getByText("01/01/2027")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("mostra o estado vazio com o próximo passo quando não há condomínios", async () => {
    mockList([]);
    render(<CondominiosPage />);
    expect(await screen.findByText("Nenhum condomínio cadastrado")).toBeInTheDocument();
  });

  it("busca no servidor pelo texto digitado", async () => {
    const fetchMock = mockList([villa]);
    render(<CondominiosPage />);
    await screen.findByText("Res. Villa Verde");
    await userEvent.type(screen.getByLabelText("Buscar condomínio ou síndico"), "villa");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("q=villa"));
  });

  it("US12-CA02: cada linha tem a ação Editar, que abre o diálogo preenchido", async () => {
    mockList([villa]);
    render(<CondominiosPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar Res. Villa Verde" }));
    expect(screen.getByText("Editar condomínio")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do condomínio/)).toHaveValue("Res. Villa Verde");
  });

  it("mostra o erro e permite tentar de novo quando a API falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<CondominiosPage />);
    expect(await screen.findByText("Não foi possível carregar a lista")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("após cadastrar, recarrega a lista e confirma com um aviso", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("[]", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(villa), { status: 201 }))
      .mockResolvedValue(new Response(JSON.stringify([villa]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<CondominiosPage />);
    await userEvent.click((await screen.findAllByRole("button", { name: /Novo condomínio/ }))[0]);
    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Res. Villa Verde");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    expect(await screen.findByText(/cadastrado|criado com sucesso/)).toBeInTheDocument();
    expect(await screen.findByText("Águas Claras/DF")).toBeInTheDocument();
  });
});
