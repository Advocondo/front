import { Icon, Logo, PracticeCard, SectionTitle, TeamCard } from "edson-alexandre-design-system";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { apiBaseUrl } from "@/app/lib/api-url";
import { maskTelefone } from "@/app/lib/masks";
import { ContactForm } from "./ContactForm";
import styles from "./landing.module.css";
import { NavMenu } from "./NavMenu";
import type { LandingContent } from "./types";

const SECOES = [
  { href: "#atuacao", label: "Atuação" },
  { href: "#assessoria", label: "Assessoria" },
  { href: "#por-que-nos", label: "Por que nós?" },
  { href: "#contato", label: "Contato" },
];
const NOTA_MAXIMA = 5;

type Contato = LandingContent["contact"];

const whatsappUrl = (whatsapp: string): string => `https://wa.me/55${whatsapp}`;

function Externo({ href, children, ...rest }: ComponentProps<"a">) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

type Estilo = "primario" | "contorno";

function classeBotao(estilo: Estilo): string {
  return `${styles.botao} ${estilo === "primario" ? styles.botaoPrimario : styles.botaoContorno}`;
}

/** Com a aparência do Button do design system, que só renderiza <button>. */
function BotaoSecao({ href, estilo = "contorno", children }: { href: string; estilo?: Estilo; children: ReactNode }) {
  return (
    <a href={href} className={classeBotao(estilo)}>
      {children}
    </a>
  );
}

function BotaoWhatsapp({ whatsapp, children }: { whatsapp: string | null; children: ReactNode }) {
  // Sem número cadastrado, o botão some em vez de levar a lugar nenhum.
  if (!whatsapp) return null;
  return (
    <Externo href={whatsappUrl(whatsapp)} className={classeBotao("contorno")}>
      {children}
      <Icon name="message-circle" size={16} />
    </Externo>
  );
}

function Redes({ contato, tamanho }: { contato: Contato; tamanho: number }) {
  return (
    <>
      {contato.facebook_url && (
        <Externo href={contato.facebook_url} aria-label="Facebook">
          <Icon name="facebook" size={tamanho} />
        </Externo>
      )}
      {contato.whatsapp && (
        <Externo href={whatsappUrl(contato.whatsapp)} aria-label="WhatsApp">
          <Icon name="message-circle" size={tamanho} />
        </Externo>
      )}
      {contato.instagram_url && (
        <Externo href={contato.instagram_url} aria-label="Instagram">
          <Icon name="instagram" size={tamanho} />
        </Externo>
      )}
    </>
  );
}

function Navegacao({ contato }: { contato: Contato }) {
  return (
    <nav className={styles.nav}>
      <div className={`${styles.largura} ${styles.navConteudo}`}>
        <div className={styles.navMarca}>
          <Logo variant="mark" height={30} base="/brand/" />
        </div>
        <div className={styles.navRedes}>
          <Redes contato={contato} tamanho={14} />
        </div>
        <div className={styles.espaco} />
        <div className={styles.navLinks}>
          {SECOES.map((secao) => (
            <a key={secao.href} href={secao.href}>
              {secao.label}
            </a>
          ))}
        </div>
        <Link href="/login" className={styles.navEntrar}>
          <Icon name="log-in" size={14} />
          Entrar
        </Link>
        <NavMenu links={SECOES} />
      </div>
    </nav>
  );
}

