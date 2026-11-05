import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { clearSession, getSession, saveSession, type Role } from "@/app/lib/session";
import { descreverAparelho } from "./aparelho";
import { PerfilView } from "./PerfilView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

const atual = { id: "s-1", user_agent: CHROME_WINDOWS, created_at: "2026-11-05T15:00:00Z", expires_at: "2026-11-06T15:00:00Z", is_current: true };
const celular = { id: "s-2", user_agent: SAFARI_IPHONE, created_at: "2026-11-04T15:00:00Z", expires_at: "2026-11-06T15:00:00Z", is_current: false };

type Resposta = { status: number; body?: unknown };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi(rota?: Rota) {
  let sessoes = [atual, celular];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const padrao = (): Resposta => {
      if (url.endsWith("/auth/sessions") && !init?.method) return { status: 200, body: sessoes };
      if (url.endsWith("/auth/sessions/others")) {
        sessoes = [atual];
        return { status: 204 };
      }
      if (url.endsWith("/auth/sessions/s-2")) {
        sessoes = [atual];
        return { status: 204 };
      }
      if (url.endsWith("/users/me")) return { status: 200, body: { name: "Ana Nova", email: "nova@example.com" } };
      return { status: 204 };
    };
    const resposta = rota?.(url, init) ?? padrao();
    return Promise.resolve(new Response(resposta.body === undefined ? null : JSON.stringify(resposta.body), { status: resposta.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const entrarComo = (role: Role = "operator", manterConectado = true) => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana Lima", email: "ana@example.com", role } }, manterConectado);
const corpoDoPatch = (fn: ReturnType<typeof mockApi>) => JSON.parse(fn.mock.calls.find(([, init]) => init?.method === "PATCH")?.[1]?.body as string);
const houvePatch = (fn: ReturnType<typeof mockApi>) => fn.mock.calls.some(([, init]) => init?.method === "PATCH");

beforeEach(() => entrarComo());

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("US05: dados de acesso", () => {
  it("CA01: o nome muda sem pedir a senha, e o resto da tela acompanha", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi((url) => (url.endsWith("/users/me") ? { status: 200, body: { name: "Ana Nova", email: "ana@example.com" } } : undefined));
    render(<PerfilView />);

    await user.clear(screen.getByLabelText(/^Nome/));
    await user.type(screen.getByLabelText(/^Nome/), "Ana Nova");
    expect(screen.queryByLabelText(/Senha atual/, { selector: "#perfil-email-senha" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));

    expect(await screen.findByText("Dados salvos com sucesso.")).toBeInTheDocument();
    expect(corpoDoPatch(fetchMock)).toEqual({ name: "Ana Nova" });
    expect(getSession()?.user.name).toBe("Ana Nova");
  });

  it("CA02: mudar o e-mail pede a senha atual, antes de chamar o back", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<PerfilView />);

    await user.clear(screen.getByLabelText(/^E-mail/));
    await user.type(screen.getByLabelText(/^E-mail/), "nova@example.com");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));

    expect(await screen.findByText("Informe a senha atual para alterar o e-mail.")).toBeInTheDocument();
    expect(houvePatch(fetchMock)).toBe(false);

    await user.type(document.getElementById("perfil-email-senha") as HTMLElement, "senha-atual");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));
    await screen.findByText("Dados salvos com sucesso.");
    expect(corpoDoPatch(fetchMock)).toEqual({ email: "nova@example.com", current_password: "senha-atual" });
    expect(getSession()?.user.email).toBe("nova@example.com");
  });

  it("mantém a sessão onde ela estava: sem Manter conectado, continua acabando com a aba", async () => {
    clearSession();
    entrarComo("operator", false);
    const user = userEvent.setup();
    mockApi((url) => (url.endsWith("/users/me") ? { status: 200, body: { name: "Ana Nova", email: "ana@example.com" } } : undefined));
    render(<PerfilView />);
    await user.clear(screen.getByLabelText(/^Nome/));
    await user.type(screen.getByLabelText(/^Nome/), "Ana Nova");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));
    await screen.findByText("Dados salvos com sucesso.");
    expect(localStorage.getItem("advocondo.session")).toBeNull();
    expect(sessionStorage.getItem("advocondo.session")).toContain("Ana Nova");
  });

  it("sem mudança, não há o que salvar", () => {
    mockApi();
    render(<PerfilView />);
    expect(screen.getByRole("button", { name: "Salvar dados" })).toBeDisabled();
  });

  it("recusa nome vazio e e-mail inválido sem chamar o back", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<PerfilView />);
    await user.clear(screen.getByLabelText(/^Nome/));
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));
    expect(await screen.findByText("Informe o nome.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^E-mail/));
    await user.type(screen.getByLabelText(/^E-mail/), "sem-arroba");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));
    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(houvePatch(fetchMock)).toBe(false);
  });

  it("mostra a recusa do back, como e-mail em uso", async () => {
    const user = userEvent.setup();
    mockApi((url) => (url.endsWith("/users/me") ? { status: 409, body: { detail: "Este e-mail já está em uso por outro usuário." } } : undefined));
    render(<PerfilView />);
    await user.clear(screen.getByLabelText(/^E-mail/));
    await user.type(screen.getByLabelText(/^E-mail/), "outra@example.com");
    await user.type(document.getElementById("perfil-email-senha") as HTMLElement, "senha-atual");
    await user.click(screen.getByRole("button", { name: "Salvar dados" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("já está em uso");
    expect(getSession()?.user.email).toBe("ana@example.com");
  });

  it("mostra o perfil de acesso só como leitura", () => {
    mockApi();
    render(<PerfilView />);
    expect(screen.getByText("Equipe Operacional")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

describe("US05: alterar senha", () => {
  async function preencher(user: ReturnType<typeof userEvent.setup>, atualValor: string, nova: string, confirmacao: string) {
    if (atualValor) await user.type(document.getElementById("senha-atual") as HTMLElement, atualValor);
    if (nova) await user.type(document.getElementById("senha-nova") as HTMLElement, nova);
    if (confirmacao) await user.type(document.getElementById("senha-confirmacao") as HTMLElement, confirmacao);
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
  }

  it("CA02: envia a senha atual com a nova, limpa os campos e atualiza as sessões", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<PerfilView />);
    await screen.findByText("iPhone · Safari");
    const antes = fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/sessions")).length;

    await preencher(user, "senha-atual", "senha-nova-123", "senha-nova-123");

    expect(await screen.findByText("Senha alterada. As outras sessões foram encerradas.")).toBeInTheDocument();
    expect(corpoDoPatch(fetchMock)).toEqual({ new_password: "senha-nova-123", current_password: "senha-atual" });
    expect(document.getElementById("senha-nova")).toHaveValue("");
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/sessions")).length).toBeGreaterThan(antes));
  });

  it("não envia sem a senha atual, com senha curta ou com senhas diferentes", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<PerfilView />);
    await preencher(user, "", "curta", "outra");
    expect(await screen.findByText("Informe a senha atual.")).toBeInTheDocument();
    expect(screen.getByText("A senha precisa ter entre 8 e 128 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("As senhas não são iguais.")).toBeInTheDocument();
    expect(houvePatch(fetchMock)).toBe(false);
  });

  it("senha atual errada mostra o erro e não encerra a sessão", async () => {
    const user = userEvent.setup();
    mockApi((url) => (url.endsWith("/users/me") ? { status: 422, body: { detail: "A senha atual está incorreta." } } : undefined));
    render(<PerfilView />);
    await preencher(user, "errada", "senha-nova-123", "senha-nova-123");
    expect(await screen.findByRole("alert")).toHaveTextContent("A senha atual está incorreta.");
    expect(getSession()).not.toBeNull();
  });
});

describe("US06: sessões ativas", () => {
  it("lista os aparelhos e marca este, sem oferecer encerrá-lo", async () => {
    mockApi();
    render(<PerfilView />);
    const este = (await screen.findByText("Windows · Chrome")).closest("li") as HTMLElement;
    expect(within(este).getByText("Este aparelho")).toBeInTheDocument();
    expect(within(este).queryByRole("button")).not.toBeInTheDocument();
    expect(within(este).getByText("Entrou em 05/11/2026 12:00")).toBeInTheDocument();
    expect(within(screen.getByText("iPhone · Safari").closest("li") as HTMLElement).getByRole("button", { name: /Encerrar a sessão/ })).toBeInTheDocument();
  });

  it("CA01: Encerrar as outras usa a rota que mantém esta sessão", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<PerfilView />);
    await user.click(await screen.findByRole("button", { name: "Encerrar as outras" }));

    expect(await screen.findByText("Outras sessões encerradas.")).toBeInTheDocument();
    const chamada = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(chamada?.[0]).toMatch(/\/auth\/sessions\/others$/);
    await waitFor(() => expect(screen.queryByText("iPhone · Safari")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Encerrar as outras" })).not.toBeInTheDocument();
    expect(getSession()).not.toBeNull();
  });

  it("encerra uma sessão específica", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<PerfilView />);
    await user.click(await screen.findByRole("button", { name: /Encerrar a sessão de iPhone/ }));
    expect(await screen.findByText("Sessão de iPhone · Safari encerrada.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")?.[0]).toMatch(/\/auth\/sessions\/s-2$/);
  });

  it("sessão que já tinha acabado só atualiza a lista, sem erro", async () => {
    const user = userEvent.setup();
    let lista = [atual, celular];
    mockApi((url, init) => {
      if (init?.method === "DELETE") {
        lista = [atual];
        return { status: 404, body: { detail: "Sessão não encontrada." } };
      }
      return url.endsWith("/auth/sessions") ? { status: 200, body: lista } : undefined;
    });
    render(<PerfilView />);
    await user.click(await screen.findByRole("button", { name: /Encerrar a sessão de iPhone/ }));
    await waitFor(() => expect(screen.queryByText("iPhone · Safari")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra a falha ao encerrar e mantém a sessão na lista", async () => {
    const user = userEvent.setup();
    mockApi((_url, init) => (init?.method === "DELETE" ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<PerfilView />);
    await user.click(await screen.findByRole("button", { name: "Encerrar as outras" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("iPhone · Safari")).toBeInTheDocument();
  });

  it("deixa tentar de novo quando a lista não carrega", async () => {
    const user = userEvent.setup();
    let falhar = true;
    mockApi((url, init) => (falhar && url.endsWith("/auth/sessions") && !init?.method ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<PerfilView />);
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByText("iPhone · Safari")).toBeInTheDocument();
  });

  it("Sair desta sessão encerra e limpa a sessão", async () => {
    const user = userEvent.setup();
    mockApi();
    render(<PerfilView />);
    await user.click(screen.getByRole("button", { name: "Sair desta sessão" }));
    await waitFor(() => expect(getSession()).toBeNull());
  });
});

describe("Acesso à tela", () => {
  it("o Cliente abre a tela na casca dele, sem o menu do escritório", async () => {
    clearSession();
    entrarComo("client");
    mockApi();
    render(<PerfilView />);
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.queryByText("Devedores")).not.toBeInTheDocument();
    await screen.findByText("Windows · Chrome");
  });

  it("o nome no rodapé do menu leva ao perfil", () => {
    render(<PlataformaShell activeId="acordos" title="T"><p>x</p></PlataformaShell>);
    expect(screen.getByRole("link", { name: "Ana Lima" })).toHaveAttribute("href", "/perfil");
  });
});

describe("Identificação do aparelho", () => {
  it.each([
    [CHROME_WINDOWS, "Windows · Chrome", "monitor"],
    [SAFARI_IPHONE, "iPhone · Safari", "smartphone"],
    ["Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1", "iPad · Safari", "tablet"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel) Chrome/130.0 Mobile Safari/537.36", "Android · Chrome", "smartphone"],
    ["Mozilla/5.0 (Linux; Android 14; Tab) Chrome/130.0 Safari/537.36", "Android · Chrome", "tablet"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Version/17.0 Safari/605.1.15", "macOS · Safari", "monitor"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0", "Linux · Firefox", "monitor"],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0", "Windows · Edge", "monitor"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/130.0 Mobile Safari/604.1", "iPhone · Chrome", "smartphone"],
    ["curl/8.0", "Aparelho não identificado", "monitor"],
    [null, "Aparelho não identificado", "monitor"],
  ])("%s", (userAgent, nome, icone) => {
    expect(descreverAparelho(userAgent)).toEqual({ nome, icone });
  });
});
