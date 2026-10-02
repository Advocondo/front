import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CondominioDialog } from "./CondominioDialog";
import type { Condominio } from "./types";

const salvo: Condominio = {
  id: 7, nome: "Mirante", cnpj: "14447918000198", cep: null, logradouro: null, bairro: null, cidade: "Brasília", uf: "DF",
  sindico_nome: "Rita", sindico_email: null, sindico_telefone: null, contrato_inicio: null, contrato_renovacao: null,
  created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
};

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("CondominioDialog", () => {
  it("cadastra: envia o payload normalizado e avisa o sucesso", async () => {
    const fetchMock = mockFetch(201, salvo);
    const onSaved = vi.fn();
    render(<CondominioDialog onClose={vi.fn()} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText(/Nome do condomínio/), "Mirante");
    await userEvent.type(screen.getByLabelText("CNPJ"), "14447918000198");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("14.447.918/0001-98");
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(salvo, "criado"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/condominios$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ nome: "Mirante", cnpj: "14447918000198", cep: null });
  });

  it("não envia sem o nome e mostra o erro no campo", async () => {
    const fetchMock = mockFetch(201, salvo);
    render(<CondominioDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Salvar condomínio" }));
    expect(await screen.findByText("Informe o nome do condomínio.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("US12-CA02: edita um condomínio existente com PATCH e os dados preenchidos", async () => {
    const fetchMock = mockFetch(200, { ...salvo, sindico_nome: "Nova Administradora" });
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
    expect(url).toMatch(/\/condominios\/7$/);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body).sindico_nome).toBe("Nova Administradora");
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
