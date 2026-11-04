"use client";

import { Alert, Button, Card, DataTable, IconButton, MetricCard, StatusPill, Timeline, Toast, ToastStack } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { centsFromApi, formatBRL } from "@/app/lib/money";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { getAcordo, listAdvogados, listHistoricoDeResponsaveis, listParcelas } from "../api";
import { StatusAcordo } from "../AcordosView";
import type { Acordo, Advogado, AtribuicaoDeAdvogado, Parcela } from "../types";
import { ParcelaDialog } from "./ParcelaDialog";
import { ResponsavelDialog } from "./ResponsavelDialog";

const SITUACAO: Record<Parcela["status"], { label: string; tone: "ok" | "info" | "risk" }> = {
  paid: { label: "Paga", tone: "ok" },
  open: { label: "Em aberto", tone: "info" },
  overdue: { label: "Atrasada", tone: "risk" },
};

/** Parcela paga, com pagamento parcial ou de acordo cancelado não pode ser editada no back. */
const podeEditar = (acordo: Acordo, parcela: Parcela): boolean =>
  acordo.status === "active" && parcela.status !== "paid" && parcela.remaining_amount === parcela.amount;

export function AcordoDetalheView({ id }: { id: string }) {
  const [acordo, setAcordo] = useState<Acordo | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [editando, setEditando] = useState<Parcela | null>(null);
  const [advogados, setAdvogados] = useState<Advogado[]>([]);
  const [historico, setHistorico] = useState<AtribuicaoDeAdvogado[]>([]);
  const [trocandoResponsavel, setTrocandoResponsavel] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

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
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-sans)" }}>{acordo.debtor.name}</h2>
                  <p className="text-sm">{`${acordo.condominium.name} · ${acordo.debtor.unit}`}</p>
                  <p className="mt-1 text-sm">Responsável: {acordo.responsible_lawyer?.name ?? "não atribuído"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* O back não aceita mudar o responsável de acordo cancelado. */}
                  {acordo.status === "active" && (
                    <Button size="sm" variant="secondary" icon="user-check" onClick={() => setTrocandoResponsavel(true)}>
                      {acordo.responsible_lawyer ? "Trocar responsável" : "Atribuir responsável"}
                    </Button>
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
                { key: "parcela", label: "Parcela", mono: true, render: (p: Parcela) => `${p.number}/${parcelas.length}` },
                { key: "vencimento", label: "Vencimento", mono: true, render: (p: Parcela) => formatDate(p.due_date) },
                { key: "valor", label: "Valor", mono: true, align: "right", strong: true, render: (p: Parcela) => formatBRL(p.amount) },
                { key: "condominio", label: "Condomínio", mono: true, align: "right", render: (p: Parcela) => formatBRL(p.condominium_amount) },
                { key: "honorarios", label: "Honorários", mono: true, align: "right", render: (p: Parcela) => formatBRL(p.fee_amount) },
                {
                  key: "situacao",
                  label: "Situação",
                  render: (p: Parcela) => (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <StatusPill label={SITUACAO[p.status].label} tone={SITUACAO[p.status].tone} />
                      {p.payment_date && <span className="text-sm">{`pago em ${formatDate(p.payment_date)}`}</span>}
                    </span>
                  ),
                },
                {
                  key: "acoes",
                  label: "",
                  align: "right",
                  render: (p: Parcela) => podeEditar(acordo, p) && <IconButton icon="pencil" label={`Editar parcela ${p.number}`} onClick={() => setEditando(p)} />,
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
          </>
        )}
      </div>

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
