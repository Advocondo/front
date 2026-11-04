"use client";

import { Alert, Button, DataTable, EmptyState, MetricCard, Select, Tabs, Toast, ToastStack } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { mesAtual, SeletorDeMes } from "@/app/components/SeletorDeMes";
import { ApiError } from "@/app/lib/api";
import { centsFromApi, formatBRL } from "@/app/lib/money";
import { listAdvogados } from "@/app/(equipe)/acordos/api";
import type { Advogado } from "@/app/(equipe)/acordos/types";
import { listCondominios } from "@/app/(equipe)/condominios/api";
import { formatDate } from "@/app/(equipe)/condominios/format";
import type { Condominio } from "@/app/(equipe)/condominios/types";
import { listParcelasDoMes, type ParcelaDoMes } from "./api";
import { BaixaDialog } from "./BaixaDialog";
import { PagamentosDialog } from "./PagamentosDialog";
import { SituacaoParcela, temPagamentoParcial } from "./situacao";

type Aba = "todas" | "open" | "overdue" | "paid";



const soma = (valores: bigint[]): bigint => valores.reduce((total, valor) => total + valor, 0n);
const descricaoDe = (p: ParcelaDoMes): string => `${p.debtor.name} · ${p.condominium.name} · ${p.debtor.unit}`;

