import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LandingContent } from "@/app/_landing/types";
import { ApiError } from "@/app/lib/api";
import { clearSession, saveSession } from "@/app/lib/session";
import { InstitucionalView, descreverCaminho, mensagemErro } from "./InstitucionalView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// Mesmo formato de GET /landing no back.
const conteudo: LandingContent = {
  hero: { title: "Advocacia condominial", subtitle: "Assessoria completa", button_label: "Fale conosco" },
  practice_areas: { title: "Áreas", areas: [{ title: "Cobrança", description: "Acordos" }], closing_text: "Fim" },
  online_service: { title: "Online", text: "Atendimento", button_label: "Agendar" },
  condominium_advisory: { title: "Assessoria", paragraphs: ["Primeiro"] },
  reviews: {
    title: "Avaliações",
    reviews: [{ author: "Ana", author_details: null, rating: 5, text: "Ótimo" }, { author: "Bia", author_details: "Síndica", rating: 4, text: "Bom" }],
    call_to_review_title: "Avalie",
    call_to_review_text: "Conte",
    button_label: "Avaliar",
    google_reviews_url: null,
  },
  why_us: { title: "Por quê", paragraphs: ["Experiência"], button_label: "Saiba mais" },
  team: { title: "Equipe", members: [{ name: "Edson", role: "Advogado", photo_id: "foto-salva" }], highlights: ["OAB"] },
  contact_form: { title: "Contato", subtitle: "Escreva" },
  visit: { title: "Visite", text: "Endereço", button_label: "Mapa" },
  contact: { phone: null, whatsapp: null, email: "contato@example.com", address: null, opening_hours: null, facebook_url: null, instagram_url: null },
};

type Resposta = { status: number; body?: unknown };
type Rota = (url: string, init?: RequestInit) => Resposta | undefined;

function mockApi(rota: Rota = () => undefined) {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const r = rota(url, init) ?? (init?.method === "PATCH" ? { status: 200, body: conteudo } : init?.method === "DELETE" ? { status: 204 } : { status: 200, body: conteudo });
    return Promise.resolve(new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status }));
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const chamadas = (fn: ReturnType<typeof mockApi>, method: string) => fn.mock.calls.filter(([, init]) => init?.method === method);
const corpoDoPatch = (fn: ReturnType<typeof mockApi>) => JSON.parse(String(chamadas(fn, "PATCH")[0][1]?.body)) as Partial<LandingContent>;
const secoes = () => screen.getByRole("navigation", { name: "Seções do conteúdo institucional" });

async function abrir(rota?: Rota) {
  const fn = mockApi(rota);
  render(<InstitucionalView />);
  await screen.findByLabelText("Título");
  return fn;
}

async function irPara(secao: string) {
  await userEvent.click(within(secoes()).getByRole("button", { name: secao }));
}

