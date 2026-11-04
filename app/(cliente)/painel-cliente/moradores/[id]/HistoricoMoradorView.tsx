"use client";

import { Alert, Button, Card, DataTable, EmptyState, MetricCard, StatusPill } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState } from "react";
import { nomeDoMes } from "@/app/components/SeletorDeMes";
import { ApiError } from "@/app/lib/api";
import { centsFromApi, formatBRL } from "@/app/lib/money";
import { getHistoricoDoMorador, type CompetenciaDoHistorico, type HistoricoDoMorador } from "../../api";
import { ClienteShell } from "../../ClienteShell";

const SITUACAO = {
  pago: { label: "Pago", tone: "ok" },
  em_aberto: { label: "Em aberto", tone: "warn" },
  atrasado: { label: "Atrasado", tone: "risk" },
} as const;

/** "2026-11" -> "Novembro 2026". */
function nomeDaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return nomeDoMes({ ano, mes });
}

const soma = (valores: string[]): bigint => valores.reduce((total, valor) => total + centsFromApi(valor), 0n);

/** US38: total pago e em aberto por competência, para a prestação de contas. Sem honorários (CA01). */
export function HistoricoMoradorView({ id }: { id: string }) {
  const [historico, setHistorico] = useState<HistoricoDoMorador | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getHistoricoDoMorador(id, controller.signal)
      .then((dados) => {
        setHistorico(dados);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        // O back responde igual para morador inexistente e para o de condomínio não vinculado.
        // 422 é um endereço com id malformado, que para quem abriu também não existe.
        if (e instanceof ApiError && (e.status === 404 || e.status === 422)) setNaoEncontrado(true);
        else setErro(e instanceof ApiError ? e.message : "Tente novamente em instantes.");
      });
    return () => controller.abort();
  }, [id, recarregar]);

  return (
    <ClienteShell title="Histórico de pagamentos" subtitle={historico ? `${historico.debtor_name} · Unidade ${historico.debtor_unit}` : undefined}>
      <Link href="/painel-cliente" className="text-sm font-medium">
        ← Voltar ao painel
      </Link>

      {naoEncontrado && (
        <Card>
          <EmptyState icon="search" title="Morador não encontrado" description="Este morador não existe ou não pertence a um condomínio vinculado ao seu acesso." />
        </Card>
      )}
      {erro && (
        <Alert tone="risk" title="Não foi possível carregar o histórico" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
          {erro}
        </Alert>
      )}
      {!historico && !erro && !naoEncontrado && <p role="status">Carregando histórico…</p>}

      {historico && !erro && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard label="Total pago" value={formatBRL(soma(historico.months.map((m) => m.paid_amount)))} />
            <MetricCard label="Total em aberto" value={formatBRL(soma(historico.months.map((m) => m.open_amount)))} />
          </div>
          <Card title="Por competência">
            <div className="overflow-x-auto">
              <DataTable
                rows={historico.months.map((m) => ({ ...m, id: m.month }))}
                empty={<EmptyState icon="calendar-check" title="Nenhuma parcela" description="Este morador ainda não tem parcelas registradas." />}
                columns={[
                  { key: "month", label: "Competência", strong: true, render: (m: CompetenciaDoHistorico) => nomeDaCompetencia(m.month) },
                  { key: "status", label: "Situação", render: (m: CompetenciaDoHistorico) => <StatusPill label={SITUACAO[m.status].label} tone={SITUACAO[m.status].tone} /> },
                  { key: "paid_amount", label: "Pago", align: "right", mono: true, render: (m: CompetenciaDoHistorico) => formatBRL(m.paid_amount) },
                  { key: "open_amount", label: "Em aberto", align: "right", mono: true, render: (m: CompetenciaDoHistorico) => formatBRL(m.open_amount) },
                ]}
              />
            </div>
          </Card>
        </>
      )}
    </ClienteShell>
  );
}
