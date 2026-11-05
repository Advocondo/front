"use client";

import { Alert, Button, Card, EmptyState, MetricCard, Toast, ToastStack } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getParcela, listPagamentos, type Pagamento, type ParcelaDoMes } from "@/app/(equipe)/acompanhamento/api";
import { NotaFiscalDialog } from "@/app/(equipe)/acompanhamento/NotaFiscalDialog";
import { SituacaoParcela } from "@/app/(equipe)/acompanhamento/situacao";
import { getAcordo } from "@/app/(equipe)/acordos/api";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { formatBRL } from "@/app/lib/money";

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </>
  );
}

function notaFiscal({ invoice_number: numero, invoice_date: data }: ParcelaDoMes): string {
  if (!numero) return "—";
  return data ? `${numero}, em ${formatDate(data)}` : numero;
}

/** A visão de uma fatura para o escritório (#47). As ações continuam no acordo e em Faturas do mês. */
export function FaturaDetalheView({ id }: { id: string }) {
  const [parcela, setParcela] = useState<ParcelaDoMes | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [acordoCancelado, setAcordoCancelado] = useState(false);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [editandoNota, setEditandoNota] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getParcela(id, controller.signal), listPagamentos(id, controller.signal)])
      // A parcela não diz se o acordo foi cancelado, e sem isso uma parcela vencida pareceria ainda devida.
      .then(([dados, lista]) => getAcordo(dados.agreement_id, controller.signal).then((acordo) => ({ dados, lista, cancelado: acordo.status === "cancelled" })))
      .then(({ dados, lista, cancelado }) => {
        setParcela(dados);
        setPagamentos(lista);
        setAcordoCancelado(cancelado);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        // 422 é um endereço com id malformado: para quem abriu, é uma fatura que não existe.
        if (e instanceof ApiError && (e.status === 404 || e.status === 422)) setNaoEncontrada(true);
        else setErro(e instanceof ApiError ? e.message : "Tente novamente em instantes.");
      });
    return () => controller.abort();
  }, [id, recarregar]);

  return (
    <PlataformaShell
      activeId="acompanhamento"
      title={parcela ? `Parcela ${parcela.number}` : "Detalhe da fatura"}
      subtitle={parcela ? `${parcela.debtor.name} · ${parcela.condominium.name}` : undefined}
      actions={
        <Link href="/acompanhamento" className="text-sm font-medium">
          Voltar para Faturas do mês
        </Link>
      }
    >
      <div className="grid gap-5">
        {naoEncontrada && (
          <Card>
            <EmptyState icon="search" title="Fatura não encontrada" description="O endereço pode estar errado." />
          </Card>
        )}
        {erro && (
          <Alert tone="risk" title="Não foi possível carregar a fatura" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        {!parcela && !erro && !naoEncontrada && <p role="status">Carregando fatura…</p>}

        {parcela && !erro && (
          <>
            {acordoCancelado && (
              <Alert tone="warn" title="Acordo cancelado">
                O saldo desta parcela não é mais cobrado.
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Valor da parcela" value={formatBRL(parcela.amount)} />
              <MetricCard label="Repasse ao condomínio" value={formatBRL(parcela.condominium_amount)} />
              <MetricCard label="Honorários" value={formatBRL(parcela.fee_amount)} />
            </div>

            <Card title="Dados da fatura">
              <dl className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-sm">
                <Dado rotulo="Situação">
                  <SituacaoParcela parcela={parcela} />
                </Dado>
                <Dado rotulo="Vencimento">{formatDate(parcela.due_date)}</Dado>
                <Dado rotulo="Data de pagamento">{formatDate(parcela.payment_date)}</Dado>
                <Dado rotulo="Saldo">{formatBRL(parcela.remaining_amount)}</Dado>
                <Dado rotulo="Nota fiscal">
                  <span className="inline-flex items-center gap-2">
                    {notaFiscal(parcela)}
                    {/* O back só aceita nota em parcela quitada. */}
                    {parcela.status === "paid" && (
                      <Button size="sm" variant="ghost" onClick={() => setEditandoNota(true)}>
                        {parcela.invoice_number ? "Alterar nota fiscal" : "Registrar nota fiscal"}
                      </Button>
                    )}
                  </span>
                </Dado>
                <Dado rotulo="Devedor">{`${parcela.debtor.name} · ${parcela.debtor.unit}`}</Dado>
                <Dado rotulo="Condomínio">{parcela.condominium.name}</Dado>
                <Dado rotulo="Acordo">
                  <Link href={`/acordos/${parcela.agreement_id}`}>Ver acordo</Link>
                </Dado>
              </dl>
            </Card>

            <Card title="Pagamentos">
              {pagamentos.length === 0 ? (
                <p className="text-sm">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {pagamentos.map((p) => (
                    <li key={p.id} className="flex justify-between gap-4">
                      <span>{formatDate(p.payment_date)}</span>
                      <strong>{formatBRL(p.amount)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>

      {editandoNota && parcela && (
        <NotaFiscalDialog
          parcela={parcela}
          descricao={`${parcela.debtor.name} · ${parcela.condominium.name} · ${parcela.debtor.unit}`}
          onClose={() => setEditandoNota(false)}
          onSaved={() => {
            setEditandoNota(false);
            setAviso("Nota fiscal registrada com sucesso.");
            setRecarregar((n) => n + 1);
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
