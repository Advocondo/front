import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api";

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("devolve o JSON em caso de sucesso", async () => {
    respond(200, [{ id: 1 }]);
    await expect(apiFetch("/condominios")).resolves.toEqual([{ id: 1 }]);
  });

  it("usa a mensagem do servidor em erros simples (409)", async () => {
    respond(409, { detail: "Já existe um condomínio com este CNPJ." });
    await expect(apiFetch("/condominios")).rejects.toMatchObject({ status: 409, message: "Já existe um condomínio com este CNPJ." });
  });

  it("mapeia erros de validação (422) por campo", async () => {
    respond(422, { detail: [{ loc: ["body", "cnpj"], msg: "Value error, CNPJ inválido." }] });
    const error = await apiFetch("/condominios").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors).toEqual({ cnpj: "CNPJ inválido." });
  });

  it("traduz falha de rede em mensagem para o usuário", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("Sem conexão") });
  });

  it("não vaza detalhes técnicos quando o corpo não é JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 500 })));
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 500, message: expect.stringContaining("Tente novamente") });
  });
});
