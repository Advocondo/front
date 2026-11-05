"use client";

import { Alert, Button, Card, EmptyState, Icon } from "edson-alexandre-design-system";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { centsFromApi, formatBRL } from "@/app/lib/money";
import { listNotificacoes, marcarComoLida, marcarTodasComoLidas, TAMANHO_DA_PAGINA, type Notificacao } from "./api";

/** "Rosângela · 101 · 5/6 · venceu em 01/03/2026 · falta R$ 1.237,50". A notificação fica na lista depois da baixa, então o saldo pode ter zerado. */
function descricao({ installment: p }: Notificacao): string {
  const saldo = centsFromApi(p.remaining_amount) > 0n ? `falta ${formatBRL(p.remaining_amount)}` : "já quitada";
  return `${p.debtor.name} · ${p.debtor.unit} · ${p.number}/${p.installment_count} · venceu em ${formatDate(p.due_date)} · ${saldo}`;
}

/** US30: a central de notificações. Clicar leva direto à fatura (CA02). */
export function NotificacoesView() {
  const router = useRouter();
  const [notificacoes, setNotificacoes] = useState<Notificacao[] | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);
  const [haMais, setHaMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [marcando, setMarcando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listNotificacoes(0, controller.signal)
      .then((pagina) => {
        setNotificacoes(pagina.notifications);
        setNaoLidas(pagina.unread_count);
        setHaMais(pagina.notifications.length === TAMANHO_DA_PAGINA);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar as notificações.");
      });
    return () => controller.abort();
  }, [recarregar]);

  async function abrir(notificacao: Notificacao) {
    // Ir à fatura importa mais que a marcação: se ela falhar, a notificação só continua não lida.
    if (!notificacao.read_at) await marcarComoLida(notificacao.id).catch(() => {});
    router.push(`/faturas/${notificacao.installment.id}`);
  }

  async function marcarTodas() {
    setMarcando(true);
    setErroDaAcao(null);
    try {
      await marcarTodasComoLidas();
      setRecarregar((n) => n + 1);
    } catch (e) {
      setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível marcar como lidas. Tente novamente.");
    } finally {
      setMarcando(false);
    }
  }

  async function carregarMais() {
    setCarregandoMais(true);
    setErroDaAcao(null);
    try {
      const pagina = await listNotificacoes(notificacoes?.length ?? 0);
      // Uma notificação nova desloca a página: a mesma pode vir de novo.
      setNotificacoes((atuais) => {
        const ids = new Set(atuais?.map((n) => n.id));
        return [...(atuais ?? []), ...pagina.notifications.filter((n) => !ids.has(n.id))];
      });
      setNaoLidas(pagina.unread_count);
      setHaMais(pagina.notifications.length === TAMANHO_DA_PAGINA);
    } catch (e) {
      setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível carregar mais notificações.");
    } finally {
      setCarregandoMais(false);
    }
  }

  return (
    <PlataformaShell activeId="notificacoes" title="Notificações" subtitle={naoLidas === 1 ? "1 não lida" : `${naoLidas} não lidas`} naoLidas={notificacoes ? naoLidas : undefined}>
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        {erro && (
          <Alert tone="risk" title="Não foi possível carregar as notificações" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        {erroDaAcao && (
          <Alert tone="risk" role="alert">
            {erroDaAcao}
          </Alert>
        )}
        {!notificacoes && !erro && <p role="status">Carregando notificações…</p>}

        {notificacoes?.length === 0 && (
          <Card>
            <EmptyState icon="bell" title="Nenhuma notificação" description="Você será avisado aqui quando uma parcela dos seus acordos ficar em atraso." />
          </Card>
        )}

        {notificacoes && notificacoes.length > 0 && (
          <>
            {naoLidas > 0 && (
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" icon="check-check" loading={marcando} onClick={() => void marcarTodas()}>
                  Marcar todas como lidas
                </Button>
              </div>
            )}
            <ul className="grid gap-2">
              {notificacoes.map((notificacao) => (
                <li key={notificacao.id}>
                  <button type="button" className="flex w-full cursor-pointer items-start gap-3 rounded border p-4 text-left" style={{ background: notificacao.read_at ? "var(--surface-card)" : "var(--navy-50, #eef2f8)", borderColor: "var(--border-subtle)" }} onClick={() => void abrir(notificacao)}>
                    <Icon name="triangle-alert" size={18} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        Parcela em atraso
                        {!notificacao.read_at && <span className="sr-only"> (não lida)</span>}
                      </span>
                      <span className="block text-sm">{descricao(notificacao)}</span>
                      <span className="block text-sm">{`Avisada em ${formatDateTime(notificacao.created_at)}`}</span>
                    </span>
                    <Icon name="chevron-right" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            {haMais && (
              <Button variant="secondary" loading={carregandoMais} onClick={() => void carregarMais()}>
                Carregar mais
              </Button>
            )}
          </>
        )}
      </div>
    </PlataformaShell>
  );
}
