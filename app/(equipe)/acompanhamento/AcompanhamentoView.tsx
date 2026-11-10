"use client";

import { Alert, Badge, Button, DataTable, EmptyState, MetricCard, Select, Tabs, Tag, Toast, ToastStack } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { mesAtual, SeletorDeMes } from "@/app/components/SeletorDeMes";
import { ApiError } from "@/app/lib/api";
import { salvarArquivo } from "@/app/lib/arquivos";
import { centsFromApi, formatBRL } from "@/app/lib/money";
import { useSession } from "@/app/lib/session";
import { listAdvogados } from "@/app/(equipe)/acordos/api";
import type { Advogado } from "@/app/(equipe)/acordos/types";
import { listCondominios } from "@/app/(equipe)/condominios/api";
import { formatDate } from "@/app/(equipe)/condominios/format";
import type { Condominio } from "@/app/(equipe)/condominios/types";
import { exportarPlanilha, listParcelasDoMes, type ParcelaDoMes } from "./api";
import { BaixaDialog, textoDaBaixa } from "./BaixaDialog";
import { NotaFiscalDialog } from "./NotaFiscalDialog";
import { PagamentosDialog } from "./PagamentosDialog";
import { PendenciasDeNotaDialog } from "./PendenciasDeNotaDialog";
import { SituacaoParcela, temPagamentoParcial } from "./situacao";

type Aba = "todas" | "open" | "overdue" | "paid";



const soma = (valores: bigint[]): bigint => valores.reduce((total, valor) => total + valor, 0n);
const descricaoDe = (p: ParcelaDoMes): string => `${p.debtor.name} · ${p.condominium.name} · ${p.debtor.unit}`;

