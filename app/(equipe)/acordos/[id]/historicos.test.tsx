import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UsuariosView } from "@/app/(equipe)/usuarios/UsuariosView";
import { descreverRegistro } from "@/app/(equipe)/usuarios/HistoricoDialog";
import type { RegistroDoUsuario, Usuario } from "@/app/(equipe)/usuarios/api";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import type { Acordo, MovimentacaoFinanceira } from "../types";
import { AcordoDetalheView } from "./AcordoDetalheView";
import { descreverMovimentacao } from "./HistoricoFinanceiro";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const acordo: Acordo = {
  id: "a-1", status: "active", total_amount: "900.00", fee_amount: "90.00", fee_percentage: "10.00", installment_count: 3,
  condominium: { id: "c-1", name: "Ed. Century" }, debtor: { id: "d-1", name: "Cláudio Bezerra", unit: "1101" }, responsible_lawyer: null, cancelled_at: null, cancellation_reason: null,
};
const base = { changed_at: "2026-08-20T18:30:00Z", changed_by: { id: "u-1", name: "Sarah Lima" }, installment_number: null, field: null, old_value: null, new_value: null };
const baixa: MovimentacaoFinanceira = { ...base, change: "payment_recorded", installment_number: 4, new_value: "250.00" };
const edicao: MovimentacaoFinanceira = { ...base, change: "agreement_edited", field: "total_amount", old_value: "5500.00", new_value: "5000.00" };

const eu: Usuario = { id: "u-eu", name: "Ana Admin", email: "ana@example.com", role: "admin", status: "active", is_lawyer: false, oab_number: null };
const bia: Usuario = { id: "u-bia", name: "Bia Equipe", email: "bia@example.com", role: "operator", status: "inactive", is_lawyer: false, oab_number: null };
const registroBase = { id: "r-1", created_at: "2026-08-20T18:30:00Z", old_value: null, new_value: null, added_condominiums: [], removed_condominiums: [], actor: { id: "u-eu", name: "Ana Admin" } };
const inativacao: RegistroDoUsuario = { ...registroBase, action: "status_changed", old_value: "active", new_value: "inactive" };

const entrarComo = (role: Role) => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-eu", name: "Ana Admin", email: "ana@example.com", role } }, true);

type Resposta = { status: number; body: unknown };

