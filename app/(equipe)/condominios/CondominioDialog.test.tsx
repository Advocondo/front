import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CondominioDialog } from "./CondominioDialog";
import type { Condominio, CondominioApi } from "./types";

const ID = "3f1c2b7e-8a44-4d3e-9c11-2f6a7b8c9d01";

// Mesmos campos de CondominiumResponse no back.
const respostaApi: CondominioApi = {
  id: ID, name: "Mirante", cnpj: "14447918000198", zip_code: null, street: null, neighborhood: null, city: "Brasília", state: "DF",
  manager_name: "Rita", manager_email: null, manager_phone: null, contract_start_date: null, contract_renewal_date: null, near_renewal: false,
};

const salvo: Condominio = {
  id: ID, nome: "Mirante", cnpj: "14447918000198", cep: null, logradouro: null, bairro: null, cidade: "Brasília", uf: "DF",
  sindico_nome: "Rita", sindico_email: null, sindico_telefone: null, contrato_inicio: null, contrato_renovacao: null,
};

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("CondominioDialog", () => {
  it("cadastra: envia o payload normalizado e avisa o sucesso", async () => {
    const fetchMock = mockFetch(201, respostaApi);
    const onSaved = vi.fn();
    render(<CondominioDialog onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Mirante");
    await userEvent.type(screen.getByLabelText("CNPJ"), "14447918000198");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("14.447.918/0001-98");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(salvo, "criado"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/condominiums$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ name: "Mirante", cnpj: "14447918000198", zip_code: null });
  });

  it("envia exatamente os campos que o back aceita (ele recusa os desconhecidos)", async () => {
    const fetchMock = mockFetch(201, respostaApi);
    render(<CondominioDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Mirante");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(Object.keys(JSON.parse(fetchMock.mock.calls[0][1].body)).sort()).toEqual([
      "city", "cnpj", "contract_renewal_date", "contract_start_date", "manager_email", "manager_name",
      "manager_phone", "name", "neighborhood", "state", "street", "zip_code",
    ]);
  });

  it("mostra no campo certo o erro de validação (422) do servidor", async () => {
    mockFetch(422, { detail: [{ loc: ["body", "zip_code"], msg: "Value error, CEP recusado pelo servidor." }] });
    const onSaved = vi.fn();
    render(<CondominioDialog onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Mirante");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    expect(await screen.findByText("CEP recusado pelo servidor.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("aceita CNPJ alfanumérico", async () => {
    const fetchMock = mockFetch(201, respostaApi);
    render(<CondominioDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Mirante");
    await userEvent.type(screen.getByLabelText("CNPJ"), "12abc34501de35");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("12.ABC.345/01DE-35");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).cnpj).toBe("12ABC34501DE35");
  });

  it("não envia sem o nome e mostra o erro no campo", async () => {
    const fetchMock = mockFetch(201, respostaApi);
    render(<CondominioDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    expect(await screen.findByText("Informe o nome do condomínio.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("US12-CA02: edita um condomínio existente com PATCH e os dados preenchidos", async () => {
    const fetchMock = mockFetch(200, { ...respostaApi, manager_name: "Nova Administradora" });
    const onSaved = vi.fn();
    render(<CondominioDialog condominio={salvo} onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.getByText("Editar condomínio")).toBeInTheDocument();
    expect(screen.getByLabelText("CNPJ")).toHaveValue("14.447.918/0001-98");
    const sindico = screen.getByLabelText("Nome", { selector: "#sindico_nome" });
    await userEvent.clear(sindico);
    await userEvent.type(sindico, "Nova Administradora");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.anything(), "atualizado"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(new RegExp(`/condominiums/${ID}$`));
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body).manager_name).toBe("Nova Administradora");
  });

  it("mostra no CNPJ o conflito 409 do servidor", async () => {
    mockFetch(409, { detail: "Já existe um condomínio com este CNPJ." });
    const onSaved = vi.fn();
    render(<CondominioDialog onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Mirante");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    expect(await screen.findByText("Já existe um condomínio com este CNPJ.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("mostra um alerta quando o servidor está fora do ar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<CondominioDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Mirante");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    expect(await screen.findByText(/Sem conexão com o servidor/)).toBeInTheDocument();
  });
});
