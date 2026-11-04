import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getLanding } from "./content";
import { ContactForm } from "./ContactForm";
import { LandingPage, SiteIndisponivel } from "./LandingPage";
import type { LandingContent } from "./types";

// Mesmos campos de LandingContent no back, com o conteúdo inicial: sem avaliações, sem
// WhatsApp, sem redes sociais e sem fotos.
const inicial: LandingContent = {
  hero: { title: "Seu direito é a nossa luta!", subtitle: "Há mais de 14 anos.", button_label: "Fale conosco no WhatsApp" },
  practice_areas: { title: "Problemas de:", areas: [{ title: "Direito Condominial", description: "Especialistas." }], closing_text: "Chegou a hora." },
  online_service: { title: "Atendemos online.", text: "Para todo o Brasil.", button_label: "Quero ser atendido" },
  condominium_advisory: { title: "Assessoria", paragraphs: ["Um condomínio bem assessorado."] },
  reviews: { title: "Clientes", reviews: [], call_to_review_title: "Nos avalie", call_to_review_text: "É importante.", button_label: "Avaliar", google_reviews_url: null },
  why_us: { title: "Ainda tem dúvidas?", paragraphs: ["Atendimento personalizado."], button_label: "Falar com especialista" },
  team: { title: "Equipe", members: [{ name: "Dr. Edson", role: "Sócio", photo_id: null }], highlights: ["Profissionalismo."] },
  contact_form: { title: "Preencha o formulário", subtitle: "Entraremos em contato." },
  visit: { title: "Venha nos visitar", text: "Um café.", button_label: "Visita pelo WhatsApp" },
  contact: { phone: "6130218539", whatsapp: null, email: "contato@example.com", address: "Águas Claras/DF", opening_hours: "09h às 17h", facebook_url: null, instagram_url: null },
};

const completo: LandingContent = {
  ...inicial,
  reviews: {
    ...inicial.reviews,
    reviews: [{ author: "Ana", author_details: "Local Guide", rating: 4, text: "Recomendo." }],
    google_reviews_url: "https://g.page/escritorio",
  },
  team: { ...inicial.team, members: [{ name: "Dr. Edson", role: "Sócio", photo_id: "abc" }] },
  contact: { ...inicial.contact, whatsapp: "61912345678", facebook_url: "https://facebook.com/esc", instagram_url: "https://instagram.com/esc" },
};

describe("LandingPage", () => {
  it("US01-CA01: mostra a identidade visual e o conteúdo vindo da API", () => {
    render(<LandingPage content={inicial} />);
    expect(screen.getByRole("heading", { level: 1, name: "Seu direito é a nossa luta!" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /Edson Alexandre|logo/i }).length).toBeGreaterThan(0);
    expect(screen.getByText("Direito Condominial")).toBeInTheDocument();
    expect(screen.getByText("Dr. Edson")).toBeInTheDocument();
    expect(screen.getByText("(61) 3021-8539")).toBeInTheDocument();
  });

  it("US01-CA03: tem pontos de entrada para o login", () => {
    render(<LandingPage content={inicial} />);
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Acessar a plataforma" })).toHaveAttribute("href", "/login");
  });

  it("não mostra o que ainda não foi cadastrado", () => {
    render(<LandingPage content={inicial} />);
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Facebook" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Avaliar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Clientes")).not.toBeInTheDocument();
  });

  it("monta os links de WhatsApp, redes sociais, avaliação e a foto quando existem", () => {
    render(<LandingPage content={completo} />);
    const whatsapp = screen.getByRole("link", { name: "Fale conosco no WhatsApp" });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/5561912345678");
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Avaliar" })).toHaveAttribute("href", "https://g.page/escritorio");
    expect(screen.getAllByRole("link", { name: "Instagram" })[0]).toHaveAttribute("href", "https://instagram.com/esc");
    expect(screen.getByAltText("Dr. Edson")).toHaveAttribute("src", expect.stringMatching(/\/landing\/images\/abc$/));
    expect(screen.getByText("Recomendo.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Nota 4 de 5" })).toBeInTheDocument();
  });

  it("os botões das seções levam ao formulário, que está na âncora de contato", () => {
    const { container } = render(<LandingPage content={inicial} />);
    expect(screen.getByRole("link", { name: "Quero ser atendido" })).toHaveAttribute("href", "#contato");
    expect(container.querySelector("#contato form")).not.toBeNull();
  });

  it("o menu do celular abre e fecha ao escolher uma seção", async () => {
    render(<LandingPage content={inicial} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const links = screen.getAllByRole("link", { name: "Assessoria" });
    await user.click(links[links.length - 1]);
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
  });

  it("sem a API, ainda mostra o acesso à plataforma", () => {
    render(<SiteIndisponivel />);
    expect(screen.getByRole("link", { name: "Acessar a plataforma" })).toHaveAttribute("href", "/login");
  });
});

