import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { simularCelular } from "@/app/lib/celular.test-utils";
import { CondominiosView } from "./CondominiosView";
import type { CondominioApi } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Mesmos campos de CondominiumResponse no back.
const base = {
  cnpj: null, zip_code: null, street: null, neighborhood: null, manager_email: null, manager_phone: null, contract_start_date: null, near_renewal: false,
};
const villa: CondominioApi = { ...base, id: "3f1c2b7e-8a44-4d3e-9c11-2f6a7b8c9d01", name: "Res. Villa Verde", city: "Águas Claras", state: "DF", manager_name: "Marcos Tavares", contract_renewal_date: "2027-01-01" };
const parque: CondominioApi = { ...base, id: "9a7d5e21-1b6c-4f08-8e37-5c4b3a291f02", name: "Cond. Parque das Águas", city: null, state: null, manager_name: null, contract_renewal_date: null };

function mockList(rows: CondominioApi[]) {
  const fn = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(rows), { status: 200 })));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.useRealTimers());
afterEach(() => vi.unstubAllGlobals());

describe("Listagem de condomínios", () => {
  it("lista os condomínios com localidade, síndico e renovação formatados", async () => {
    mockList([villa, parque]);
    render(<CondominiosView />);
    expect(await screen.findByText("Res. Villa Verde")).toBeInTheDocument();
    expect(screen.getByText("Águas Claras/DF")).toBeInTheDocument();
    expect(screen.getByText("Marcos Tavares")).toBeInTheDocument();
    expect(screen.getByText("01/01/2027")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("mostra o estado vazio com o próximo passo quando não há condomínios", async () => {
    mockList([]);
    render(<CondominiosView />);
    expect(await screen.findByText("Nenhum condomínio cadastrado")).toBeInTheDocument();
  });

  it("busca no servidor pelo texto digitado", async () => {
    const fetchMock = mockList([villa]);
    render(<CondominiosView />);
    await screen.findByText("Res. Villa Verde");
    await userEvent.type(screen.getByLabelText("Buscar condomínio ou síndico"), "villa");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toMatch(/\/condominiums\?.*search=villa/));
  });

  it("US12-CA02: cada linha tem a ação Editar, que abre o diálogo preenchido", async () => {
    mockList([villa]);
    render(<CondominiosView />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar Res. Villa Verde" }));
    expect(screen.getByText("Editar condomínio")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do condomínio/)).toHaveValue("Res. Villa Verde");
  });

  it("mostra o erro e permite tentar de novo quando a API falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<CondominiosView />);
    expect(await screen.findByText("Não foi possível carregar a lista")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("após cadastrar, recarrega a lista e confirma com um aviso", async () => {
    let cadastrou = false;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/notifications")) return Promise.resolve(new Response(JSON.stringify({ unread_count: 0, notifications: [] }), { status: 200 }));
      if (init?.method === "POST") {
        cadastrou = true;
        return Promise.resolve(new Response(JSON.stringify(villa), { status: 201 }));
      }
      return Promise.resolve(new Response(JSON.stringify(cadastrou ? [villa] : []), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<CondominiosView />);
    await userEvent.click((await screen.findAllByRole("button", { name: /Novo condomínio/ }))[0]);
    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Res. Villa Verde");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    expect(await screen.findByText(/cadastrado|criado com sucesso/)).toBeInTheDocument();
    expect(await screen.findByText("Águas Claras/DF")).toBeInTheDocument();
  });
});

describe("#83: condomínios no celular", () => {
  it("mostra um cartão por condomínio, com localidade, síndico, renovação e Editar", async () => {
    simularCelular();
    mockList([villa, parque]);
    const user = userEvent.setup();
    render(<CondominiosView />);
    const lista = await screen.findByRole("list", { name: "Condomínios" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    const cartao = within(lista).getByText("Res. Villa Verde").closest("li") as HTMLElement;
    expect(cartao).toHaveTextContent("Águas Claras/DF · Marcos Tavares");
    expect(cartao).toHaveTextContent("Renovação 01/01/2027");
    expect(within(lista).getByText("Cond. Parque das Águas").closest("li")).toHaveTextContent(/^Cond\. Parque das ÁguasSem data de renovação/);

    await user.click(within(cartao).getByRole("button", { name: "Editar Res. Villa Verde" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("perto da renovação, o cartão avisa e oferece registrar", async () => {
    simularCelular();
    mockList([{ ...villa, near_renewal: true, contract_renewal_date: "2999-01-01" }]);
    render(<CondominiosView />);
    const cartao = (await screen.findByText("Res. Villa Verde")).closest("li") as HTMLElement;
    expect(within(cartao).getByText(/^Renova em/)).toBeInTheDocument();
    expect(within(cartao).getByRole("button", { name: "Registrar renovação de Res. Villa Verde" })).toBeInTheDocument();
  });
});
