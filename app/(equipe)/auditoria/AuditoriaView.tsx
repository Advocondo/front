"use client";

import { Alert, Badge, Button, DataTable, EmptyState, Input, Select } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState } from "react";
import { descreverMovimentacao } from "@/app/(equipe)/acordos/[id]/HistoricoFinanceiro";
import type { MovimentacaoFinanceira } from "@/app/(equipe)/acordos/types";
import { descreverRegistro } from "@/app/(equipe)/usuarios/HistoricoDialog";
import { listUsuarios, type RegistroDoUsuario, type Usuario } from "@/app/(equipe)/usuarios/api";
import { Field } from "@/app/components/FormField";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { listarTrilha, TAMANHO_DA_PAGINA, type FiltrosDaTrilha, type RegistroDeAuditoria } from "./api";

const SEM_FILTRO: FiltrosDaTrilha = { autor: "", de: "", ate: "", categoria: "" };

const CATEGORIAS = [
  { value: "financial", label: "Financeiro (acordos e parcelas)" },
  { value: "users", label: "Usuários" },
];

/** Ação e detalhe com as mesmas palavras do histórico do acordo (US31) e do usuário (US11). */
export function descreverAcao(r: RegistroDeAuditoria): { acao: string; detalhe: string } {
  if (r.category === "financial") {
    const { acao, valor } = descreverMovimentacao({ ...r, change: r.action, changed_at: r.occurred_at, changed_by: r.actor } as MovimentacaoFinanceira);
    return { acao, detalhe: valor };
  }
  const { title, description } = descreverRegistro({ ...r, created_at: r.occurred_at } as RegistroDoUsuario);
  return { acao: title, detalhe: description || "—" };
}

function Alvo({ registro }: { registro: RegistroDeAuditoria }) {
  if (registro.agreement) {
    const { debtor, condominium } = registro.agreement;
    return (
      <span className="grid">
        <Link href={`/acordos/${registro.agreement.id}`}>{`${debtor.name} · ${debtor.unit}`}</Link>
        <span className="text-xs">{condominium.name}</span>
      </span>
    );
  }
  return <>{registro.target_user?.name ?? "—"}</>;
}

