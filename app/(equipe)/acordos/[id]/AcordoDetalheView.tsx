"use client";

import { Alert, Button, Card, DataTable, IconButton, MetricCard, StatusPill, Timeline, Toast, ToastStack } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { centsFromApi, formatBRL } from "@/app/lib/money";
import { useSession } from "@/app/lib/session";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { BaixaDialog } from "@/app/(equipe)/acompanhamento/BaixaDialog";
import { PagamentosDialog } from "@/app/(equipe)/acompanhamento/PagamentosDialog";
import { SituacaoParcela, temPagamentoParcial } from "@/app/(equipe)/acompanhamento/situacao";
import { getAcordo, listAdvogados, listHistoricoDeResponsaveis, listParcelas, reativarAcordo } from "../api";
import { StatusAcordo } from "../AcordosView";
import type { Acordo, Advogado, AtribuicaoDeAdvogado, Parcela } from "../types";
import { CancelarAcordoDialog } from "./CancelarAcordoDialog";
import { EditarAcordoDialog } from "./EditarAcordoDialog";
import { HistoricoFinanceiro } from "./HistoricoFinanceiro";
import { ParcelaDialog } from "./ParcelaDialog";
import { ResponsavelDialog } from "./ResponsavelDialog";

/** Parcela paga, com pagamento parcial ou de acordo cancelado não pode ser editada no back. */
const podeEditar = (acordo: Acordo, parcela: Parcela): boolean =>
  acordo.status === "active" && parcela.status !== "paid" && parcela.remaining_amount === parcela.amount;