describe("getLanding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("busca sempre o conteúdo atual", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(inicial), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getLanding()).resolves.toEqual(inicial);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/landing$/);
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });

  it.each([
    ["erro do servidor", () => Promise.resolve(new Response("", { status: 500 }))],
    ["falha de rede", () => Promise.reject(new TypeError("fetch failed"))],
  ])("devolve null em %s", async (_, resposta) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockImplementation(resposta));
    await expect(getLanding()).resolves.toBeNull();
  });
});

describe("ContactForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function responder(status: number, body?: unknown) {
    const fn = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  async function preencher(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/Nome e Sobrenome/), "Ana Souza");
    await user.type(screen.getByLabelText(/Telefone/), "61912345678");
    await user.type(screen.getByLabelText(/E-mail/), "ana@example.com");
  }

  const enviar = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Enviar" }));

  it("envia exatamente os campos que o back aceita e confirma o envio", async () => {
    const fetchMock = responder(204);
    const user = userEvent.setup();
    render(<ContactForm />);
    await preencher(user);
    expect(screen.getByLabelText(/Telefone/)).toHaveValue("(61) 91234-5678");
    await user.type(screen.getByLabelText("Mensagem"), "Preciso de ajuda.");
    await enviar(user);

    expect(await screen.findByRole("status")).toHaveTextContent("Recebemos a sua mensagem");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/landing\/contact$/);
    expect(JSON.parse(init.body)).toEqual({
      name: "Ana Souza",
      phone: "61912345678",
      email: "ana@example.com",
      message: "Preciso de ajuda.",
      website: "",
      captcha_token: "",
    });
    expect(screen.getByLabelText(/Nome e Sobrenome/)).toHaveValue("");
  });

  it("mensagem vazia vai como null", async () => {
    const fetchMock = responder(204);
    const user = userEvent.setup();
    render(<ContactForm />);
    await preencher(user);
    await enviar(user);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).message).toBeNull();
  });

  it("não envia com campos obrigatórios errados", async () => {
    const fetchMock = responder(204);
    const user = userEvent.setup();
    render(<ContactForm />);
    await enviar(user);
    expect(await screen.findByText("Informe o seu nome.")).toBeInTheDocument();
    expect(screen.getByText("Telefone com DDD, 10 ou 11 dígitos.")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("o campo armadilha vai junto quando um robô o preenche", async () => {
    const fetchMock = responder(204);
    const user = userEvent.setup();
    const { container } = render(<ContactForm />);
    await preencher(user);
    await user.type(container.querySelector<HTMLInputElement>("#contato-website")!, "spam");
    await enviar(user);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).website).toBe("spam");
  });

  it("o campo armadilha fica escondido de leitores de tela e do teclado", () => {
    const { container } = render(<ContactForm />);
    const campo = container.querySelector("#contato-website")!;
    expect(campo).toHaveAttribute("tabindex", "-1");
    expect(campo.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("mostra o aviso sobre o uso dos dados perto do botão", () => {
    render(<ContactForm />);
    expect(screen.getByText(/usados exclusivamente/)).toBeInTheDocument();
  });

  it("avisa quando a mensagem não saiu e mantém o que foi digitado", async () => {
    responder(503, { detail: "Não foi possível enviar sua mensagem." });
    const user = userEvent.setup();
    render(<ContactForm />);
    await preencher(user);
    await enviar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar sua mensagem.");
    expect(screen.getByLabelText(/Nome e Sobrenome/)).toHaveValue("Ana Souza");
  });

  it("mostra no campo os erros de validação do servidor", async () => {
    responder(422, { detail: [{ loc: ["body", "email"], msg: "value is not a valid email address" }] });
    const user = userEvent.setup();
    render(<ContactForm />);
    await preencher(user);
    await enviar(user);
    expect(await screen.findByText("Valor inválido.")).toBeInTheDocument();
  });

  it("com captcha configurado, não envia antes de haver um token", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "chave-publica");
    const fetchMock = responder(204);
    const user = userEvent.setup();
    render(<ContactForm />);
    await preencher(user);
    await enviar(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("verificação de segurança");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
