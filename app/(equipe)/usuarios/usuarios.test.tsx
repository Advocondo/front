import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConviteView } from "@/app/convite/ConviteView";
import { RequireAuth } from "@/app/components/RequireAuth";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import type { Usuario } from "./api";
import { UsuariosView } from "./UsuariosView";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

// Mesmos campos de UserResponse no back.
const eu: Usuario = { id: "u-eu", name: "Ana Admin", email: "ana@example.com", role: "admin", status: "active", is_lawyer: false, oab_number: null };
const bia: Usuario = { id: "u-bia", name: "Bia Equipe", email: "bia@example.com", role: "operator", status: "active", is_lawyer: true, oab_number: "DF123456" };
const caio: Usuario = { id: "u-caio", name: "Caio Inativo", email: "caio@example.com", role: "operator", status: "inactive", is_lawyer: false, oab_number: null };
const duda: Usuario = { id: "u-duda", name: "Duda Pendente", email: "duda@example.com", role: "client", status: "pending", is_lawyer: false, oab_number: null };

type Resposta = { status: number; body?: unknown };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi({ rota, usuarios = [eu, bia, caio, duda] }: { rota?: Rota; usuarios?: Usuario[] } = {}) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const resposta = rota?.(url, init) ?? { status: 200, body: usuarios };
    return Promise.resolve(new Response(resposta.body === undefined ? null : JSON.stringify(resposta.body), { status: resposta.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const entrarComo = (id: string, role: Role) => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id, name: "X", email: "x@example.com", role } }, true);
const chamada = (fn: ReturnType<typeof mockApi>, metodo: string) => fn.mock.calls.find(([, init]) => init?.method === metodo);
const corpo = (fn: ReturnType<typeof mockApi>, metodo: string) => JSON.parse(chamada(fn, metodo)?.[1]?.body as string);

