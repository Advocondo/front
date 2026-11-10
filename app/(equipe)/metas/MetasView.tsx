"use client";

import { Alert, Button, Card, EmptyState, IconButton, MetricCard, Toast, ToastStack } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { mesAtual, nomeDoMes, SeletorDeMes } from "@/app/components/SeletorDeMes";
import { ApiError } from "@/app/lib/api";
import { centsFromApi, formatBRL } from "@/app/lib/money";
import { useSession } from "@/app/lib/session";
import { getIndicadores, getMinhaMeta, getResumoDoEscritorio, getResumoDoOperador, listMetasDaEquipe, type IndicadoresDoMes, type MetaDoColaborador, type MinhaMeta, type ResumoDoEscritorio } from "./api";
import { BarraDeAtingimento, formatarPercentual } from "./atingimento";
import { MetaDialog } from "./MetaDialog";

const naoEncontrado = (e: unknown): boolean => e instanceof ApiError && e.status === 404;

type Periodo = { ano: number; mes: number; ehMesAtual: boolean };

function ErroDeCarga({ mensagem, onTentar }: { mensagem: string; onTentar: () => void }) {
  return (
    <Alert tone="risk" title="Não foi possível carregar os dados" action={<Button size="sm" variant="secondary" onClick={onTentar}>Tentar novamente</Button>}>
      {mensagem}
    </Alert>
  );
}

/** US32: só os números de quem está logado. */
function VisaoDoColaborador({ ano, mes, ehMesAtual }: Periodo) {
  const [meta, setMeta] = useState<MinhaMeta | null>(null);
  const [comissao, setComissao] = useState<string | null>(null);
  const [carregado, setCarregado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const chave = `${ano}-${mes}`;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      // Mês sem meta responde 404: é um estado normal da tela, não um erro.
      getMinhaMeta(ano, mes, controller.signal).catch((e: unknown) => {
        if (naoEncontrado(e)) return null;
        throw e;
      }),
      ehMesAtual ? getResumoDoOperador(controller.signal) : Promise.resolve(null),
    ])
      .then(([minhaMeta, resumo]) => {
        setMeta(minhaMeta);
        setComissao(resumo?.accumulated_commission ?? null);
        setCarregado(chave);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Tente novamente em instantes.");
      });
    return () => controller.abort();
  }, [ano, mes, ehMesAtual, chave, recarregar]);

  if (erro) return <ErroDeCarga mensagem={erro} onTentar={() => setRecarregar((n) => n + 1)} />;
  if (carregado !== chave) return <p role="status">Carregando metas…</p>;

  const falta = meta ? centsFromApi(meta.target_amount) - centsFromApi(meta.achieved_amount) : 0n;

  return (
    <>
      {meta ? (
        <Card title="Minha meta do mês">
          <div className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="ea-eyebrow">Atingimento</span>
              <strong className="text-2xl">{formatarPercentual(meta.attainment_percentage)}</strong>
            </div>
            <BarraDeAtingimento percentual={meta.attainment_percentage} rotulo="Atingimento da minha meta" />
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <dt>Meta do mês</dt>
              <dd className="text-right font-semibold">{formatBRL(meta.target_amount)}</dd>
              <dt>Honorários recebidos dos acordos que cadastrei</dt>
              <dd className="text-right font-semibold">{formatBRL(meta.achieved_amount)}</dd>
              <dt>{falta > 0n ? "Falta" : "Meta atingida"}</dt>
              <dd className="text-right font-semibold">{falta > 0n ? formatBRL(falta) : "—"}</dd>
            </dl>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState icon="target" title="Sem meta neste mês" description="O Administrador ainda não definiu a sua meta para este mês." />
        </Card>
      )}

      {comissao !== null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard label="Comissão acumulada no mês" value={formatBRL(comissao)} />
          <p className="self-center text-sm">Honorários das parcelas quitadas neste mês, nos acordos em que você é o advogado responsável.</p>
        </div>
      ) : (
        <p className="text-sm">A comissão acumulada só está disponível para o mês atual.</p>
      )}

      <Alert tone="info" title="Você vê só os seus números">
        Faturamento do escritório e comissões de outros colaboradores ficam visíveis apenas para o Administrador.
      </Alert>
    </>
  );
}

