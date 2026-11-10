import type { Role } from "@/app/lib/session";

export type ItemDeNavegacao = { id: string; label: string; icon: string; href: string; descricao: string; soAdmin?: boolean };

/** Todas as telas do escritório, com o que o menu "Mais" mostra de cada uma. */
export const TELAS: Record<string, ItemDeNavegacao> = {
  painel: { id: "painel", label: "Painel", icon: "layout-dashboard", href: "/painel", descricao: "Indicadores do mês", soAdmin: true },
  acordos: { id: "acordos", label: "Acordos", icon: "handshake", href: "/acordos", descricao: "Acordos com os devedores" },
  acompanhamento: { id: "acompanhamento", label: "Faturas do mês", icon: "calendar-check", href: "/acompanhamento", descricao: "Parcelas do mês e baixas" },
  metas: { id: "metas", label: "Metas e comissões", icon: "target", href: "/metas", descricao: "Metas da equipe e faturamento" },
  condominios: { id: "condominios", label: "Condomínios", icon: "building-2", href: "/condominios", descricao: "Carteira de clientes" },
  devedores: { id: "devedores", label: "Devedores", icon: "users", href: "/devedores", descricao: "Moradores inadimplentes e importação" },
  notificacoes: { id: "notificacoes", label: "Notificações", icon: "bell", href: "/notificacoes", descricao: "Parcelas que ficaram em atraso" },
  usuarios: { id: "usuarios", label: "Gestão de usuários", icon: "users-round", href: "/usuarios", descricao: "Convites, perfis e acessos", soAdmin: true },
  auditoria: { id: "auditoria", label: "Trilha de auditoria", icon: "scroll-text", href: "/auditoria", descricao: "Baixas, estornos e alterações", soAdmin: true },
  institucional: { id: "institucional", label: "Conteúdo institucional", icon: "panels-top-left", href: "/institucional", descricao: "Textos e fotos do site", soAdmin: true },
  perfil: { id: "perfil", label: "Meu perfil", icon: "user", href: "/perfil", descricao: "Nome, e-mail, senha e sessões" },
};

/** O quinto item da navegação inferior, que leva ao resto. */
export const MAIS: ItemDeNavegacao = { id: "mais", label: "Mais", icon: "menu", href: "/mais", descricao: "" };

/**
 * Navegação inferior no celular, como nos protótipos mobile: quatro telas e o "Mais". O Painel é só do
 * Administrador (US34), então o Operador tem Devedores no lugar dele.
 */
export function itensDaBarraInferior(role: Role | undefined): ItemDeNavegacao[] {
  const rotulo = (id: string, label: string) => ({ ...TELAS[id], label });
  const telas = role === "admin" ? [TELAS.painel, TELAS.acordos, rotulo("acompanhamento", "Mês"), TELAS.condominios] : [TELAS.acordos, rotulo("acompanhamento", "Mês"), TELAS.condominios, TELAS.devedores];
  return [...telas, MAIS];
}

/** O que não coube na barra inferior, na ordem da barra lateral. Os itens do Administrador só para ele. */
export function itensDoMais(role: Role | undefined): ItemDeNavegacao[] {
  const naBarra = new Set(itensDaBarraInferior(role).map((i) => i.id));
  return Object.values(TELAS).filter((i) => !naBarra.has(i.id) && (!i.soAdmin || role === "admin"));
}
