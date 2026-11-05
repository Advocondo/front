"use client";

import { Alert, Button, Card, EmptyState, MetricCard } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listCondominios } from "@/app/(equipe)/condominios/api";
import { formatDate } from "@/app/(equipe)/condominios/format";
import type { Condominio } from "@/app/(equipe)/condominios/types";
import { getIndicadores, listMetasDaEquipe, type IndicadoresDoMes, type MetaDoColaborador } from "@/app/(equipe)/metas/api";
import { BarraDeAtingimento, formatarPercentual } from "@/app/(equipe)/metas/atingimento";
import { mesAtual, SeletorDeMes } from "@/app/components/SeletorDeMes";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { formatBRL } from "@/app/lib/money";

type Dados = { chave: string; indicadores: IndicadoresDoMes; equipe: MetaDoColaborador[]; atualizadoEm: string };

const NOMES_NO_AVISO = 3;

function AvisoDeRenovacao({ contratos }: { contratos: Condominio[] }) {
  if (contratos.length === 0) return null;
  const nomes = contratos.slice(0, NOMES_NO_AVISO).map((c) => `${c.nome} (${formatDate(c.contrato_renovacao)})`).join(", ");
  const resto = contratos.length - NOMES_NO_AVISO;
  return (
    <Alert tone="warn" title={contratos.length === 1 ? "1 contrato perto da renovação" : `${contratos.length} contratos perto da renovação`} action={<Link href="/condominios" className="text-sm font-medium">Ver condomínios</Link>}>
      {resto > 0 ? `${nomes} e mais ${resto}` : nomes}
    </Alert>
  );
}

function rodapeDaInadimplencia({ overdue_installments: atrasadas, installments_due: total }: IndicadoresDoMes): string {
  if (total === 0) return "Nenhuma parcela vence neste mês";
  return `${atrasadas} de ${total} ${total === 1 ? "parcela" : "parcelas"} do mês em atraso`;
}

/** US34: a saúde da operação no mês escolhido. Cada abertura ou troca de mês busca os dados de novo. */
export function PainelView() {
  const [{ ano, mes }, setPeriodo] = useState(mesAtual);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [perto, setPerto] = useState<Condominio[]>([]);
  const chave = `${ano}-${mes}`;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getIndicadores(ano, mes, controller.signal), listMetasDaEquipe(ano, mes, controller.signal)])
      .then(([indicadores, equipe]) => {
        setDados({ chave, indicadores, equipe, atualizadoEm: new Date().toISOString() });
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Tente novamente em instantes.");
      });
    return () => controller.abort();
  }, [ano, mes, chave, recarregar]);

  // É a situação de hoje, não a do mês escolhido. Uma falha aqui só deixa o Painel sem o aviso.
  useEffect(() => {
    const controller = new AbortController();
    listCondominios("", controller.signal)
      .then((lista) => setPerto(lista.filter((c) => c.proximo_da_renovacao)))
      .catch(() => {});
    return () => controller.abort();
  }, [recarregar]);

  const atuais = dados?.chave === chave ? dados : null;

  return (
    <PlataformaShell
      activeId="painel"
      title="Painel"
      subtitle="Visão do escritório"
      actions={
        <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setRecarregar((n) => n + 1)}>
          Atualizar
        </Button>
      }
    >
      <div className="grid gap-5">
        <SeletorDeMes ano={ano} mes={mes} onChange={setPeriodo} />

        {erro && (
          <Alert tone="risk" title="Não foi possível carregar o painel" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        <AvisoDeRenovacao contratos={perto} />
        {!atuais && !erro && <p role="status">Carregando indicadores…</p>}

        {atuais && !erro && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* O back conta os acordos ativos de hoje: este número não muda com o mês escolhido. */}
              <MetricCard label="Acordos ativos" icon="handshake" value={String(atuais.indicadores.active_agreements)} footnote="Hoje, em todos os condomínios" />
              <MetricCard label="Inadimplência do mês" icon="triangle-alert" value={`${atuais.indicadores.monthly_default_rate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} footnote={rodapeDaInadimplencia(atuais.indicadores)} />
              <MetricCard label="Comissões pagas no período" icon="percent" value={formatBRL(atuais.indicadores.paid_commissions)} footnote="Honorários das parcelas pagas neste mês" />
            </div>

            <Card title="Equipe" action={<Link href="/metas" className="text-sm font-medium">Metas e comissões</Link>}>
              {atuais.equipe.length === 0 ? (
                <EmptyState icon="users" title="Nenhum colaborador ativo" description="Convide membros da Equipe Operacional em Gestão de usuários." />
              ) : (
                <ul className="grid gap-4">
                  {atuais.equipe.map((colaborador) => (
                    <li key={colaborador.user_id} className="grid gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 font-semibold">{colaborador.user_name}</p>
                        {colaborador.attainment_percentage !== null && <strong>{formatarPercentual(colaborador.attainment_percentage)}</strong>}
                      </div>
                      {colaborador.attainment_percentage !== null && <BarraDeAtingimento percentual={colaborador.attainment_percentage} rotulo={`Atingimento de ${colaborador.user_name}`} />}
                      <p className="text-sm">{colaborador.target_amount ? `${formatBRL(colaborador.achieved_amount)} de ${formatBRL(colaborador.target_amount)}` : "Sem meta neste mês"}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <p className="text-sm">{`Atualizado em ${formatDateTime(atuais.atualizadoEm)}.`}</p>
          </>
        )}
      </div>
    </PlataformaShell>
  );
}
