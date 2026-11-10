import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaisView } from "@/app/(equipe)/mais/MaisView";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import { itensDaBarraInferior, itensDoMais } from "./navegacao";
import { PlataformaShell } from "./PlataformaShell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

function entrarComo(role: Role) {
  saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana Souza", email: "ana@example.com", role } }, true);
  // O sino da barra superior consulta as notificações.
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ unread_count: 0, notifications: [] }), { status: 200 }))));
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

const rotulos = (itens: { label: string }[]) => itens.map((i) => i.label);
const barraInferior = () => screen.getByRole("navigation", { name: "Navegação inferior" });

describe("#83: navegação no celular", () => {
  it("o Administrador tem Painel, Acordos, Mês, Condomínios e Mais na barra inferior", () => {
    expect(rotulos(itensDaBarraInferior("admin"))).toEqual(["Painel", "Acordos", "Mês", "Condomínios", "Mais"]);
  });

  it("o Operador, sem Painel, tem Devedores no lugar", () => {
    expect(rotulos(itensDaBarraInferior("operator"))).toEqual(["Acordos", "Mês", "Condomínios", "Devedores", "Mais"]);
  });

  it("CA02: o Mais do Operador não tem itens do Administrador", () => {
    expect(rotulos(itensDoMais("operator"))).toEqual(["Metas e comissões", "Notificações", "Meu perfil"]);
  });

  it("CA01: entre a barra e o Mais, o Administrador alcança todas as telas da barra lateral", () => {
    const alcancaveis = [...itensDaBarraInferior("admin"), ...itensDoMais("admin")].map((i) => i.href);
    for (const rota of ["/painel", "/acordos", "/acompanhamento", "/metas", "/condominios", "/devedores", "/notificacoes", "/usuarios", "/auditoria", "/institucional", "/perfil", "/mais"]) {
      expect(alcancaveis).toContain(rota);
    }
  });

  it("marca a tela atual, e uma tela fora da barra marca o Mais", () => {
    entrarComo("admin");
    const { unmount } = render(<PlataformaShell activeId="acordos" title="Acordos">conteúdo</PlataformaShell>);
    expect(within(barraInferior()).getByRole("link", { name: "Acordos" })).toHaveAttribute("aria-current", "page");
    unmount();

    render(<PlataformaShell activeId="metas" title="Metas">conteúdo</PlataformaShell>);
    expect(within(barraInferior()).getByRole("link", { name: "Mais" })).toHaveAttribute("aria-current", "page");
    expect(within(barraInferior()).getByRole("link", { name: "Acordos" })).not.toHaveAttribute("aria-current");
  });

  it("a tela Mais mostra quem está logado, os itens com o selo Admin e sai da conta", async () => {
    entrarComo("admin");
    render(<MaisView />);
    expect(screen.getByText("Administrador · ana@example.com")).toBeInTheDocument();
    const lista = screen.getByRole("list", { name: "Outras telas" });
    expect(within(lista).getByRole("link", { name: /Trilha de auditoria/ })).toHaveAttribute("href", "/auditoria");
    expect(within(lista).getAllByText("Admin")).toHaveLength(3);

    await userEvent.click(screen.getByRole("button", { name: /Encerra só esta sessão/ }));
    await waitFor(() => expect(localStorage.length + sessionStorage.length).toBe(0));
  });

  it("a tela Mais do Operador não mostra os itens do Administrador", () => {
    entrarComo("operator");
    render(<MaisView />);
    const lista = screen.getByRole("list", { name: "Outras telas" });
    expect(within(lista).queryByRole("link", { name: /Gestão de usuários/ })).not.toBeInTheDocument();
    expect(within(lista).queryByText("Admin")).not.toBeInTheDocument();
  });
});
