import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api";
import { clearSession, getSession, saveSession, type Session } from "./session";

const session: Session = {
  token: "abc",
  expiresAt: "2999-01-01T00:00:00Z",
  user: { id: "1", name: "Ana", email: "ana@example.com", role: "admin" },
};

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("apiFetch com sessão", () => {
  it("envia o token no cabeçalho Authorization", async () => {
    saveSession(session, true);
    respond(200, {});
    await apiFetch("/x");
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer abc");
  });

  it("não envia Authorization sem sessão", async () => {
    respond(200, {});
    await apiFetch("/x");
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("encerra a sessão quando o servidor recusa o token (401)", async () => {
    saveSession(session, true);
    respond(401, { detail: "Sua sessão expirou. Faça login novamente." });
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 401 });
    expect(getSession()).toBeNull();
  });

  it("mantém a sessão em outros erros (403)", async () => {
    saveSession(session, true);
    respond(403, { detail: "Sem permissão." });
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 403 });
    expect(getSession()).not.toBeNull();
  });
});

describe("apiFetch", () => {
  it("não mostra ao usuário as mensagens em inglês do Pydantic (422)", async () => {
    respond(422, { detail: [{ loc: ["body", "manager_email"], msg: "value is not a valid email address: bad domain" }] });
    const error = await apiFetch("/x").catch((e: unknown) => e);
    expect((error as ApiError).fieldErrors).toEqual({ manager_email: "Valor inválido." });
  });

  it("devolve o JSON em caso de sucesso", async () => {
    respond(200, [{ id: 1 }]);
    await expect(apiFetch("/condominios")).resolves.toEqual([{ id: 1 }]);
  });

  it("guarda o corpo dos erros que trazem mais que a mensagem", async () => {
    respond(409, { detail: "Parecido.", similar_debtors: [{ id: "1" }] });
    await expect(apiFetch("/x")).rejects.toMatchObject({ status: 409, body: { similar_debtors: [{ id: "1" }] } });
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