function Avaliacoes({ reviews }: { reviews: LandingContent["reviews"] }) {
  // As avaliações só entram quando o Administrador copia as reais do Google (docs/landing.md).
  if (reviews.reviews.length === 0 && !reviews.google_reviews_url) return null;
  return (
    <section className={`${styles.navy} ${styles.semTopo}`}>
      <div className={`${styles.largura} ${styles.pilha}`}>
        {reviews.reviews.length > 0 && (
          <>
            <SectionTitle size="sm">{reviews.title}</SectionTitle>
            <div className={styles.gradeAvaliacoes}>
              {reviews.reviews.map((review) => (
                <article key={`${review.author}-${review.text}`} className={styles.avaliacao}>
                  <header className={styles.avaliacaoTopo}>
                    <span className={styles.avatar}>
                      <Icon name="user" size={15} />
                    </span>
                    <div className={styles.espaco}>
                      <p className={styles.avaliacaoAutor}>{review.author}</p>
                      {review.author_details && <p className={styles.avaliacaoDetalhe}>{review.author_details}</p>}
                    </div>
                    <div className={styles.estrelas} role="img" aria-label={`Nota ${review.rating} de ${NOTA_MAXIMA}`}>
                      {Array.from({ length: NOTA_MAXIMA }, (_, i) => (
                        <Icon key={i} name="star" size={12} fill={i < review.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </header>
                  <p className={styles.avaliacaoTexto}>{review.text}</p>
                </article>
              ))}
            </div>
          </>
        )}
        {reviews.google_reviews_url && (
          <div className={styles.pilhaCurta}>
            <SectionTitle size="sm" sub={reviews.call_to_review_text}>
              {reviews.call_to_review_title}
            </SectionTitle>
            <Externo href={reviews.google_reviews_url} className={classeBotao("contorno")}>
              {reviews.button_label}
            </Externo>
          </div>
        )}
      </div>
    </section>
  );
}

function Rodape({ contato }: { contato: Contato }) {
  const linhas: [string, string | null][] = [
    ["phone", contato.phone && maskTelefone(contato.phone)],
    ["mail", contato.email],
    ["map-pin", contato.address],
    ["clock", contato.opening_hours && `Horários de atendimento: ${contato.opening_hours}`],
  ];
  return (
    <footer className={styles.rodape}>
      <div className={`${styles.largura} ${styles.rodapeConteudo}`}>
        <Logo variant="lockup" height={104} base="/brand/" />
        <div className={styles.contatos}>
          <p className={`ea-eyebrow ${styles.contatosTitulo}`}>Contatos:</p>
          {linhas.map(
            ([icone, texto]) =>
              texto && (
                <p key={icone} className={styles.contatoLinha}>
                  <span className={styles.contatoIcone}>
                    <Icon name={icone} size={15} />
                  </span>
                  {texto}
                </p>
              ),
          )}
        </div>
      </div>
      <div className={styles.rodapeBase}>
        <p>© {new Date().getFullYear()} por Edson Alexandre Advogados.</p>
        <p>Política de privacidade</p>
        <p>Política de cookies</p>
      </div>
    </footer>
  );
}

export function LandingPage({ content }: { content: LandingContent }) {
  const { hero, practice_areas, online_service, condominium_advisory, reviews, why_us, team, contact_form, visit, contact } = content;
  return (
    <div className={styles.pagina}>
      <Navegacao contato={contact} />
      <header className={styles.hero}>
        <div className={`${styles.largura} ${styles.pilha}`}>
          <Logo variant="lockup" height={128} base="/brand/" />
          <div className={styles.heroTexto}>
            <h1 className={styles.heroTitulo}>{hero.title}</h1>
            <p className={styles.texto}>{hero.subtitle}</p>
          </div>
          <div className={styles.acoes}>
            <BotaoWhatsapp whatsapp={contact.whatsapp}>{hero.button_label}</BotaoWhatsapp>
            <Link href="/login" className={classeBotao("contorno")}>
              <Icon name="log-in" size={16} />
              Acessar a plataforma
            </Link>
          </div>
        </div>
      </header>

      <section id="atuacao" className={`${styles.navy} ${styles.semTopo}`}>
        <div className={`${styles.largura} ${styles.pilha}`}>
          <SectionTitle>{practice_areas.title}</SectionTitle>
          <div className={styles.gradeAreas}>
            {practice_areas.areas.map((area) => (
              <PracticeCard key={area.title} title={area.title}>
                {area.description}
              </PracticeCard>
            ))}
          </div>
          <p className={styles.texto}>{practice_areas.closing_text}</p>
        </div>
      </section>

      <section className={styles.faixaClara}>
        <div className={`${styles.largura} ${styles.pilhaCurta}`}>
          <SectionTitle onNavy={false} sentenceCase sub={online_service.text}>
            {online_service.title}
          </SectionTitle>
          <BotaoSecao href="#contato" estilo="primario">
            {online_service.button_label}
          </BotaoSecao>
        </div>
      </section>

      <section id="assessoria" className={styles.navy}>
        <div className={`${styles.largura} ${styles.pilha}`}>
          <SectionTitle>{condominium_advisory.title}</SectionTitle>
          <div className={styles.paragrafos}>
            {condominium_advisory.paragraphs.map((paragrafo) => (
              <p key={paragrafo} className={styles.texto}>
                {paragrafo}
              </p>
            ))}
          </div>
        </div>
      </section>

      <Avaliacoes reviews={reviews} />

      <section id="por-que-nos" className={`${styles.navy} ${styles.semTopo}`}>
        <div className={`${styles.largura} ${styles.pilha}`}>
          <div className={styles.paragrafos}>
            <SectionTitle size="sm">{why_us.title}</SectionTitle>
            {why_us.paragraphs.map((paragrafo) => (
              <p key={paragrafo} className={styles.texto}>
                {paragrafo}
              </p>
            ))}
            <div>
              <BotaoSecao href="#contato">{why_us.button_label}</BotaoSecao>
            </div>
          </div>
          <SectionTitle size="sm">{team.title}</SectionTitle>
          <div className={styles.equipe}>
            {team.members.map((membro) => (
              <TeamCard key={membro.name} name={membro.name} role={membro.role} photo={membro.photo_id ? `${apiBaseUrl()}/landing/images/${membro.photo_id}` : undefined} />
            ))}
          </div>
          {team.highlights.length > 0 && (
            <ul className={styles.destaques}>
              {team.highlights.map((destaque) => (
                <li key={destaque}>
                  <Icon name="check" size={16} />
                  {destaque}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="contato" className={styles.faixaClara}>
        <div className={styles.larguraFormulario}>
          <div className={styles.formularioTopo}>
            <h2>{contact_form.title}</h2>
            <p>{contact_form.subtitle}</p>
          </div>
          <ContactForm />
          <div className={styles.redesFormulario}>
            <Redes contato={contact} tamanho={20} />
          </div>
        </div>
      </section>

      <section className={styles.visita}>
        <div className={`${styles.largura} ${styles.pilhaCurta}`}>
          <SectionTitle size="sm" sub={visit.text}>
            {visit.title}
          </SectionTitle>
          <BotaoWhatsapp whatsapp={contact.whatsapp}>{visit.button_label}</BotaoWhatsapp>
        </div>
      </section>

      <Rodape contato={contact} />
    </div>
  );
}

/** Mostrada quando a API não responde: o site cai, mas o acesso à plataforma continua à vista. */
export function SiteIndisponivel() {
  return (
    <main className={styles.indisponivel}>
      <Logo variant="lockup" height={128} base="/brand/" />
      <p className={styles.texto}>O site está temporariamente indisponível. Tente novamente em alguns minutos.</p>
      <Link href="/login" className={classeBotao("contorno")}>
        Acessar a plataforma
      </Link>
    </main>
  );
}