/** US36: o Administrador define e acompanha as metas da equipe. */
function VisaoDoEscritorio({ ano, mes, ehMesAtual }: Periodo) {
  const [equipe, setEquipe] = useState<MetaDoColaborador[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresDoMes | null>(null);
  const [resumo, setResumo] = useState<ResumoDoEscritorio | null>(null);
  const [carregado, setCarregado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [dialogo, setDialogo] = useState<{ colaborador?: MetaDoColaborador } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const chave = `${ano}-${mes}`;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([listMetasDaEquipe(ano, mes, controller.signal), getIndicadores(ano, mes, controller.signal), ehMesAtual ? getResumoDoEscritorio(controller.signal) : Promise.resolve(null)])
      .then(([listaEquipe, dadosIndicadores, dadosResumo]) => {
        setEquipe(listaEquipe);
        setIndicadores(dadosIndicadores);
        setResumo(dadosResumo);
        setCarregado(chave);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Tente novamente em instantes.");
      });
    return () => controller.abort();
  }, [ano, mes, ehMesAtual, chave, recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(timer);
  }, [aviso]);

  if (erro) return <ErroDeCarga mensagem={erro} onTentar={() => setRecarregar((n) => n + 1)} />;
  if (carregado !== chave || !indicadores) return <p role="status">Carregando metas…</p>;

  const comissaoDe = (id: string) => resumo?.team_commissions.find((c) => c.user_id === id)?.commission;
  const totalDeComissoes = resumo?.team_commissions.reduce((total, c) => total + centsFromApi(c.commission), 0n);
  // A lista de metas traz só quem está ativo. Sem isto, o total acima não fecharia com o que aparece na tela.
  const foraDasMetas = resumo?.team_commissions.filter((c) => centsFromApi(c.commission) > 0n && !equipe.some((e) => e.user_id === c.user_id)) ?? [];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Faturamento do mês" value={formatBRL(indicadores.paid_commissions)} footnote="Honorários recebidos no mês" />
        <MetricCard label="Comissões da equipe" value={totalDeComissoes === undefined ? "—" : formatBRL(totalDeComissoes)} footnote={totalDeComissoes === undefined ? "Só no mês atual" : "Soma das comissões do mês"} />
        <MetricCard label="Acordos ativos" value={String(indicadores.active_agreements)} />
        <MetricCard label="Inadimplência do mês" value={`${indicadores.monthly_default_rate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} />
      </div>

      <Card
        title="Metas por colaborador"
        action={
          <Button size="sm" variant="secondary" icon="target" disabled={equipe.length === 0} onClick={() => setDialogo({})}>
            Definir meta
          </Button>
        }
      >
        {equipe.length === 0 ? (
          <EmptyState icon="users" title="Nenhum colaborador ativo" description="Convide membros da Equipe Operacional em Gestão de usuários para definir metas." />
        ) : (
          <ul className="grid gap-4">
            {equipe.map((colaborador) => {
              const comissao = comissaoDe(colaborador.user_id);
              return (
                <li key={colaborador.user_id} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{colaborador.user_name}</p>
                      <p className="text-sm">{colaborador.target_amount ? `${formatBRL(colaborador.achieved_amount)} de ${formatBRL(colaborador.target_amount)}` : "Sem meta neste mês"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {colaborador.attainment_percentage !== null && <strong>{formatarPercentual(colaborador.attainment_percentage)}</strong>}
                      <IconButton icon="pencil" label={`Definir a meta de ${colaborador.user_name}`} onClick={() => setDialogo({ colaborador })} />
                    </div>
                  </div>
                  {colaborador.attainment_percentage !== null && <BarraDeAtingimento percentual={colaborador.attainment_percentage} rotulo={`Atingimento de ${colaborador.user_name}`} />}
                  {comissao && (
                    <p className="flex justify-between text-sm">
                      <span>Comissão no mês</span>
                      <strong>{formatBRL(comissao)}</strong>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {foraDasMetas.length > 0 && (
        <Card title="Outras comissões do mês">
          <ul className="grid gap-2 text-sm">
            {foraDasMetas.map((c) => (
              <li key={c.user_id} className="flex justify-between gap-4">
                <span>{c.user_name}</span>
                <strong>{formatBRL(c.commission)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!ehMesAtual && <p className="text-sm">As comissões por colaborador só estão disponíveis para o mês atual.</p>}

      {dialogo && (
        <MetaDialog
          colaboradores={equipe}
          colaboradorInicial={dialogo.colaborador}
          ano={ano}
          mes={mes}
          nomeDoMes={nomeDoMes({ ano, mes })}
          onClose={() => setDialogo(null)}
          onSaved={(nome) => {
            setDialogo(null);
            setAviso(`Meta de ${nome} salva com sucesso.`);
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {aviso && (
        <ToastStack style={{ bottom: "var(--aviso-bottom, var(--space-6))" }}>
          <Toast tone="ok" title={aviso} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </>
  );
}

export function MetasView() {
  const session = useSession();
  const [{ ano, mes }, setPeriodo] = useState(mesAtual);
  const atual = mesAtual();
  const ehMesAtual = ano === atual.ano && mes === atual.mes;
  const administrador = session?.user.role === "admin";

  return (
    <PlataformaShell activeId="metas" title="Metas e comissões" subtitle={administrador ? "Visão do escritório" : session?.user.name}>
      <div className="grid gap-5">
        <SeletorDeMes ano={ano} mes={mes} onChange={setPeriodo} />
        {administrador ? <VisaoDoEscritorio ano={ano} mes={mes} ehMesAtual={ehMesAtual} /> : <VisaoDoColaborador ano={ano} mes={mes} ehMesAtual={ehMesAtual} />}
      </div>
    </PlataformaShell>
  );
}