export function AcordoDetalheView({ id }: { id: string }) {
  const session = useSession();
  const [acordo, setAcordo] = useState<Acordo | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [editando, setEditando] = useState<Parcela | null>(null);
  const [advogados, setAdvogados] = useState<Advogado[]>([]);
  const [historico, setHistorico] = useState<AtribuicaoDeAdvogado[]>([]);
  const [trocandoResponsavel, setTrocandoResponsavel] = useState(false);
  const [baixa, setBaixa] = useState<Parcela | null>(null);
  const [pagamentos, setPagamentos] = useState<Parcela | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editandoAcordo, setEditandoAcordo] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [reativando, setReativando] = useState(false);
  const [erroAoReativar, setErroAoReativar] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getAcordo(id, controller.signal), listParcelas(id, controller.signal), listAdvogados(controller.signal), listHistoricoDeResponsaveis(id, controller.signal)])
      .then(([dadosDoAcordo, plano, listaDeAdvogados, atribuicoes]) => {
        setAcordo(dadosDoAcordo);
        setParcelas(plano);
        setAdvogados(listaDeAdvogados);
        setHistorico(atribuicoes);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o acordo.");
      });
    return () => controller.abort();
  }, [id, recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const pagas = parcelas.filter((p) => p.status === "paid").length;
  const porcentagemPaga = parcelas.length > 0 ? Math.round((pagas / parcelas.length) * 100) : 0;

  async function reativar() {
    setReativando(true);
    setErroAoReativar(null);
    try {
      await reativarAcordo(id);
      setAviso("Acordo reativado com sucesso.");
      setRecarregar((n) => n + 1);
    } catch (e) {
      setErroAoReativar(e instanceof ApiError ? e.message : "Não foi possível reativar o acordo. Tente novamente.");
    } finally {
      setReativando(false);
    }
  }

  return (
    <PlataformaShell
      activeId="acordos"
      title="Detalhes do acordo"
      subtitle={acordo ? `${acordo.condominium.name} · ${acordo.debtor.unit}` : undefined}
      actions={
        <Link href="/acordos" className="text-sm font-medium">
          Voltar para Acordos
        </Link>
      }
    >
      <div className="grid gap-5">
        {erro && (
          <Alert tone="risk" title="Não foi possível carregar o acordo" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}

        {!acordo && !erro && <p role="status">Carregando acordo…</p>}

        {acordo && (
          <>
            {erroAoReativar && (
              <Alert tone="risk" role="alert" title="Não foi possível reativar">
                {erroAoReativar}
              </Alert>
            )}
            {acordo.status === "cancelled" && (
              <Alert
                tone="warn"
                title={acordo.cancelled_at ? `Acordo cancelado em ${formatDateTime(acordo.cancelled_at)}` : "Acordo cancelado"}
                action={
                  <Button size="sm" variant="secondary" loading={reativando} onClick={() => void reativar()}>
                    Reativar acordo
                  </Button>
                }
              >
                {acordo.cancellation_reason ?? "Sem motivo registrado."}
              </Alert>
            )}
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-sans)" }}>{acordo.debtor.name}</h2>
                  <p className="text-sm">{`${acordo.condominium.name} · ${acordo.debtor.unit}`}</p>
                  <p className="mt-1 text-sm">Responsável: {acordo.responsible_lawyer?.name ?? "não atribuído"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* O back não aceita editar, trocar o responsável nem cancelar de novo um acordo cancelado. */}
                  {acordo.status === "active" && (
                    <>
                      <Button size="sm" variant="secondary" icon="user-check" onClick={() => setTrocandoResponsavel(true)}>
                        {acordo.responsible_lawyer ? "Trocar responsável" : "Atribuir responsável"}
                      </Button>
                      <Button size="sm" variant="secondary" icon="pencil" onClick={() => setEditandoAcordo(true)}>
                        Editar acordo
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setCancelando(true)}>
                        Cancelar acordo
                      </Button>
                    </>
                  )}
                  <StatusAcordo status={acordo.status} />
                </div>
              </div>
              <p className="mt-4 text-sm font-medium">
                {pagas} de {parcelas.length} parcelas pagas ({porcentagemPaga}%)
              </p>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Dívida original" value={formatBRL(acordo.total_amount)} />
              <MetricCard label={acordo.fee_percentage ? `Honorários (${acordo.fee_percentage.replace(/\.00$/, "").replace(".", ",")}%)` : "Honorários"} value={formatBRL(acordo.fee_amount)} />
              <MetricCard label="Repasse ao condomínio" value={formatBRL(centsFromApi(acordo.total_amount) - centsFromApi(acordo.fee_amount))} />
            </div>

            <DataTable
              rows={parcelas}
              columns={[
                { key: "parcela", label: "Parcela", mono: true, render: (p: Parcela) => <Link href={`/faturas/${p.id}`}>{`${p.number}/${parcelas.length}`}</Link> },
                { key: "vencimento", label: "Vencimento", mono: true, render: (p: Parcela) => formatDate(p.due_date) },
                { key: "valor", label: "Valor", mono: true, align: "right", strong: true, render: (p: Parcela) => formatBRL(p.amount) },
                { key: "condominio", label: "Condomínio", mono: true, align: "right", render: (p: Parcela) => formatBRL(p.condominium_amount) },
                { key: "honorarios", label: "Honorários", mono: true, align: "right", render: (p: Parcela) => formatBRL(p.fee_amount) },
                {
                  key: "situacao",
                  label: "Situação",
                  render: (p: Parcela) => (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {/* A parcela sem pagamento de acordo cancelado sai da cobrança (US20), mesmo se a data já passou. */}
                      {acordo.status === "cancelled" && p.status !== "paid" ? <StatusPill label="Fora da cobrança" tone="neutral" /> : <SituacaoParcela parcela={p} />}
                      {p.payment_date && <span className="text-sm">{`pago em ${formatDate(p.payment_date)}`}</span>}
                      {temPagamentoParcial(p) && <span className="text-sm">{`saldo ${formatBRL(p.remaining_amount)}`}</span>}
                    </span>
                  ),
                },
                {
                  key: "acoes",
                  label: "",
                  align: "right",
                  render: (p: Parcela) => (
                    <span className="inline-flex items-center justify-end gap-1">
                      {(p.status === "paid" || temPagamentoParcial(p)) && <Button size="sm" variant="ghost" aria-label={`Pagamentos da parcela ${p.number} de ${acordo.debtor.name}`} onClick={() => setPagamentos(p)}>Pagamentos</Button>}
                      {acordo.status === "active" && p.status !== "paid" && <Button size="sm" variant="secondary" icon="banknote" aria-label={`Dar baixa na parcela ${p.number} de ${acordo.debtor.name}`} onClick={() => setBaixa(p)}>Dar baixa</Button>}
                      {podeEditar(acordo, p) && <IconButton icon="pencil" label={`Editar parcela ${p.number}`} onClick={() => setEditando(p)} />}
                    </span>
                  ),
                },
              ]}
            />

            <Card title="Histórico de responsáveis">
              {historico.length === 0 ? (
                <p className="text-sm">Nenhuma atribuição ainda.</p>
              ) : (
                <Timeline
                  items={[...historico].reverse().map((atribuicao) => ({
                    title: atribuicao.previous_lawyer ? `De ${atribuicao.previous_lawyer.name} para ${atribuicao.new_lawyer.name}` : `Atribuído a ${atribuicao.new_lawyer.name}`,
                    date: formatDateTime(atribuicao.assigned_at),
                    meta: `por ${atribuicao.assigned_by.name}`,
                    icon: "user-check",
                  }))}
                />
              )}
            </Card>

            {session?.user.role === "admin" && <HistoricoFinanceiro acordoId={id} versao={recarregar} />}
          </>
        )}
      </div>

      {baixa && acordo && (
        <BaixaDialog
          parcela={baixa}
          descricao={acordo.debtor.name}
          onClose={() => setBaixa(null)}
          onSaved={(atualizada) => {
            setBaixa(null);
            setAviso(atualizada.status === "paid" ? "Baixa registrada com sucesso." : "Pagamento parcial registrado com sucesso.");
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {pagamentos && acordo && (
        <PagamentosDialog
          parcela={pagamentos}
          descricao={acordo.debtor.name}
          onClose={() => setPagamentos(null)}
          onChanged={(_, texto) => {
            setPagamentos(null);
            setAviso(texto);
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {trocandoResponsavel && acordo && (
        <ResponsavelDialog
          acordo={acordo}
          advogados={advogados}
          onClose={() => setTrocandoResponsavel(false)}
          onSaved={(atualizado) => {
            setAcordo(atualizado);
            setTrocandoResponsavel(false);
            setAviso("Responsável atualizado com sucesso.");
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {editandoAcordo && acordo && (
        <EditarAcordoDialog
          acordo={acordo}
          parcelasPagas={pagas}
          onClose={() => setEditandoAcordo(false)}
          onSaved={() => {
            setEditandoAcordo(false);
            setAviso("Acordo atualizado com sucesso.");
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {cancelando && acordo && (
        <CancelarAcordoDialog
          acordo={acordo}
          parcelas={parcelas}
          onClose={() => setCancelando(false)}
          onSaved={() => {
            setCancelando(false);
            setAviso("Acordo cancelado com sucesso.");
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {editando && (
        <ParcelaDialog
          parcela={editando}
          totalDeParcelas={parcelas.length}
          onClose={() => setEditando(null)}
          onSaved={(plano) => {
            setParcelas(plano);
            setEditando(null);
            setAviso("Parcela atualizada com sucesso.");
          }}
        />
      )}

      {aviso && (
        <ToastStack>
          <Toast tone="ok" title={aviso} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </PlataformaShell>
  );
}
