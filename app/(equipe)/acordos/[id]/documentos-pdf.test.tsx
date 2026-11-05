import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import { PdfView } from "@/app/pdf/[acordoId]/[pdfId]/PdfView";
import type { Acordo, DocumentoDoAcordo, PdfDoAcordo } from "../types";
import { AcordoDetalheView } from "./AcordoDetalheView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const acordo: Acordo = {
  id: "a-1", status: "active", total_amount: "900.00", fee_amount: "90.00", fee_percentage: "10.00", installment_count: 3,
  condominium: { id: "c-1", name: "Ed. Century" }, debtor: { id: "d-1", name: "Cláudio Bezerra", unit: "1101" }, responsible_lawyer: null, cancelled_at: null, cancellation_reason: null,
};
const arquivo: DocumentoDoAcordo = { id: "doc-1", kind: "file", filename: "termo.pdf", content_type: "application/pdf", size: 412_000, url: null, uploaded_at: "2026-11-05T15:00:00Z", uploaded_by: { id: "u-1", name: "Sarah Lima" } };
const link: DocumentoDoAcordo = { ...arquivo, id: "doc-2", kind: "link", filename: "Termo no Drive", content_type: null, size: null, url: "https://drive.example.com/d/termo" };
const pdf: PdfDoAcordo = { id: "pdf-1", agreement_id: "a-1", file_name: "acordo-20261105.pdf", content_type: "application/pdf", size_bytes: 2817, generated_by: { id: "u-1", name: "Sarah Lima" }, generated_at: "2026-11-05T15:00:00Z", download_url: "/agreements/a-1/pdfs/pdf-1" };

type Resposta = { status: number; body?: unknown; bruto?: string };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi({ documentos = [arquivo, link], pdfs = [pdf], rota }: { documentos?: DocumentoDoAcordo[]; pdfs?: PdfDoAcordo[]; rota?: Rota } = {}) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const padrao = (): Resposta => {
      if (init?.method === "POST") return { status: 201, body: url.includes("/pdfs") ? pdf : arquivo };
      if (/\/documents\/[^/]+$/.test(url) || /\/pdfs\/[^/]+$/.test(url)) return { status: 200, bruto: "%PDF" };
      if (url.endsWith("/documents")) return { status: 200, body: documentos };
      if (url.endsWith("/pdfs")) return { status: 200, body: pdfs };
      if (url.includes("/notifications")) return { status: 200, body: { unread_count: 0, notifications: [] } };
      if (url.includes("/users/lawyers") || url.includes("/installments") || url.includes("/lawyer-history")) return { status: 200, body: [] };
      return { status: 200, body: acordo };
    };
    const r = rota?.(url, init) ?? padrao();
    return Promise.resolve(new Response(r.bruto ?? JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const entrarComo = (role: Role) => saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana", email: "a@example.com", role } }, true);
const seletor = () => screen.getByLabelText("Arquivo do documento") as HTMLInputElement;
const nomesBaixados: string[] = [];

beforeEach(() => {
  nomesBaixados.length = 0;
  entrarComo("operator");
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    nomesBaixados.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearSession();
});

describe("US21: documentos do acordo", () => {
  it("lista arquivos e links, com tamanho, data e autor", async () => {
    mockApi();
    render(<AcordoDetalheView id="a-1" />);
    const item = (await screen.findByText("termo.pdf")).closest("li") as HTMLElement;
    expect(within(item).getByText("402 KB · anexado em 05/11/2026 12:00 por Sarah Lima")).toBeInTheDocument();
  });

  it("CA01: anexa o arquivo em multipart, sem Content-Type de JSON, e atualiza a lista", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ documentos: [] });
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByText("Nenhum documento anexado.");
    await user.upload(seletor(), new File(["%PDF"], "novo.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("novo.pdf anexado com sucesso.")).toBeInTheDocument();
    const envio = fetchMock.mock.calls.find(([url, init]) => init?.method === "POST" && url.endsWith("/documents"));
    expect(envio?.[1]?.body).toBeInstanceOf(FormData);
    expect((envio?.[1]?.body as FormData).get("file")).toBeInstanceOf(File);
    const cabecalhos = envio?.[1]?.headers as Record<string, string>;
    expect(cabecalhos["Content-Type"]).toBeUndefined();
    expect(cabecalhos.Authorization).toBe("Bearer t");
  });

  it("recusa arquivo acima de 10 MB sem enviar", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ documentos: [] });
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByText("Nenhum documento anexado.");
    const grande = new File(["x"], "grande.pdf", { type: "application/pdf" });
    Object.defineProperty(grande, "size", { value: 10 * 1024 * 1024 + 1 });
    await user.upload(seletor(), grande);
    expect(await screen.findByRole("alert")).toHaveTextContent("O arquivo passa de 10 MB.");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("mostra a recusa do back, como tipo não aceito", async () => {
    const user = userEvent.setup();
    mockApi({ documentos: [], rota: (url, init) => (init?.method === "POST" && url.endsWith("/documents") ? { status: 422, body: { detail: "Tipo de arquivo não aceito. Envie PDF, PNG ou JPEG." } } : undefined) });
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByText("Nenhum documento anexado.");
    await user.upload(seletor(), new File(["x"], "falso.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tipo de arquivo não aceito");
  });

  it("CA01: baixa o arquivo com o nome original", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await user.click(await screen.findByRole("button", { name: "Baixar termo.pdf" }));
    await waitFor(() => expect(nomesBaixados).toEqual(["termo.pdf"]));
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/agreements/a-1/documents/doc-1"))).toBe(true);
  });

  it("um link abre em outra aba, sem passar referência, e não é baixado", async () => {
    mockApi();
    render(<AcordoDetalheView id="a-1" />);
    const abrir = await screen.findByRole("link", { name: "Abrir Termo no Drive" });
    expect(abrir).toHaveAttribute("href", "https://drive.example.com/d/termo");
    expect(abrir).toHaveAttribute("target", "_blank");
    expect(abrir).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("button", { name: "Baixar Termo no Drive" })).not.toBeInTheDocument();
  });

  it("não vira link um endereço que não seja http ou https", async () => {
    mockApi({ documentos: [{ ...link, url: "javascript:alert(1)" }] });
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByText("Termo no Drive");
    expect(screen.queryByRole("link", { name: "Abrir Termo no Drive" })).not.toBeInTheDocument();
  });

  it("CA02: os documentos continuam em um acordo cancelado", async () => {
    mockApi({ rota: (url) => (url.endsWith("/agreements/a-1") ? { status: 200, body: { ...acordo, status: "cancelled", cancelled_at: "2026-11-05T15:00:00Z", cancellation_reason: "x" } } : undefined) });
    render(<AcordoDetalheView id="a-1" />);
    expect(await screen.findByRole("button", { name: "Baixar termo.pdf" })).toBeInTheDocument();
  });

  it("uma falha na lista fica no bloco, e o acordo continua na tela", async () => {
    mockApi({ rota: (url) => (url.endsWith("/documents") ? { status: 500, body: { detail: "Erro" } } : undefined) });
    render(<AcordoDetalheView id="a-1" />);
    expect(await screen.findByText("Não foi possível carregar os documentos", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("Cláudio Bezerra")).toBeInTheDocument();
  });
});