function mockApi(rota: (url: string) => Resposta | undefined = () => undefined) {
  const fn = vi.fn((url: string) => {
    const r = rota(url) ?? (() => {
      if (url.includes("/financial-history")) return { status: 200, body: [edicao, baixa] };
      if (url.includes("/history")) return { status: 200, body: { logs: [inativacao] } };
      if (url.includes("/notifications")) return { status: 200, body: { unread_count: 0, notifications: [] } };
      if (url.includes("/users/lawyers") || url.includes("/installments") || url.includes("/lawyer-history") || url.includes("/documents") || url.includes("/pdfs")) return { status: 200, body: [] };
      if (url.includes("/users")) return { status: 200, body: [eu, bia] };
      return { status: 200, body: acordo };
    })();
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("US31: histórico financeiro do acordo", () => {
  it("CA01: mostra quem, quando, o quê e o valor", async () => {
    entrarComo("admin");
    mockApi();
    render(<AcordoDetalheView id="a-1" />);
    const linha = (await screen.findByText("Baixa da parcela 4")).closest("tr") as HTMLElement;
    expect(within(linha).getByText("Sarah Lima")).toBeInTheDocument();
    expect(within(linha).getByText("20/08/2026 15:30")).toBeInTheDocument();
    expect(within(linha).getByText("+ R$ 250,00")).toBeInTheDocument();
    expect(screen.getByText("de R$ 5.500,00 para R$ 5.000,00")).toBeInTheDocument();
  });

  it("CA02: a Equipe Operacional não vê o bloco nem chama a rota", async () => {
    entrarComo("operator");
    const fetchMock = mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByText("Cláudio Bezerra");
    expect(screen.queryByText("Histórico financeiro")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/financial-history"))).toBe(false);
  });

  it("uma falha fica no bloco, e o resto do acordo continua na tela", async () => {
    entrarComo("admin");
    let falhar = true;
    const user = userEvent.setup();
    mockApi((url) => (falhar && url.includes("/financial-history") ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<AcordoDetalheView id="a-1" />);
    // A tela faz várias requisições antes de o bloco aparecer: com a suíte inteira rodando, 1 segundo não basta.
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" }, { timeout: 5000 });
    expect(screen.getByText("Cláudio Bezerra")).toBeInTheDocument();
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByText("Baixa da parcela 4", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it("explica quando não há movimentações", async () => {
    entrarComo("admin");
    mockApi((url) => (url.includes("/financial-history") ? { status: 200, body: [] } : undefined));
    render(<AcordoDetalheView id="a-1" />);
    expect(await screen.findByText("Nenhuma movimentação registrada.")).toBeInTheDocument();
  });

  it.each<[Partial<MovimentacaoFinanceira>, string, string]>([
    [{ change: "payment_recorded", installment_number: 2, new_value: "100.50" }, "Baixa da parcela 2", "+ R$ 100,50"],
    [{ change: "payment_reversed", installment_number: 2, old_value: "100.50" }, "Estorno da parcela 2", "- R$ 100,50"],
    [{ change: "payment_corrected", installment_number: 2, old_value: "2026-01-31", new_value: "2026-02-01" }, "Correção da data de pagamento da parcela 2", "de 31/01/2026 para 01/02/2026"],
    [{ change: "due_date_edited", installment_number: 3, old_value: "2026-03-10", new_value: "2026-03-20" }, "Vencimento da parcela 3", "de 10/03/2026 para 20/03/2026"],
    [{ change: "amount_edited", installment_number: 3, old_value: "300.00", new_value: "350.00" }, "Valor da parcela 3", "de R$ 300,00 para R$ 350,00"],
    [{ change: "agreement_edited", field: "total_amount", old_value: "900.00", new_value: "1200.00" }, "Valor total do acordo", "de R$ 900,00 para R$ 1.200,00"],
    [{ change: "agreement_edited", field: "fee_amount", old_value: "90.00", new_value: "120.00" }, "Honorários do acordo", "de R$ 90,00 para R$ 120,00"],
    [{ change: "agreement_edited", field: "debtor", old_value: "Ana (101)", new_value: "Bia (102)" }, "Devedor do acordo", "de Ana (101) para Bia (102)"],
  ])("descreve %j", (mudanca, acao, valor) => {
    expect(descreverMovimentacao({ ...base, ...mudanca } as MovimentacaoFinanceira)).toEqual({ acao, valor });
  });
});

describe("US11: histórico do usuário", () => {
  it("CA01: mostra data, autor e o que mudou", async () => {
    entrarComo("admin");
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<UsuariosView />);
    await user.click(await screen.findByRole("button", { name: "Ver histórico de Bia Equipe" }));
    const dialogo = await screen.findByRole("dialog");
    expect(await within(dialogo).findByText("Situação alterada")).toBeInTheDocument();
    expect(within(dialogo).getByText("De Ativo para Inativo")).toBeInTheDocument();
    expect(within(dialogo).getByText("por Ana Admin")).toBeInTheDocument();
    expect(within(dialogo).getByText("20/08/2026 15:30")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes("/users/u-bia/history"))).toBe(true));
  });

  it("o Administrador também vê o próprio histórico", async () => {
    entrarComo("admin");
    mockApi();
    render(<UsuariosView />);
    expect(await screen.findByRole("button", { name: "Ver histórico de Ana Admin" })).toBeInTheDocument();
  });

  it("explica autor ausente e histórico vazio", async () => {
    entrarComo("admin");
    const user = userEvent.setup();
    mockApi((url) => (url.includes("/history") ? { status: 200, body: { logs: [{ ...inativacao, actor: null }] } } : undefined));
    render(<UsuariosView />);
    await user.click(await screen.findByRole("button", { name: "Ver histórico de Bia Equipe" }));
    expect(await screen.findByText("Autor não registrado")).toBeInTheDocument();
  });

  it("mostra o erro e deixa tentar de novo", async () => {
    entrarComo("admin");
    const user = userEvent.setup();
    let falhar = true;
    mockApi((url) => (falhar && url.includes("/history") ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<UsuariosView />);
    await user.click(await screen.findByRole("button", { name: "Ver histórico de Bia Equipe" }));
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByText("Situação alterada")).toBeInTheDocument();
  });

  it.each<[Partial<RegistroDoUsuario>, string, string]>([
    [{ action: "invited", new_value: "client" }, "Convite enviado", "Perfil Cliente"],
    [{ action: "role_changed", old_value: "client", new_value: "operator" }, "Perfil alterado", "De Cliente para Equipe Operacional"],
    [{ action: "status_changed", old_value: "inactive", new_value: "active" }, "Situação alterada", "De Inativo para Ativo"],
    [{ action: "condominiums_changed", added_condominiums: [{ id: "c", name: "Villa" }], removed_condominiums: [{ id: "d", name: "Parque" }, { id: "e", name: "Lago" }] }, "Condomínios alterados", "Vinculados: Villa. Removidos: Parque, Lago"],
  ])("descreve %j", (mudanca, title, description) => {
    expect(descreverRegistro({ ...registroBase, ...mudanca } as RegistroDoUsuario)).toMatchObject({ title, description });
  });
});
