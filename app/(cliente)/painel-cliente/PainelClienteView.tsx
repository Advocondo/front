"use client";

import { Alert, Button, Card, DataTable, EmptyState, MetricCard, StatusPill } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/app/(equipe)/condominios/format";
import { ApiError } from "@/app/lib/api";
import { useSession } from "@/app/lib/session";
import { baixarRelatorioDoCondominio, listAcordosDoCliente, type AcordoDoCliente } from "./api";
import { ClienteShell } from "./ClienteShell";
import { ParcelasDialog } from "./ParcelasDialog";

const SITUACAO = {
  em_dia: { label: "Em dia", tone: "ok" },
  atrasado: { label: "Atrasado", tone: "risk" },
} as const;

const quantos = (n: number, singular: string, plural: string): string => `${n} ${n === 1 ? singular : plural}`;

/** Mantém a ordem do back: quem tem acordo atrasado aparece primeiro. */
function porCondominio(acordos: AcordoDoCliente[]): AcordoDoCliente[][] {
  const grupos = new Map<string, AcordoDoCliente[]>();
  for (const acordo of acordos) grupos.set(acordo.condominium_id, [...(grupos.get(acordo.condominium_id) ?? []), acordo]);
  return [...grupos.values()];
}

/** "Res. Villa Verde" -> "relatorio-res-villa-verde.pdf". */
function nomeDoArquivo(condominio: string): string {
  const semAcentos = condominio.normalize("NFD").replace(/\p{M}/gu, "");
  return `relatorio-${semAcentos.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
}

function salvarArquivo(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

/** US37: o andamento dos acordos dos condomínios vinculados, sem nenhum valor. */
export function PainelClienteView() {
  const session = useSession();
  const [acordos, setAcordos] = useState<AcordoDoCliente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [parcelasDe, setParcelasDe] = useState<AcordoDoCliente | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erroDoRelatorio, setErroDoRelatorio] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listAcordosDoCliente(controller.signal)
      .then((lista) => {
        setAcordos(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Tente novamente em instantes.");
      });
    return () => controller.abort();
  }, [recarregar]);

  const grupos = useMemo(() => porCondominio(acordos ?? []), [acordos]);
  const atrasados = acordos?.filter((a) => a.status === "atrasado").length ?? 0;

  async function baixarRelatorio(condominioId: string, condominio: string) {
    setBaixando(condominioId);
    setErroDoRelatorio(null);
    try {
      salvarArquivo(await baixarRelatorioDoCondominio(condominioId), nomeDoArquivo(condominio));
    } catch (e) {
      setErroDoRelatorio(e instanceof ApiError ? e.message : "Não foi possível baixar o relatório. Tente novamente.");
    } finally {
      setBaixando(null);
    }
  }

  return (
    <ClienteShell title="Painel do Cliente" subtitle={session?.user.name}>
      {erro && (
        <Alert tone="risk" title="Não foi possível carregar os acordos" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
          {erro}
        </Alert>
      )}
      {erroDoRelatorio && (
        <Alert tone="risk" role="alert" title="Não foi possível baixar o relatório" onClose={() => setErroDoRelatorio(null)}>
          {erroDoRelatorio}
        </Alert>
      )}
      {!acordos && !erro && <p role="status">Carregando acordos…</p>}

      {acordos?.length === 0 && (
        <Card>
          <EmptyState icon="building-2" title="Nenhum acordo para mostrar" description="Aqui aparecem os acordos dos condomínios vinculados ao seu acesso. Se você esperava ver algum, fale com o escritório: (61) 3021-8539." />
        </Card>
      )}

      {acordos && acordos.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <MetricCard label="Acordos em dia" icon="circle-check" value={String(acordos.length - atrasados)} />
            <MetricCard label="Acordos atrasados" icon="triangle-alert" value={String(atrasados)} />
          </div>

          {grupos.map((lista) => (
            <Card
              key={lista[0].condominium_id}
              title={lista[0].condominium_name}
              action={
                <Button size="sm" variant="secondary" icon="download" aria-label={`Baixar relatório de ${lista[0].condominium_name}`} loading={baixando === lista[0].condominium_id} onClick={() => void baixarRelatorio(lista[0].condominium_id, lista[0].condominium_name)}>
                  Baixar relatório
                </Button>
              }
            >
              <div className="overflow-x-auto">
                <DataTable
                  rows={lista}
                  columns={[
                    // A unidade fica sob o nome para a situação, o dado principal, caber na largura do celular.
                    {
                      key: "debtor_name",
                      label: "Morador",
                      render: (a: AcordoDoCliente) => (
                        <>
                          <Link href={`/painel-cliente/moradores/${a.debtor_id}`} className="block font-semibold">
                            {a.debtor_name}
                          </Link>
                          <span className="block text-sm">{`Unidade ${a.debtor_unit}`}</span>
                        </>
                      ),
                    },
                    { key: "status", label: "Situação", render: (a: AcordoDoCliente) => <StatusPill label={SITUACAO[a.status].label} tone={SITUACAO[a.status].tone} /> },
                    { key: "overdue_installments", label: "Em atraso", render: (a: AcordoDoCliente) => (a.overdue_installments > 0 ? quantos(a.overdue_installments, "parcela", "parcelas") : "—") },
                    { key: "next_due_date", label: "Próximo vencimento", render: (a: AcordoDoCliente) => formatDate(a.next_due_date) },
                    {
                      key: "acoes",
                      label: "",
                      align: "right",
                      render: (a: AcordoDoCliente) => (
                        <Button size="sm" variant="ghost" aria-label={`Ver parcelas de ${a.debtor_name}`} onClick={() => setParcelasDe(a)}>
                          Parcelas
                        </Button>
                      ),
                    },
                  ]}
                />
              </div>
            </Card>
          ))}
        </>
      )}
      {parcelasDe && <ParcelasDialog acordo={parcelasDe} onClose={() => setParcelasDe(null)} />}
    </ClienteShell>
  );
}