describe("US24: PDF do acordo", () => {
  it("CA01: gera o PDF e atualiza a lista", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ pdfs: [] });
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByText("Nenhum PDF gerado.");
    await user.click(screen.getByRole("button", { name: "Gerar PDF" }));
    expect(await screen.findByText("PDF gerado com sucesso.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => init?.method === "POST" && url.endsWith("/agreements/a-1/pdfs"))).toBe(true);
  });

  it("CA02: baixa pelo endereço devolvido pelo back", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    render(<AcordoDetalheView id="a-1" />);
    await user.click(await screen.findByRole("button", { name: "Baixar acordo-20261105.pdf" }));
    await waitFor(() => expect(nomesBaixados).toEqual(["acordo-20261105.pdf"]));
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/agreements/a-1/pdfs/pdf-1"))).toBe(true);
  });

  it("CA02: copia um link do front, não a rota do back, que exige token", async () => {
    const user = userEvent.setup();
    mockApi();
    render(<AcordoDetalheView id="a-1" />);
    const botao = await screen.findByRole("button", { name: "Copiar o link de acordo-20261105.pdf" });
    const copiar = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(botao);
    expect(copiar).toHaveBeenCalledWith(`${window.location.origin}/pdf/a-1/pdf-1`);
    expect(await screen.findByText(/Link copiado/)).toBeInTheDocument();
  });

  it("se não conseguir copiar, mostra o link", async () => {
    const user = userEvent.setup();
    mockApi();
    render(<AcordoDetalheView id="a-1" />);
    const botao = await screen.findByRole("button", { name: "Copiar o link de acordo-20261105.pdf" });
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("bloqueado"));
    await user.click(botao);
    expect(await screen.findByRole("alert")).toHaveTextContent(`${window.location.origin}/pdf/a-1/pdf-1`);
  });

  it("mostra a falha ao gerar", async () => {
    const user = userEvent.setup();
    mockApi({ pdfs: [], rota: (url, init) => (init?.method === "POST" && url.endsWith("/pdfs") ? { status: 500, body: { detail: "Erro" } } : undefined) });
    render(<AcordoDetalheView id="a-1" />);
    await screen.findByText("Nenhum PDF gerado.");
    await user.click(screen.getByRole("button", { name: "Gerar PDF" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("US24: a tela do link", () => {
  it("CA02: o Cliente com acesso baixa o PDF", async () => {
    entrarComo("client");
    const user = userEvent.setup();
    mockApi();
    render(<PdfView acordoId="a-1" pdfId="pdf-1" />);
    await user.click(await screen.findByRole("button", { name: "Baixar PDF" }));
    await waitFor(() => expect(nomesBaixados).toEqual(["acordo-20261105.pdf"]));
    expect(screen.getByRole("link", { name: "Ir para a tela inicial" })).toHaveAttribute("href", "/painel-cliente");
  });

  it.each([404, 422])("CA03: sem acesso ao acordo, o %i vira não encontrado", async (status) => {
    entrarComo("client");
    mockApi({ rota: (url) => (url.endsWith("/pdfs") ? { status, body: { detail: "Acordo não encontrado." } } : undefined) });
    render(<PdfView acordoId="a-outro" pdfId="pdf-1" />);
    expect(await screen.findByText("PDF não encontrado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Baixar PDF" })).not.toBeInTheDocument();
  });

  it("um PDF que não é deste acordo também não é encontrado", async () => {
    mockApi();
    render(<PdfView acordoId="a-1" pdfId="pdf-outro" />);
    expect(await screen.findByText("PDF não encontrado")).toBeInTheDocument();
  });

  it("mostra outros erros e deixa tentar de novo", async () => {
    const user = userEvent.setup();
    let falhar = true;
    mockApi({ rota: (url) => (falhar && url.endsWith("/pdfs") ? { status: 500, body: { detail: "Erro" } } : undefined) });
    render(<PdfView acordoId="a-1" pdfId="pdf-1" />);
    const tentar = await screen.findByRole("button", { name: "Tentar novamente" });
    falhar = false;
    await user.click(tentar);
    expect(await screen.findByRole("button", { name: "Baixar PDF" })).toBeInTheDocument();
  });
});