beforeEach(() => {
  saveSession({ token: "t", expiresAt: "2999-01-01T00:00:00Z", user: { id: "u-1", name: "Ana", email: "a@example.com", role: "admin" } }, true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe("US04: edição do conteúdo institucional", () => {
  it("CA01: salva a seção inteira com a alteração", async () => {
    const fn = await abrir();
    const titulo = screen.getByLabelText("Título");
    await userEvent.clear(titulo);
    await userEvent.type(titulo, "Novo título");
    await userEvent.click(screen.getByRole("button", { name: "Salvar seção" }));

    expect(await screen.findByText(/A seção “Apresentação” foi salva/)).toBeInTheDocument();
    expect(corpoDoPatch(fn)).toEqual({ hero: { ...conteudo.hero, title: "Novo título" } });
  });

  it("marca a seção alterada e descartar volta ao conteúdo salvo", async () => {
    await abrir();
    await userEvent.type(screen.getByLabelText("Título"), " extra");

    expect(screen.getByText("Não salva")).toBeInTheDocument();
    expect(within(secoes()).getByRole("button", { name: "Apresentação (alterações não salvas)" })).toBeInTheDocument();
    expect(screen.getByText(/Seções alteradas: Apresentação/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Advocacia condominial");
    expect(screen.queryByText("Não salva")).not.toBeInTheDocument();
  });

  it("a alteração de outra seção continua marcada ao trocar de seção", async () => {
    await abrir();
    await userEvent.type(screen.getByLabelText("Título"), " extra");
    await irPara("Visita");
    expect(within(secoes()).getByRole("button", { name: "Apresentação (alterações não salvas)" })).toBeInTheDocument();
    expect(screen.getByText(/Seções alteradas: Apresentação/)).toBeInTheDocument();
  });

  it("com algo não salvo, sair da página pede confirmação", async () => {
    await abrir();
    const antes = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(antes);
    expect(antes.defaultPrevented).toBe(false);

    await userEvent.type(screen.getByLabelText("Título"), " extra");
    const depois = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(depois);
    expect(depois.defaultPrevented).toBe(true);
  });

  it("a nota é escolhida de 1 a 5 e vai como número", async () => {
    const fn = await abrir();
    await irPara("Avaliações");
    const nota = screen.getAllByLabelText("Nota (1 a 5)")[1];
    expect(within(nota).getAllByRole("option").map((o) => o.textContent)).toEqual(["1", "2", "3", "4", "5"]);
    await userEvent.selectOptions(nota, "2");
    await userEvent.click(screen.getByRole("button", { name: "Salvar seção" }));

    await screen.findByText(/foi salva/);
    expect(corpoDoPatch(fn).reviews?.reviews[1].rating).toBe(2);
  });

  it("adiciona e remove itens de uma lista", async () => {
    const fn = await abrir();
    await irPara("Avaliações");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar avaliação" }));
    expect(screen.getByText("Avaliação 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remover avaliação 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar seção" }));

    await screen.findByText(/foi salva/);
    expect(corpoDoPatch(fn).reviews?.reviews.map((r) => r.author)).toEqual(["Bia", ""]);
  });

  it("um campo opcional vazio vai como null", async () => {
    const fn = await abrir();
    await irPara("Contato e redes sociais");
    await userEvent.clear(screen.getByLabelText(/E-mail/));
    await userEvent.click(screen.getByRole("button", { name: "Salvar seção" }));

    await screen.findByText(/foi salva/);
    expect(corpoDoPatch(fn).contact?.email).toBeNull();
  });

  it("o erro de validação diz qual item da lista está errado", async () => {
    await abrir((_url, init) => init?.method === "PATCH" ? {
      status: 422,
      body: { detail: [{ loc: ["body", "reviews", "reviews", 1, "text"], msg: "Value error, O texto não pode ficar vazio.", type: "value_error" }] },
    } : undefined);
    await irPara("Avaliações");
    await userEvent.click(screen.getByRole("button", { name: "Salvar seção" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Avaliações › Avaliação 2 › Texto: O texto não pode ficar vazio.");
  });

  it("outro perfil recebe a mensagem de permissão", async () => {
    await abrir((_url, init) => init?.method === "PATCH" ? { status: 403, body: { detail: "Sem permissão." } } : undefined);
    await userEvent.click(screen.getByRole("button", { name: "Salvar seção" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Seu perfil não tem permissão para editar o conteúdo institucional.");
  });

  it("se o conteúdo não carrega, oferece tentar de novo", async () => {
    let falhar = true;
    mockApi(() => (falhar ? { status: 500, body: { detail: "Erro" } } : undefined));
    render(<InstitucionalView />);
    expect(await screen.findByText("Não foi possível carregar o conteúdo")).toBeInTheDocument();

    falhar = false;
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByLabelText("Título")).toHaveValue("Advocacia condominial");
  });
});

describe("US04: fotos da equipe", () => {
  const uploadNovo: Rota = (url, init) => (init?.method === "POST" && url.endsWith("/landing/images") ? { status: 201, body: { id: "foto-nova" } } : undefined);

  it("recusa um arquivo que não é imagem sem enviar", async () => {
    const fn = await abrir();
    await irPara("Equipe");
    // fireEvent, porque o userEvent respeita o accept e nem entregaria o arquivo.
    fireEvent.change(screen.getByLabelText("Enviar foto do integrante 1"), { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Escolha uma imagem PNG, JPEG ou WebP.");
    expect(chamadas(fn, "POST")).toHaveLength(0);
  });

  it("envia a foto, salva a equipe com ela e não descarta nada", async () => {
    const fn = await abrir(uploadNovo);
    await irPara("Equipe");
    await userEvent.upload(screen.getByLabelText("Enviar foto do integrante 1"), new File(["png"], "f.png", { type: "image/png" }));
    expect(await screen.findByAltText("Foto do integrante 1")).toHaveAttribute("src", expect.stringContaining("/landing/images/foto-nova"));

    await userEvent.click(screen.getByRole("button", { name: "Salvar seção" }));
    await screen.findByText(/foi salva/);
    expect(corpoDoPatch(fn).team?.members[0].photo_id).toBe("foto-nova");
    expect(chamadas(fn, "DELETE")).toHaveLength(0);
  });

  it("descartar as alterações apaga a foto enviada e volta à salva", async () => {
    const fn = await abrir(uploadNovo);
    await irPara("Equipe");
    await userEvent.upload(screen.getByLabelText("Enviar foto do integrante 1"), new File(["png"], "f.png", { type: "image/png" }));
    await screen.findByAltText("Foto do integrante 1");
    await waitFor(() => expect(screen.getByAltText("Foto do integrante 1")).toHaveAttribute("src", expect.stringContaining("foto-nova")));

    await userEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
    await waitFor(() => expect(chamadas(fn, "DELETE").map(([url]) => url)).toEqual([expect.stringContaining("/landing/images/foto-nova")]));
    expect(screen.getByAltText("Foto do integrante 1")).toHaveAttribute("src", expect.stringContaining("foto-salva"));
  });

  it("uma foto enviada e depois removida é apagada ao salvar", async () => {
    const fn = await abrir(uploadNovo);
    await irPara("Equipe");
    await userEvent.upload(screen.getByLabelText("Enviar foto do integrante 1"), new File(["png"], "f.png", { type: "image/png" }));
    await waitFor(() => expect(screen.getByAltText("Foto do integrante 1")).toHaveAttribute("src", expect.stringContaining("foto-nova")));
    await userEvent.click(screen.getByRole("button", { name: "Remover foto" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar seção" }));

    await screen.findByText(/foi salva/);
    expect(corpoDoPatch(fn).team?.members[0].photo_id).toBeNull();
    expect(chamadas(fn, "DELETE").map(([url]) => url)).toEqual([expect.stringContaining("/landing/images/foto-nova")]);
  });
});

describe("mensagens", () => {
  it("descreve o caminho de um campo", () => {
    expect(descreverCaminho(["team", "members", 0, "name"])).toBe("Equipe › Integrante 1 › Nome");
    expect(descreverCaminho(["condominium_advisory", "paragraphs", 2])).toBe("Assessoria condominial › Parágrafo 3");
  });

  it("um erro sem detalhe por campo usa a mensagem da API", () => {
    expect(mensagemErro(new ApiError(500, "Falhou."))).toBe("Falhou.");
    expect(mensagemErro(new Error("x"))).toBe("Não foi possível concluir a operação. Tente novamente.");
  });
});
