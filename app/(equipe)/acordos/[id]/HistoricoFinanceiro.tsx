"use client";

import { Alert, Button, Card, DataTable, Timeline } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { ApiError } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { formatBRL } from "@/app/lib/money";
import { useCelular } from "@/app/lib/useCelular";
import { listHistoricoFinanceiro } from "../api";
import type { MovimentacaoFinanceira } from "../types";

const deAte = (antes: string | null, depois: string | null, formatar: (valor: string) => string): string => `de ${antes ? formatar(antes) : "—"} para ${depois ? formatar(depois) : "—"}`;

const emReais = (valor: string): string => formatBRL(valor);

/** Traduz uma linha do registro do back para o que a tabela mostra (US31-CA01). */
export function descreverMovimentacao(m: MovimentacaoFinanceira): { acao: string; valor: string } {
  const parcela = m.installment_number === null ? "" : ` da parcela ${m.installment_number}`;
  switch (m.change) {
    case "payment_recorded":
      return { acao: `Baixa${parcela}`, valor: m.new_value ? `+ ${emReais(m.new_value)}` : "—" };
    case "payment_reversed":
      return { acao: `Estorno${parcela}`, valor: m.old_value ? `- ${emReais(m.old_value)}` : "—" };
    case "payment_corrected":
      return { acao: `Correção da data de pagamento${parcela}`, valor: deAte(m.old_value, m.new_value, formatDate) };
    case "due_date_edited":
      return { acao: `Vencimento${parcela}`, valor: deAte(m.old_value, m.new_value, formatDate) };
    case "amount_edited":
      return { acao: `Valor${parcela}`, valor: deAte(m.old_value, m.new_value, emReais) };
    default:
      if (m.field === "debtor") return { acao: "Devedor do acordo", valor: deAte(m.old_value, m.new_value, (v) => v) };
      return { acao: m.field === "fee_amount" ? "Honorários do acordo" : "Valor total do acordo", valor: deAte(m.old_value, m.new_value, emReais) };
  }
}

/**
 * US31 e US19-CA02: quem mexeu no dinheiro do acordo, quando e em quanto. Só o Administrador chega
 * aqui. Uma falha fica neste bloco: o resto da tela do acordo continua funcionando.
 */
export function HistoricoFinanceiro({ acordoId, versao }: { acordoId: string; versao: number }) {
  const celular = useCelular();
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoFinanceira[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listHistoricoFinanceiro(acordoId, controller.signal)
      .then((lista) => {
        setMovimentacoes(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o histórico financeiro.");
      });
    return () => controller.abort();
  }, [acordoId, versao, recarregar]);

  return (
    <Card title="Histórico financeiro">
      {erro && (
        <Alert tone="risk" title="Não foi possível carregar o histórico" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
          {erro}
        </Alert>
      )}
      {!movimentacoes && !erro && <p role="status">Carregando histórico financeiro…</p>}
      {movimentacoes?.length === 0 && <p className="text-sm">Nenhuma movimentação registrada.</p>}
      {movimentacoes && movimentacoes.length > 0 && celular && (
        // No celular, uma linha do tempo, como o histórico de responsáveis.
        <Timeline
          aria-label="Movimentações financeiras"
          items={movimentacoes.map((m) => ({ title: descreverMovimentacao(m).acao, description: descreverMovimentacao(m).valor, date: formatDateTime(m.changed_at), meta: `por ${m.changed_by.name}`, icon: "banknote" }))}
        />
      )}
      {movimentacoes && movimentacoes.length > 0 && !celular && (
        <div className="overflow-x-auto">
          <DataTable
            rows={movimentacoes.map((m, i) => ({ ...m, id: i }))}
            columns={[
              { key: "changed_at", label: "Data e hora", mono: true, render: (m: MovimentacaoFinanceira) => formatDateTime(m.changed_at) },
              { key: "autor", label: "Autor", render: (m: MovimentacaoFinanceira) => m.changed_by.name },
              { key: "acao", label: "Alteração", strong: true, render: (m: MovimentacaoFinanceira) => descreverMovimentacao(m).acao },
              { key: "valor", label: "Valor alterado", render: (m: MovimentacaoFinanceira) => descreverMovimentacao(m).valor },
            ]}
          />
        </div>
      )}
    </Card>
  );
}
