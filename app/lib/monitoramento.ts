/**
 * Regras do que pode sair para o Sentry. Ficam aqui, sem depender do SDK, para os testes conferirem.
 *
 * Endereços deste sistema carregam segredos e dados pessoais: `/redefinir-senha?token=...`,
 * `/convite?token=...` e buscas como `/debtors?search=Maria`. Por isso o SDK nunca recebe a parte
 * depois do `?`, em nenhum campo.
 */

type Trilha = { category?: string; message?: string; data?: Record<string, unknown> };

type Evento = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown; data?: unknown };
  breadcrumbs?: Trilha[];
  exception?: { values?: { value?: string; stacktrace?: { frames?: { abs_path?: string; filename?: string }[] } }[] };
  message?: string;
  transaction?: string;
};

/** "https://site/convite?token=abc#x" -> "https://site/convite". */
export function semConsulta(endereco: string): string {
  return endereco.replace(/[?#].*$/, "");
}

/** Dentro de um texto solto, como a mensagem de um erro que cita um endereço. */
function semConsultaNoTexto(texto: string): string {
  return texto.replace(/(https?:\/\/[^\s?#"']+|\/[\w./-]+)[?#][^\s"']*/g, "$1");
}

/** O texto de um clique ou o console podem trazer nome de devedor: essas trilhas não saem. */
const CATEGORIAS_FORA = new Set(["console", "ui.click", "ui.input"]);

export function limparTrilha<T extends Trilha>(trilha: T): T | null {
  if (trilha.category && CATEGORIAS_FORA.has(trilha.category)) return null;
  if (trilha.message) trilha.message = semConsultaNoTexto(trilha.message);
  const dados = trilha.data;
  if (dados) {
    for (const campo of ["url", "from", "to"]) {
      if (typeof dados[campo] === "string") dados[campo] = semConsulta(dados[campo]);
    }
    delete dados["http.query"];
    delete dados["http.fragment"];
  }
  return trilha;
}

export function limparEvento<T extends Evento>(evento: T): T {
  if (evento.request) {
    if (evento.request.url) evento.request.url = semConsulta(evento.request.url);
    delete evento.request.query_string;
    delete evento.request.cookies;
    delete evento.request.headers;
    delete evento.request.data;
  }
  if (evento.message) evento.message = semConsultaNoTexto(evento.message);
  if (evento.transaction) evento.transaction = semConsulta(evento.transaction);
  for (const excecao of evento.exception?.values ?? []) {
    if (excecao.value) excecao.value = semConsultaNoTexto(excecao.value);
    for (const quadro of excecao.stacktrace?.frames ?? []) {
      if (quadro.abs_path) quadro.abs_path = semConsulta(quadro.abs_path);
      if (quadro.filename) quadro.filename = semConsulta(quadro.filename);
    }
  }
  if (evento.breadcrumbs) evento.breadcrumbs = evento.breadcrumbs.map((t) => limparTrilha(t)).filter((t) => t !== null);
  return evento;
}

/** Vale para o navegador e para o servidor. Sem DSN, o Sentry fica desligado, como no back. */
export const opcoesDoSentry = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  environment: process.env.NEXT_PUBLIC_AMBIENTE,
  release: process.env.NEXT_PUBLIC_VERSAO,
  // Sem IP, cookies nem cabeçalhos. Sem rastreamento de desempenho nem gravação de sessão.
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: limparEvento,
  beforeBreadcrumb: limparTrilha,
};