export function AcompanhamentoView() {
  const session = useSession();
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
  const [nota, setNota] = useState<ParcelaDoMes | null>(null);
  const [pendencias, setPendencias] = useState(false);
  const [soSemNota, setSoSemNota] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erroDaExportacao, setErroDaExportacao] = useState<string | null>(null);

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

  const pagasSemNota = parcelas?.filter((p) => p.status === "paid" && !p.invoice_number) ?? [];
  const visiveis = aba === "paid" && soSemNota ? pagasSemNota : aba === "todas" ? parcelas : parcelas?.filter((p) => p.status === aba);

  async function exportar() {
    setExportando(true);
    setErroDaExportacao(null);
    try {
      const planilha = await exportarPlanilha({ ano, mes, condominioId, responsavelId, status: aba === "todas" ? "" : aba });
      salvarArquivo(planilha, `acompanhamento_${ano}_${String(mes).padStart(2, "0")}.xlsx`);
    } catch (e) {
      setErroDaExportacao(e instanceof ApiError ? e.message : "Não foi possível exportar a planilha. Tente novamente.");
    } finally {
      setExportando(false);
    }
  }


  const concluir = (texto: string) => {
    setBaixa(null);
    setPagamentos(null);
    setNota(null);
    setAviso(texto);
    setRecarregar((n) => n + 1);
  };

  return (
    <PlataformaShell activeId="acompanhamento" title="Faturas do mês" subtitle={`Competência ${String(mes).padStart(2, "0")}/${ano}`}
      // A rota é só do Administrador (US35).
      actions={session?.user.role === "admin" && (
        <Button size="sm" variant="secondary" icon="download" loading={exportando} onClick={() => void exportar()}>
          Exportar planilha
        </Button>
      )}
    >
      {/* minmax(0, 1fr): no celular, as abas rolam na própria faixa em vez de alargar a página. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <SeletorDeMes ano={ano} mes={mes} onChange={setPeriodo} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Previsto" value={formatBRL(totais.previsto)} />
          <MetricCard label="Recebido" value={formatBRL(totais.recebido)} />
          <MetricCard label="Em aberto" value={formatBRL(totais.emAberto)} />
          <MetricCard label="Atrasado" value={formatBRL(totais.atrasado)} />
        </div>

        <Tabs
          style={{ overflowX: "auto" }}
          activeId={aba}
          onSelect={(id) => {
            setAba(id as Aba);
            setSoSemNota(false);
          }}
          items={[
            { id: "todas", label: "Todas", count: totais.contagem.todas },
            { id: "open", label: "Em aberto", count: totais.contagem.open },
            { id: "overdue", label: "Atrasadas", count: totais.contagem.overdue },
            { id: "paid", label: "Pagas", count: totais.contagem.paid },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div style={{ width: 260 }}>
            <Select id="filtro-condominio" aria-label="Filtrar por condomínio" placeholder="Todos os condomínios" options={condominios.map((c) => ({ value: c.id, label: c.nome }))} value={condominioId} onChange={(e) => setCondominioId(e.target.value)} />
          </div>
          <div style={{ width: 260 }}>
            <Select id="filtro-responsavel" aria-label="Filtrar por responsável" placeholder="Todos os responsáveis" options={advogados.map((a) => ({ value: a.id, label: a.name }))} value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} />
          </div>
          {aba === "paid" && (
            <button type="button" aria-pressed={soSemNota} aria-label={`Pagas sem nota fiscal · ${pagasSemNota.length}`} onClick={() => setSoSemNota((atual) => !atual)}>
              <Tag selected={soSemNota}>{`Pagas sem nota fiscal · ${pagasSemNota.length}`}</Tag>
            </button>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="ghost" icon="file-text" onClick={() => setPendencias(true)}>
            Todas as pendências de nota
          </Button>
        </div>

        {erroDaExportacao && (
          <Alert tone="risk" role="alert" title="Não foi possível exportar" onClose={() => setErroDaExportacao(null)}>
            {erroDaExportacao}
          </Alert>
        )}

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
              { key: "parcela", label: "Parcela", mono: true, align: "right", render: (p: ParcelaDoMes) => <Link href={`/faturas/${p.id}`} aria-label={`Ver a parcela ${p.number} de ${p.debtor.name}`}>{p.number}</Link> },
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
                    {p.invoice_number && <span className="text-sm">{`NF ${p.invoice_number}`}</span>}
                    {p.status === "paid" && !p.invoice_number && <Badge tone="warn">Sem nota fiscal</Badge>}
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
                    {p.status === "paid" && (
                      <Button size="sm" variant="ghost" aria-label={`${p.invoice_number ? "Alterar" : "Registrar"} a nota da parcela ${p.number} de ${p.debtor.name}`} onClick={() => setNota(p)}>
                        {p.invoice_number ? "Alterar nota" : "Registrar nota"}
                      </Button>
                    )}
                    {p.status !== "paid" && <Button size="sm" variant="secondary" icon="banknote" aria-label={`Dar baixa na parcela ${p.number} de ${p.debtor.name}`} onClick={() => setBaixa(p)}>Dar baixa</Button>}
                  </span>
                ),
              },
            ]}
          />
        )}
      </div>

      {baixa && <BaixaDialog parcela={baixa} descricao={descricaoDe(baixa)} onClose={() => setBaixa(null)} onSaved={(atualizada, notaFalhou) => concluir(textoDaBaixa(atualizada, notaFalhou))} />}
      {nota && <NotaFiscalDialog parcela={nota} descricao={descricaoDe(nota)} onClose={() => setNota(null)} onSaved={() => concluir("Nota fiscal registrada com sucesso.")} />}
      {pendencias && (
        <PendenciasDeNotaDialog
          onClose={() => setPendencias(false)}
          onChanged={(texto) => {
            setAviso(texto);
            setRecarregar((n) => n + 1);
          }}
        />
      )}
      {pagamentos && <PagamentosDialog parcela={pagamentos} descricao={descricaoDe(pagamentos)} onClose={() => setPagamentos(null)} onChanged={(_, texto) => concluir(texto)} />}

      {aviso && (
        <ToastStack style={{ bottom: "var(--aviso-bottom, var(--space-6))" }}>
          <Toast tone="ok" title={aviso} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </PlataformaShell>
  );
}