beforeEach(() => {
  replace.mockClear();
  entrarComo("u-eu", "admin");
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("Listagem de usuários", () => {
  it("mostra perfil, advogado com OAB e situação", async () => {
    mockApi();
    render(<UsuariosView />);
    const linha = (await screen.findByText("Bia Equipe")).closest("tr") as HTMLElement;
    expect(within(linha).getByText("bia@example.com")).toBeInTheDocument();
    expect(within(linha).getByText("Equipe Operacional")).toBeInTheDocument();
    expect(within(linha).getByText("Advogado · OAB DF123456")).toBeInTheDocument();
    expect(within(linha).getByText("Ativo")).toBeInTheDocument();
    expect(within(screen.getByText("Caio Inativo").closest("tr") as HTMLElement).getByText("Inativo")).toBeInTheDocument();
    expect(within(screen.getByText("Duda Pendente").closest("tr") as HTMLElement).getByText("Pendente")).toBeInTheDocument();
  });

  it("busca no servidor e filtra por situação, com as contagens", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<UsuariosView />);
    await screen.findByText("Bia Equipe");
    await user.click(screen.getByRole("button", { name: "Inativos · 1" }));
    expect(screen.getByText("Caio Inativo")).toBeInTheDocument();
    expect(screen.queryByText("Bia Equipe")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Buscar por nome ou e-mail"), "caio");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toMatch(/\/users\?.*search=caio/));
  });

  it("mostra o erro e permite tentar de novo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<UsuariosView />);
    expect(await screen.findByText("Não foi possível carregar a lista")).toBeInTheDocument();
  });

  it("não oferece ações sobre a própria conta, como o back exige", async () => {
    mockApi();
    render(<UsuariosView />);
    const linha = (await screen.findByText("Ana Admin")).closest("tr") as HTMLElement;
    expect(within(linha).getByText("você")).toBeInTheDocument();
    expect(within(linha).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("US07-CA02: só o Administrador", () => {
  it("a tela leva quem não é Administrador para o painel dele", async () => {
    entrarComo("u-bia", "operator");
    render(
      <RequireAuth roles={["admin"]}>
        <p>Conteúdo</p>
      </RequireAuth>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/condominios"));
    expect(screen.queryByText("Conteúdo")).not.toBeInTheDocument();
  });

  it.each<[Role, boolean]>([
    ["admin", true],
    ["operator", false],
  ])("o item do menu para o perfil %s: %s", (role, visivel) => {
    entrarComo("x", role);
    render(<PlataformaShell activeId="acordos" title="T"><p>c</p></PlataformaShell>);
    expect(screen.queryByText("Gestão de usuários") !== null).toBe(visivel);
  });
});

describe("US07: convite", () => {
  const abrir = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<UsuariosView />);
    await screen.findByText("Bia Equipe");
    await user.click(screen.getByRole("button", { name: /Convidar membro/ }));
  };
  const enviar = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Enviar convite" }));
  async function preencher(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/Nome completo/), "Carla Menezes");
    await user.type(screen.getByLabelText(/E-mail/), "carla@example.com");
    await user.selectOptions(screen.getByLabelText(/Nível de acesso/), "operator");
  }
  const convidado: Usuario = { ...duda, id: "u-n", name: "Carla Menezes", email: "carla@example.com", role: "operator" };
  const ok: Rota = (_, init) => (init?.method === "POST" ? { status: 201, body: convidado } : undefined);

  it("CA01: envia exatamente os campos que o back aceita", async () => {
    const fetchMock = mockApi({ rota: ok });
    const user = userEvent.setup();
    await abrir(user);
    await preencher(user);
    await enviar(user);
    expect(await screen.findByText("Convite enviado para carla@example.com.")).toBeInTheDocument();
    expect(chamada(fetchMock, "POST")?.[0]).toMatch(/\/users\/invites$/);
    expect(corpo(fetchMock, "POST")).toEqual({ name: "Carla Menezes", email: "carla@example.com", role: "operator", is_lawyer: false, oab_number: null });
  });

  it("o convite não oferece o perfil Administrador, que o back recusa", async () => {
    mockApi();
    const user = userEvent.setup();
    await abrir(user);
    const opcoes = within(screen.getByLabelText(/Nível de acesso/)).getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toEqual(["Selecione", "Equipe Operacional", "Cliente"]);
  });

  it("CA04: marcar advogado exige a OAB, independente do perfil", async () => {
    const fetchMock = mockApi({ rota: ok });
    const user = userEvent.setup();
    await abrir(user);
    await preencher(user);
    expect(screen.queryByLabelText(/Número da OAB/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("É advogado(a) com OAB"));
    await enviar(user);
    expect(await screen.findByText(/A OAB tem de 8 a 12 caracteres/)).toBeInTheDocument();
    expect(chamada(fetchMock, "POST")).toBeUndefined();

    await user.type(screen.getByLabelText(/Número da OAB/), "DF123456");
    await enviar(user);
    await screen.findByText(/Convite enviado/);
    expect(corpo(fetchMock, "POST")).toMatchObject({ is_lawyer: true, oab_number: "DF123456" });
  });

  it("não envia sem os obrigatórios", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    await abrir(user);
    await enviar(user);
    expect(await screen.findByText("Informe o nome.")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(screen.getByText("Selecione o nível de acesso.")).toBeInTheDocument();
    expect(chamada(fetchMock, "POST")).toBeUndefined();
  });

  it("CA03: e-mail repetido aparece no campo", async () => {
    mockApi({ rota: (_, init) => (init?.method === "POST" ? { status: 409, body: { detail: "Este e-mail já está em uso por outro usuário." } } : undefined) });
    const user = userEvent.setup();
    await abrir(user);
    await preencher(user);
    await enviar(user);
    expect(await screen.findByText("Este e-mail já está em uso por outro usuário.")).toBeInTheDocument();
  });

  it("mostra a recusa do servidor e os erros por campo", async () => {
    let tentativa = 0;
    mockApi({
      rota: (_, init) => {
        if (init?.method !== "POST") return undefined;
        tentativa += 1;
        return tentativa === 1 ? { status: 422, body: { detail: "Não é possível convidar outro Administrador." } } : { status: 422, body: { detail: [{ loc: ["body", "email"], msg: "value is not a valid email" }] } };
      },
    });
    const user = userEvent.setup();
    await abrir(user);
    await preencher(user);
    await enviar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("convidar outro Administrador");
    await enviar(user);
    expect(await screen.findByText("Valor inválido.")).toBeInTheDocument();
  });
});

describe("US08: inativar e reativar", () => {
  it("CA01: inativar pede confirmação e atualiza a lista", async () => {
    const fetchMock = mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 200, body: { ...bia, status: "inactive" } } : undefined) });
    const user = userEvent.setup();
    render(<UsuariosView />);
    await user.click(await screen.findByRole("button", { name: "Inativar Bia Equipe" }));
    expect(chamada(fetchMock, "PATCH")).toBeUndefined();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Inativar acesso" }));

    expect(await screen.findByText("Acesso de Bia Equipe inativado.")).toBeInTheDocument();
    expect(chamada(fetchMock, "PATCH")?.[0]).toMatch(/\/users\/u-bia\/status$/);
    expect(corpo(fetchMock, "PATCH")).toEqual({ status: "inactive" });
  });

  it("CA03: reativar um usuário inativo", async () => {
    const fetchMock = mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 200, body: { ...caio, status: "active" } } : undefined) });
    const user = userEvent.setup();
    render(<UsuariosView />);
    await user.click(await screen.findByRole("button", { name: "Reativar Caio Inativo" }));
    expect(await screen.findByText("Acesso de Caio Inativo reativado com sucesso.")).toBeInTheDocument();
    expect(corpo(fetchMock, "PATCH")).toEqual({ status: "active" });
  });

  it("usuário pendente não tem inativar nem reativar, como o back exige", async () => {
    mockApi();
    render(<UsuariosView />);
    await screen.findByText("Duda Pendente");
    expect(screen.queryByRole("button", { name: "Inativar Duda Pendente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reativar Duda Pendente" })).not.toBeInTheDocument();
  });

  it("mostra a recusa do servidor ao inativar e ao reativar", async () => {
    mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 422, body: { detail: "Operação recusada." } } : undefined) });
    const user = userEvent.setup();
    render(<UsuariosView />);
    await user.click(await screen.findByRole("button", { name: "Reativar Caio Inativo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Operação recusada.");
    await user.click(screen.getByRole("button", { name: "Inativar Bia Equipe" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Inativar acesso" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("Operação recusada.");
  });
});

describe("US09: nível de acesso", () => {
  it("CA01: muda o perfil, e o botão só habilita com mudança", async () => {
    const fetchMock = mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 200, body: { ...bia, role: "admin" } } : undefined) });
    const user = userEvent.setup();
    render(<UsuariosView />);
    await user.click(await screen.findByRole("button", { name: "Definir nível de acesso de Bia Equipe" }));
    expect(screen.getByRole("button", { name: "Salvar perfil" })).toBeDisabled();
    await user.selectOptions(within(screen.getByRole("dialog")).getByLabelText(/Nível de acesso/), "admin");
    await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(await screen.findByText("Bia Equipe agora é Administrador.")).toBeInTheDocument();
    expect(chamada(fetchMock, "PATCH")?.[0]).toMatch(/\/users\/u-bia\/role$/);
    expect(corpo(fetchMock, "PATCH")).toEqual({ role: "admin" });
  });

  it("mostra a recusa do servidor", async () => {
    mockApi({ rota: (_, init) => (init?.method === "PATCH" ? { status: 403, body: { detail: "Você não tem permissão para esta operação." } } : undefined) });
    const user = userEvent.setup();
    render(<UsuariosView />);
    await user.click(await screen.findByRole("button", { name: "Definir nível de acesso de Bia Equipe" }));
    await user.selectOptions(within(screen.getByRole("dialog")).getByLabelText(/Nível de acesso/), "client");
    await user.click(screen.getByRole("button", { name: "Salvar perfil" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não tem permissão");
  });
});

describe("Aceitar o convite (/convite)", () => {
  const criar = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Criar acesso" }));

  it("define a senha com o token do link e leva ao login", async () => {
    const fetchMock = mockApi({ rota: () => ({ status: 200, body: duda }) });
    const user = userEvent.setup();
    render(<ConviteView token="tok-123" />);
    await user.type(screen.getByLabelText(/Nova senha/), "senha-boa-123");
    await user.type(screen.getByLabelText(/Confirme/), "senha-boa-123");
    await criar(user);
    expect(await screen.findByRole("status")).toHaveTextContent("Sua senha foi definida");
    expect(chamada(fetchMock, "POST")?.[0]).toMatch(/\/users\/invites\/accept$/);
    expect(corpo(fetchMock, "POST")).toEqual({ token: "tok-123", password: "senha-boa-123" });
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
  });

  it("valida o tamanho e a confirmação da senha", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<ConviteView token="tok-123" />);
    await user.type(screen.getByLabelText(/Nova senha/), "curta");
    await user.type(screen.getByLabelText(/Confirme/), "outra");
    await criar(user);
    expect(await screen.findByText("A senha precisa ter pelo menos 8 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("As senhas não são iguais.")).toBeInTheDocument();
    expect(chamada(fetchMock, "POST")).toBeUndefined();
  });

  it("mostra quando o convite é inválido ou expirou", async () => {
    mockApi({ rota: () => ({ status: 422, body: { detail: "O convite é inválido ou já expirou." } }) });
    const user = userEvent.setup();
    render(<ConviteView token="velho" />);
    await user.type(screen.getByLabelText(/Nova senha/), "senha-boa-123");
    await user.type(screen.getByLabelText(/Confirme/), "senha-boa-123");
    await criar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("inválido ou já expirou");
  });

  it("sem token no link, explica o que fazer em vez de mostrar o formulário", () => {
    render(<ConviteView token="" />);
    expect(screen.getByRole("alert")).toHaveTextContent("link está incompleto");
    expect(screen.queryByRole("button", { name: "Criar acesso" })).not.toBeInTheDocument();
  });
});