export function AcompanhamentoView() {
  const [{ ano, mes }, setPeriodo] = useState(mesAtual);
  const [condominioId, setCondominioId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [aba, setAba] = useState<Aba>("todas");
  const [parcelas, setParcelas] = useState<ParcelaDoMes[] | null>(null);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [advogados, setAdvogados] = useState<Advogado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [baixa, setBaixa] = useState<ParcelaDoMes | null>(null);
  const [pagamentos, setPagamentos] = useState<ParcelaDoMes | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([listCondominios("", controller.signal), listAdvogados(controller.signal)])
      .then(([listaCondominios, listaAdvogados]) => {
        setCondominios(listaCondominios);
        setAdvogados(listaAdvogados);
      })
      .catch(() => {
        // A lista do mês funciona sem os filtros; se ela também falhar, o erro aparece lá.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    listParcelasDoMes({ ano, mes, condominioId, responsavelId }, controller.signal)
      .then((lista) => {
        setParcelas(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar as faturas.");
      });
    return () => controller.abort();
  }, [ano, mes, condominioId, responsavelId, recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const totais = useMemo(() => {
    const lista = parcelas ?? [];
    const saldoDe = (status: ParcelaDoMes["status"]) => soma(lista.filter((p) => p.status === status).map((p) => centsFromApi(p.remaining_amount)));
    return {
      previsto: soma(lista.map((p) => centsFromApi(p.amount))),
      recebido: soma(lista.map((p) => centsFromApi(p.amount) - centsFromApi(p.remaining_amount))),
      emAberto: saldoDe("open"),
      atrasado: saldoDe("overdue"),
      contagem: {
        todas: lista.length,
        open: lista.filter((p) => p.status === "open").length,
        overdue: lista.filter((p) => p.status === "overdue").length,
        paid: lista.filter((p) => p.status === "paid").length,
      },
    };
  }, [parcelas]);

  const visiveis = aba === "todas" ? parcelas : parcelas?.filter((p) => p.status === aba);


  const concluir = (texto: string) => {
    setBaixa(null);
    setPagamentos(null);
    setAviso(texto);
    setRecarregar((n) => n + 1);
  };

  return (
    <PlataformaShell activeId="acompanhamento" title="Faturas do mês" subtitle={`Competência ${String(mes).padStart(2, "0")}/${ano}`}>
      <div className="grid gap-5">
        <SeletorDeMes ano={ano} mes={mes} onChange={setPeriodo} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Previsto" value={formatBRL(totais.previsto)} />
          <MetricCard label="Recebido" value={formatBRL(totais.recebido)} />
          <MetricCard label="Em aberto" value={formatBRL(totais.emAberto)} />
          <MetricCard label="Atrasado" value={formatBRL(totais.atrasado)} />
        </div>

        <Tabs
          activeId={aba}
          onSelect={(id) => setAba(id as Aba)}
          items={[
            { id: "todas", label: "Todas", count: totais.contagem.todas },
            { id: "open", label: "Em aberto", count: totais.contagem.open },
            { id: "overdue", label: "Atrasadas", count: totais.contagem.overdue },
            { id: "paid", label: "Pagas", count: totais.contagem.paid },
          ]}
        />

        <div className="flex flex-wrap gap-3">
          <div style={{ width: 260 }}>
            <Select id="filtro-condominio" aria-label="Filtrar por condomínio" placeholder="Todos os condomínios" options={condominios.map((c) => ({ value: c.id, label: c.nome }))} value={condominioId} onChange={(e) => setCondominioId(e.target.value)} />
          </div>
          <div style={{ width: 260 }}>
            <Select id="filtro-responsavel" aria-label="Filtrar por responsável" placeholder="Todos os responsáveis" options={advogados.map((a) => ({ value: a.id, label: a.name }))} value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} />
          </div>
        </div>

        {erro && (
          <Alert tone="risk" title="Não foi possível carregar as faturas" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}

        {visiveis === undefined || visiveis === null ? (
          !erro && <p role="status">Carregando faturas…</p>
        ) : (
          <DataTable
            rows={visiveis}
            empty={<EmptyState icon="calendar-check" title="Nenhuma fatura neste mês" description="Revise o mês, a aba ou os filtros." />}
            columns={[
              { key: "devedor", label: "Devedor", strong: true, render: (p: ParcelaDoMes) => <Link href={`/acordos/${p.agreement_id}`}>{p.debtor.name}</Link> },
              { key: "condominio", label: "Condomínio", render: (p: ParcelaDoMes) => `${p.condominium.name} · ${p.debtor.unit}` },
              { key: "parcela", label: "Parcela", mono: true, align: "right", render: (p: ParcelaDoMes) => String(p.number) },
              { key: "vencimento", label: "Vencimento", mono: true, render: (p: ParcelaDoMes) => formatDate(p.due_date) },
              { key: "valor", label: "Valor", mono: true, align: "right", strong: true, render: (p: ParcelaDoMes) => formatBRL(p.amount) },
              {
                key: "situacao",
                label: "Situação",
                render: (p: ParcelaDoMes) => (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <SituacaoParcela parcela={p} />
                    {p.payment_date && <span className="text-sm">{`pago em ${formatDate(p.payment_date)}`}</span>}
                    {temPagamentoParcial(p) && <span className="text-sm">{`saldo ${formatBRL(p.remaining_amount)}`}</span>}
                  </span>
                ),
              },
              {
                key: "acoes",
                label: "",
                align: "right",
                render: (p: ParcelaDoMes) => (
                  <span className="inline-flex items-center justify-end gap-1">
                    {(p.status === "paid" || temPagamentoParcial(p)) && <Button size="sm" variant="ghost" aria-label={`Pagamentos da parcela ${p.number} de ${p.debtor.name}`} onClick={() => setPagamentos(p)}>Pagamentos</Button>}
                    {p.status !== "paid" && <Button size="sm" variant="secondary" icon="banknote" aria-label={`Dar baixa na parcela ${p.number} de ${p.debtor.name}`} onClick={() => setBaixa(p)}>Dar baixa</Button>}
                  </span>
                ),
              },
            ]}
          />
        )}
      </div>

      {baixa && <BaixaDialog parcela={baixa} descricao={descricaoDe(baixa)} onClose={() => setBaixa(null)} onSaved={(atualizada) => concluir(atualizada.status === "paid" ? "Baixa registrada com sucesso." : "Pagamento parcial registrado com sucesso.")} />}
      {pagamentos && <PagamentosDialog parcela={pagamentos} descricao={descricaoDe(pagamentos)} onClose={() => setPagamentos(null)} onChanged={(_, texto) => concluir(texto)} />}

      {aviso && (
        <ToastStack>
          <Toast tone="ok" title={aviso} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </PlataformaShell>
  );
}
