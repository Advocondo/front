import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, getSession, saveSession } from "@/app/lib/session";
import { RedefinirSenhaView } from "@/app/redefinir-senha/RedefinirSenhaView";
import { RecuperarSenhaView } from "./RecuperarSenhaView";

type Resposta = { status: number; body?: unknown };

function mockApi(resposta: Resposta | (() => Resposta)) {
  const fn = vi.fn(() => {
    const { status, body } = typeof resposta === "function" ? resposta() : resposta;
    return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const chamada = (fn: ReturnType<typeof mockApi>, n = 0) => (fn.mock.calls as unknown as [string, RequestInit][])[n];
const ACEITO = { status: 202, body: { detail: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." } };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  clearSession();
});

describe("Pedir o link (US03-CA01)", () => {
  const pedir = async (user: ReturnType<typeof userEvent.setup>, email = "ana@example.com") => {
    await user.type(screen.getByLabelText(/E-mail/), email);
    await user.click(screen.getByRole("button", { name: "Enviar link" }));
  };

  it("envia o e-mail e mostra a mesma mensagem, com ou sem cadastro", async () => {
    const fetchMock = mockApi(ACEITO);
    const user = userEvent.setup();
    render(<RecuperarSenhaView />);
    await pedir(user);

    expect(await screen.findByRole("heading", { name: "Verifique o seu e-mail" })).toBeInTheDocument();
    expect(screen.getByText(/Se ana@example.com estiver cadastrado/)).toBeInTheDocument();
    expect(chamada(fetchMock)[0]).toMatch(/\/auth\/password-reset$/);
    expect(JSON.parse(chamada(fetchMock)[1].body as string)).toEqual({ email: "ana@example.com" });
  });

  it("não envia com e-mail inválido", async () => {
    const fetchMock = mockApi(ACEITO);
    const user = userEvent.setup();
    render(<RecuperarSenhaView />);
    await pedir(user, "ana@");
    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mostra a falha de rede", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<RecuperarSenhaView />);
    await pedir(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão");
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeInTheDocument();
  });

  it("o reenvio só libera depois de 2 minutos, e aí envia de novo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockApi(ACEITO);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RecuperarSenhaView />);
    await pedir(user);
    expect(await screen.findByRole("button", { name: /Reenviar link \(2:00|Reenviar link \(1:5/ })).toBeDisabled();

    // Um segundo por vez: cada tique só é agendado depois que o anterior renderiza.
    const avancar = async (segundos: number) => {
      for (let i = 0; i < segundos; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }
    };
    await avancar(30);
    expect(screen.getByRole("button", { name: /Reenviar link \(1:[23]/ })).toBeDisabled();

    await avancar(95);
    const liberado = screen.getByRole("button", { name: "Reenviar link" });
    expect(liberado).toBeEnabled();

    fireEvent.click(liberado);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: /Reenviar link \(/ })).toBeDisabled();
  });

  it("o caminho de volta leva ao login", () => {
    render(<RecuperarSenhaView />);
    expect(screen.getByRole("link", { name: "Voltar ao login" })).toHaveAttribute("href", "/login");
  });
});

describe("Criar a nova senha", () => {
  const preencher = async (user: ReturnType<typeof userEvent.setup>, senha: string, confirmacao = senha) => {
    await user.type(screen.getByLabelText(/^Nova senha/), senha);
    await user.type(screen.getByLabelText(/Confirmar nova senha/), confirmacao);
  };
  const salvar = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Salvar nova senha" }));

  it("envia o token do link com a senha, e a sessão antiga acaba (US03-CA03)", async () => {
    saveSession({ token: "velho", expiresAt: "2999-01-01T00:00:00Z", user: { id: "1", name: "Ana", email: "a@b.c", role: "admin" } }, true);
    const fetchMock = mockApi({ status: 204 });
    const user = userEvent.setup();
    render(<RedefinirSenhaView token="tok-1" />);
    await preencher(user, "senha-nova-123");
    await salvar(user);

    expect(await screen.findByRole("heading", { name: "Senha alterada" })).toBeInTheDocument();
    expect(chamada(fetchMock)[0]).toMatch(/\/auth\/password-reset\/confirm$/);
    expect(JSON.parse(chamada(fetchMock)[1].body as string)).toEqual({ token: "tok-1", new_password: "senha-nova-123" });
    expect(getSession()).toBeNull();
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
  });

  it("não envia com senha curta ou diferente", async () => {
    const fetchMock = mockApi({ status: 204 });
    const user = userEvent.setup();
    render(<RedefinirSenhaView token="tok-1" />);
    await preencher(user, "curta");
    await salvar(user);
    await user.clear(screen.getByLabelText(/^Nova senha/));
    await preencher(user, "senha-nova-123", "x");
    await salvar(user);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
  });

  it("US03-CA02: link recusado pelo back leva a pedir outro, e a senha atual continua valendo", async () => {
    mockApi({ status: 422, body: { detail: "Este link de redefinição é inválido ou expirou. Solicite um novo." } });
    const user = userEvent.setup();
    render(<RedefinirSenhaView token="velho" />);
    await preencher(user, "senha-nova-123");
    await salvar(user);
    expect(await screen.findByRole("heading", { name: "Este link não vale mais" })).toBeInTheDocument();
    expect(screen.getByText(/A senha atual continua valendo/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir novo link" })).toHaveAttribute("href", "/recuperar-senha");
  });

  it("sem token no link, já mostra que ele não vale", () => {
    render(<RedefinirSenhaView token="" />);
    expect(screen.getByRole("heading", { name: "Este link não vale mais" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Nova senha/)).not.toBeInTheDocument();
  });

  it("mostra no campo o erro de validação do servidor", async () => {
    mockApi({ status: 422, body: { detail: [{ loc: ["body", "new_password"], msg: "Value error, Senha recusada." }] } });
    const user = userEvent.setup();
    render(<RedefinirSenhaView token="tok-1" />);
    await preencher(user, "senha-nova-123");
    await salvar(user);
    expect(await screen.findByText("Senha recusada.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
  });

  it("falha de rede mantém o formulário, sem dizer que o link expirou", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<RedefinirSenhaView token="tok-1" />);
    await preencher(user, "senha-nova-123");
    await salvar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão");
    expect(screen.getByRole("heading", { name: "Criar nova senha" })).toBeInTheDocument();
  });
});