export function AuditoriaView() {
  const [filtros, setFiltros] = useState<FiltrosDaTrilha>(SEM_FILTRO);
  const [registros, setRegistros] = useState<RegistroDeAuditoria[] | null>(null);
  const [total, setTotal] = useState(0);
  const [autores, setAutores] = useState<Usuario[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [erroAoCarregarMais, setErroAoCarregarMais] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  const periodoInvertido = Boolean(filtros.de && filtros.ate && filtros.de > filtros.ate);

  useEffect(() => {
    const controller = new AbortController();
    // Clientes não registram ações: a lista de autores é só a equipe do escritório.
    listUsuarios("", controller.signal)
      .then((lista) => setAutores(lista.filter((u) => u.role !== "client")))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (periodoInvertido) return;
    const controller = new AbortController();
    listarTrilha(filtros, 0, controller.signal)
      .then((pagina) => {
        setRegistros(pagina.entries);
        setTotal(pagina.total);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar a trilha de auditoria.");
      });
    return () => controller.abort();
  }, [filtros, periodoInvertido, recarregar]);

  function filtrar(mudanca: Partial<FiltrosDaTrilha>) {
    setFiltros((atuais) => ({ ...atuais, ...mudanca }));
    // A lista antiga some até chegar a dos filtros novos.
    setRegistros(null);
    setErroAoCarregarMais(null);
  }

  async function carregarMais() {
    setCarregandoMais(true);
    setErroAoCarregarMais(null);
    try {
      const pagina = await listarTrilha(filtros, registros?.length ?? 0);
      // Uma ação nova desloca a página: a mesma linha pode vir de novo.
      setRegistros((atuais) => {
        const ids = new Set(atuais?.map((r) => r.id));
        return [...(atuais ?? []), ...pagina.entries.filter((r) => !ids.has(r.id))];
      });
      setTotal(pagina.total);
    } catch (e) {
      setErroAoCarregarMais(e instanceof ApiError ? e.message : "Não foi possível carregar mais registros.");
    } finally {
      setCarregandoMais(false);
    }
  }

  const filtrando = Object.values(filtros).some(Boolean);
  const haMais = registros !== null && registros.length < total;

  return (
    <PlataformaShell activeId="auditoria" title="Trilha de auditoria" subtitle="Quem fez cada ação em acordos, parcelas e usuários">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div style={{ width: 240 }}>
            <Field id="filtro-autor" label="Autor">
              <Select id="filtro-autor" placeholder="Todos os autores" options={autores.map((u) => ({ value: u.id, label: u.name }))} value={filtros.autor} onChange={(e) => filtrar({ autor: e.target.value })} />
            </Field>
          </div>
          <div style={{ width: 260 }}>
            <Field id="filtro-tipo" label="Tipo">
              <Select id="filtro-tipo" placeholder="Todos os tipos" options={CATEGORIAS} value={filtros.categoria} onChange={(e) => filtrar({ categoria: e.target.value as FiltrosDaTrilha["categoria"] })} />
            </Field>
          </div>
          <div style={{ width: 170 }}>
            <Field id="filtro-de" label="De">
              <Input id="filtro-de" type="date" value={filtros.de} onChange={(e) => filtrar({ de: e.target.value })} />
            </Field>
          </div>
          <div style={{ width: 170 }}>
            <Field id="filtro-ate" label="Até">
              <Input id="filtro-ate" type="date" value={filtros.ate} invalid={periodoInvertido} onChange={(e) => filtrar({ ate: e.target.value })} />
            </Field>
          </div>
          {filtrando && (
            <Button variant="ghost" icon="x" onClick={() => filtrar(SEM_FILTRO)}>
              Limpar filtros
            </Button>
          )}
        </div>

        {periodoInvertido && (
          <Alert tone="warn" role="alert" title="Período inválido">
            A data inicial não pode ser depois da data final.
          </Alert>
        )}

        {erro && !periodoInvertido && (
          <Alert tone="risk" title="Não foi possível carregar a trilha" action={<Button size="sm" variant="secondary" onClick={() => { setErro(null); setRegistros(null); setRecarregar((n) => n + 1); }}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}

        {!periodoInvertido && !erro && (registros === null ? (
          <p role="status">Carregando registros…</p>
        ) : (
          <>
            <p className="text-sm" role="status">{total === 1 ? "1 registro" : `${total} registros`}</p>
            <DataTable
              rows={registros}
              empty={
                filtrando ? (
                  <EmptyState icon="search" title="Nenhum registro encontrado" description="Revise os filtros." />
                ) : (
                  <EmptyState icon="scroll-text" title="Nenhuma ação registrada" description="Baixas, edições de acordo e mudanças em usuários aparecem aqui." />
                )
              }
              columns={[
                { key: "occurred_at", label: "Data e hora", mono: true, render: (r: RegistroDeAuditoria) => formatDateTime(r.occurred_at) },
                { key: "actor", label: "Autor", render: (r: RegistroDeAuditoria) => r.actor?.name ?? "—" },
                {
                  key: "acao",
                  label: "Ação",
                  render: (r: RegistroDeAuditoria) => (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <Badge tone={r.category === "financial" ? "info" : "neutral"}>{r.category === "financial" ? "Financeiro" : "Usuários"}</Badge>
                      {descreverAcao(r).acao}
                    </span>
                  ),
                },
                { key: "alvo", label: "Acordo ou usuário", render: (r: RegistroDeAuditoria) => <Alvo registro={r} /> },
                { key: "detalhe", label: "Detalhe", render: (r: RegistroDeAuditoria) => descreverAcao(r).detalhe },
              ]}
            />
            {erroAoCarregarMais && <Alert tone="risk" role="alert" title="Não foi possível carregar mais">{erroAoCarregarMais}</Alert>}
            {haMais && (
              <div className="flex justify-center">
                <Button variant="secondary" loading={carregandoMais} onClick={() => void carregarMais()}>
                  {`Carregar mais (${TAMANHO_DA_PAGINA} por vez)`}
                </Button>
              </div>
            )}
          </>
        ))}
      </div>
    </PlataformaShell>
  );
}
