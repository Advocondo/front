import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { clearSession, saveSession } from "@/app/lib/session";
import { TAMANHO_DA_PAGINA, type Notificacao } from "./api";
import { NotificacoesView } from "./NotificacoesView";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

// Mesmos campos de NotificationResponse no back.
const naoLida: Notificacao = {
  id: "n-1",
  created_at: "2026-11-05T06:05:00Z",
  read_at: null,
  installment: { id: "i-5", agreement_id: "a-1", number: 5, installment_count: 6, due_date: "2026-11-01", remaining_amount: "1237.50", debtor: { id: "d-1", name: "Rosângela Prado", unit: "Bloco A 101" } },
};
const lida: Notificacao = { ...naoLida, id: "n-2", read_at: "2026-11-05T12:00:00Z", installment: { ...naoLida.installment, id: "i-6", number: 6, debtor: { id: "d-2", name: "Sérgio Pontes", unit: "202" } } };
const quitada: Notificacao = { ...lida, id: "n-3", installment: { ...lida.installment, id: "i-7", remaining_amount: "0.00", debtor: { id: "d-3", name: "Tânia Quitou", unit: "303" } } };

type Resposta = { status: number; body?: unknown };

function mockApi(rota: (url: string, init?: RequestInit) => Resposta | undefined = () => undefined, pagina = { unread_count: 1, notifications: [naoLida, lida] }) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const r = rota(url, init) ?? (init?.method === "POST" ? { status: 200, body: naoLida } : { status: 200, body: pagina });
    return Promise.resolve(new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const posts = (fn: ReturnType<typeof mockApi>) => fn.mock.calls.filter(([, init]) => init?.method === "POST").map(([url]) => url);

beforeEach(() => {
  push.mockClear();
  saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana", email: "a@example.com", role: "admin" } }, true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("US30: central de notificações", () => {
  it("CA01: mostra quem deve, qual parcela, o vencimento e o saldo", async () => {
    mockApi();
    render(<NotificacoesView />);
    expect(await screen.findByText("Rosângela Prado · Bloco A 101 · 5/6 · venceu em 01/11/2026 · falta R$ 1.237,50")).toBeInTheDocument();
    expect(screen.getByText("1 não lida")).toBeInTheDocument();
  });

  it("depois da baixa, a notificação continua na lista, sem cobrar", async () => {
    mockApi(undefined, { unread_count: 0, notifications: [quitada] });
    render(<NotificacoesView />);
    expect(await screen.findByText(/Tânia Quitou.*já quitada/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$ 0,00/)).not.toBeInTheDocument();
  });

  it("CA02: clicar marca como lida e leva à fatura", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<NotificacoesView />);
    await user.click(await screen.findByRole("button", { name: /Rosângela Prado/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/faturas/i-5"));
    expect(posts(fetchMock).join()).toContain("/notifications/n-1/read");
  });

  it("CA02: uma já lida só leva à fatura", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<NotificacoesView />);
    await user.click(await screen.findByRole("button", { name: /Sérgio Pontes/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/faturas/i-6"));
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it("se a marcação falhar, ainda leva à fatura", async () => {
    const user = userEvent.setup();
    mockApi((_url, init) => (init?.method === "POST" ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<NotificacoesView />);
    await user.click(await screen.findByRole("button", { name: /Rosângela Prado/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/faturas/i-5"));
  });

  it("marca todas como lidas e atualiza a lista e o sino", async () => {
    const user = userEvent.setup();
    let marcou = false;
    const fetchMock = mockApi((url, init) => {
      if (init?.method === "POST") {
        marcou = true;
        return { status: 204 };
      }
      return marcou ? { status: 200, body: { unread_count: 0, notifications: [{ ...naoLida, read_at: "2026-11-05T12:00:00Z" }] } } : undefined;
    });
    render(<NotificacoesView />);
    expect(await screen.findByRole("link", { name: "Notificações, 1 não lida" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Marcar todas como lidas" }));

    expect(await screen.findByText("0 não lidas")).toBeInTheDocument();
    expect(posts(fetchMock).join()).toMatch(/\/notifications\/read$/);
    expect(screen.getByRole("link", { name: "Notificações" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar todas como lidas" })).not.toBeInTheDocument();
  });

  it("mostra a falha ao marcar todas", async () => {
    const user = userEvent.setup();
    mockApi((_url, init) => (init?.method === "POST" ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<NotificacoesView />);
    await user.click(await screen.findByRole("button", { name: "Marcar todas como lidas" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("1 não lida")).toBeInTheDocument();
  });

  it("explica quando não há notificações", async () => {
    mockApi(undefined, { unread_count: 0, notifications: [] });
    render(<NotificacoesView />);
    expect(await screen.findByText("Nenhuma notificação")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar todas como lidas" })).not.toBeInTheDocument();
  });

  it("mostra o erro e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    let falhar = true;
    mockApi(() => (falhar ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<NotificacoesView />);
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByRole("button", { name: /Rosângela Prado/ })).toBeInTheDocument();
  });

  it("carrega a próxima página sem repetir uma notificação", async () => {
    const user = userEvent.setup();
    const cheia = Array.from({ length: TAMANHO_DA_PAGINA }, (_, i) => ({ ...lida, id: `p-${i}` }));
    const fetchMock = mockApi((url, init) => {
      if (init?.method || !url.includes(`offset=${TAMANHO_DA_PAGINA}`)) return undefined;
      return { status: 200, body: { unread_count: 0, notifications: [cheia[0], { ...naoLida, id: "n-nova" }] } };
    }, { unread_count: 0, notifications: cheia });
    render(<NotificacoesView />);
    await user.click(await screen.findByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByRole("button", { name: /Rosângela Prado/ })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(TAMANHO_DA_PAGINA + 1);
    expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.includes(`offset=${TAMANHO_DA_PAGINA}`))).toBe(true);
  });
});

describe("US30: sino", () => {
  it("mostra o total de não lidas e leva à central", async () => {
    const fetchMock = mockApi(undefined, { unread_count: 12, notifications: [naoLida] });
    render(<PlataformaShell activeId="acordos" title="T"><p>x</p></PlataformaShell>);
    const sino = await screen.findByRole("link", { name: "Notificações, 12 não lidas" });
    expect(sino).toHaveAttribute("href", "/notificacoes");
    expect(sino).toHaveTextContent("12");
    expect(fetchMock.mock.calls[0][0]).toContain("/notifications?limit=1");
  });

  it("limita o número mostrado a 99+", async () => {
    mockApi(undefined, { unread_count: 150, notifications: [naoLida] });
    render(<PlataformaShell activeId="acordos" title="T"><p>x</p></PlataformaShell>);
    expect(await screen.findByRole("link", { name: "Notificações, 150 não lidas" })).toHaveTextContent("99+");
  });

  it("sem não lidas, não mostra número", async () => {
    const fetchMock = mockApi(undefined, { unread_count: 0, notifications: [] });
    render(<PlataformaShell activeId="acordos" title="T"><p>x</p></PlataformaShell>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Notificações" })).toHaveTextContent("");
  });

  it("uma falha na contagem não atrapalha a tela", async () => {
    const fetchMock = mockApi(() => ({ status: 500, body: { detail: "Erro" } }));
    render(<PlataformaShell activeId="acordos" title="T"><p>conteúdo</p></PlataformaShell>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Notificações" })).toBeInTheDocument();
  });
});
