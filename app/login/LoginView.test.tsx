import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, getSession, saveSession, type Role } from "@/app/lib/session";
import { LoginView } from "./LoginView";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function resposta(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function loginOk(role: Role) {
  return resposta(200, {
    access_token: "abc",
    token_type: "bearer",
    expires_at: "2999-01-01T00:00:00Z",
    user: { id: "1", name: "Ana", email: "ana@example.com", role },
  });
}

async function preencherEEnviar() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/E-mail/), "ana@example.com");
  await user.type(screen.getByPlaceholderText("Sua senha"), "segredo123");
  await user.click(screen.getByRole("button", { name: "Entrar na plataforma" }));
  return user;
}

beforeEach(() => replace.mockClear());
afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("Login", () => {
  it.each<[Role, string]>([
    ["admin", "/painel"],
    ["operator", "/condominios"],
    ["client", "/painel-cliente"],
  ])("US02-CA01: leva o perfil %s para %s", async (role, destino) => {
    loginOk(role);
    render(<LoginView />);
    await preencherEEnviar();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(destino));
  });

  it("envia e-mail, senha e Manter conectado para a API", async () => {
    const fetch = loginOk("admin");
    render(<LoginView />);
    await preencherEEnviar();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(init.body)).toEqual({ email: "ana@example.com", password: "segredo123", remember_me: true });
    await waitFor(() => expect(localStorage.length).toBe(1));
  });

  it("sem Manter conectado, a sessão fica só nesta aba", async () => {
    const fetch = loginOk("admin");
    render(<LoginView />);
    await userEvent.setup().click(screen.getByLabelText("Manter conectado"));
    await preencherEEnviar();
    await waitFor(() => expect(sessionStorage.length).toBe(1));
    expect(JSON.parse(fetch.mock.calls[0][1].body).remember_me).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it("US02-CA02: credenciais recusadas mostram o erro genérico e marcam os dois campos", async () => {
    resposta(401, { detail: "E-mail ou senha inválidos." });
    render(<LoginView />);
    await preencherEEnviar();
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    expect(getSession()).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Entrar na plataforma" })).toBeEnabled();
  });

  it("falha de rede mostra a mensagem de conexão", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<LoginView />);
    await preencherEEnviar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão");
  });

  it("quem já tem sessão vai direto para o painel", async () => {
    saveSession({ token: "abc", expiresAt: "2999-01-01T00:00:00Z", user: { id: "1", name: "Ana", email: "a@b.c", role: "client" } }, true);
    render(<LoginView />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/painel-cliente"));
    expect(screen.queryByRole("button", { name: "Entrar na plataforma" })).not.toBeInTheDocument();
  });

  it("mostrar a senha alterna o campo sem enviar o formulário", async () => {
    const fetch = loginOk("admin");
    render(<LoginView />);
    const campo = screen.getByPlaceholderText("Sua senha");
    expect(campo).toHaveAttribute("type", "password");
    await userEvent.setup().click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(campo).toHaveAttribute("type", "text");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("o link Voltar ao site leva à landing", () => {
    render(<LoginView />);
    expect(screen.getByRole("link", { name: "Voltar ao site" })).toHaveAttribute("href", "/");
  });

  it("o link Esqueci minha senha aponta para a recuperação", () => {
    render(<LoginView />);
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/recuperar-senha");
  });
});
