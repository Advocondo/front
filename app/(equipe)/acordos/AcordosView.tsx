"use client";

import { Alert, Button, DataTable, EmptyState, Input, Select, StatusPill, Tag, Toast, ToastStack } from "edson-alexandre-design-system";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { formatBRL } from "@/app/lib/money";
import { useSession } from "@/app/lib/session";
import { listCondominios } from "@/app/(equipe)/condominios/api";
import type { Condominio } from "@/app/(equipe)/condominios/types";
import { AcordoDialog } from "./AcordoDialog";
import { listAcordos, listAdvogados } from "./api";
import type { Acordo, Advogado } from "./types";

const DEBOUNCE_MS = 300;
const FILTROS = [
  { status: "active", label: "Ativos" },
  { status: "cancelled", label: "Cancelados" },
  { status: "", label: "Todos" },
];

export function StatusAcordo({ status }: { status: Acordo["status"] }) {
  return status === "active" ? <StatusPill label="Ativo" tone="info" /> : <StatusPill label="Cancelado" tone="neutral" />;
}

export function AcordosView() {
  const router = useRouter();
  const session = useSession();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("active");
  const [responsavelId, setResponsavelId] = useState("");
  const [condominioId, setCondominioId] = useState("");
  const [acordos, setAcordos] = useState<Acordo[] | null>(null);
  const [condominios, setCondominios] = useState<Condominio[] | null>(null);
  const [advogados, setAdvogados] = useState<Advogado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [dialogo, setDialogo] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "ok" | "warn"; texto: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([listCondominios("", controller.signal), listAdvogados(controller.signal)])
      .then(([listaCondominios, listaAdvogados]) => {
        setCondominios(listaCondominios);
        setAdvogados(listaAdvogados);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os dados do cadastro.");
      });
    return () => controller.abort();
  }, [recarregar]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      listAcordos({ busca, status, responsavelId, condominioId }, controller.signal)
        .then((lista) => {
          setAcordos(lista);
          setErro(null);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os acordos.");
        });
    }, busca ? DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [busca, status, responsavelId, condominioId, recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const semCondominio = condominios?.length === 0;
  // Só aparece para quem pode ser responsável (US18-CA03).
  const meuId = advogados.some((a) => a.id === session?.user.id) ? session?.user.id : undefined;
  const vazio =
    busca.trim() || responsavelId || condominioId || status !== "active" ? (
      <EmptyState icon="search" title="Nenhum acordo encontrado" description="Revise a busca ou o filtro." />
    ) : (
      <EmptyState icon="handshake" title="Nenhum acordo ativo" description="Cadastre um acordo para gerar as parcelas e acompanhar os pagamentos." />
    );

  return (
    <PlataformaShell activeId="acordos" title="Acordos" subtitle="Acordos extrajudiciais dos condomínios assessorados">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div style={{ width: 360 }}>
            <Input icon="search" placeholder="Buscar por devedor, condomínio ou responsável" aria-label="Buscar por devedor, condomínio ou responsável" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {FILTROS.map((filtro) => (
            <button key={filtro.label} type="button" aria-pressed={status === filtro.status} onClick={() => setStatus(filtro.status)}>
              <Tag selected={status === filtro.status}>{filtro.label}</Tag>
            </button>
          ))}
          <div style={{ width: 220 }}>
            <Select id="filtro-condominio" aria-label="Filtrar por condomínio" placeholder="Todos os condomínios" options={(condominios ?? []).map((c) => ({ value: c.id, label: c.nome }))} value={condominioId} onChange={(e) => setCondominioId(e.target.value)} />
          </div>
          <div style={{ width: 220 }}>
            <Select id="filtro-responsavel" aria-label="Filtrar por responsável" placeholder="Todos os responsáveis" options={advogados.map((a) => ({ value: a.id, label: a.name }))} value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} />
          </div>
          {meuId && (
            <button type="button" aria-pressed={responsavelId === meuId} onClick={() => setResponsavelId(responsavelId === meuId ? "" : meuId)}>
              <Tag selected={responsavelId === meuId}>Meus acordos</Tag>
            </button>
          )}
          <div className="flex-1" />
          <Button icon="plus" disabled={!condominios || semCondominio} onClick={() => setDialogo(true)}>
            Novo acordo
          </Button>
        </div>

        {erro && (
          <Alert tone="risk" title="Não foi possível carregar a lista" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}

        {acordos === null && !erro ? (
          <p role="status">Carregando acordos…</p>
        ) : (
          acordos && (
            <DataTable
              rows={acordos}
              empty={vazio}
              columns={[
                { key: "devedor", label: "Devedor", strong: true, render: (a: Acordo) => a.debtor.name },
                { key: "condominio", label: "Condomínio", render: (a: Acordo) => `${a.condominium.name} · ${a.debtor.unit}` },
                { key: "total", label: "Valor do acordo", mono: true, align: "right", render: (a: Acordo) => formatBRL(a.total_amount) },
                { key: "honorarios", label: "Honorários", mono: true, align: "right", render: (a: Acordo) => formatBRL(a.fee_amount) },
                { key: "parcelas", label: "Parcelas", mono: true, align: "right", render: (a: Acordo) => `${a.installment_count}x` },
                { key: "responsavel", label: "Responsável", render: (a: Acordo) => a.responsible_lawyer?.name ?? "—" },
                { key: "status", label: "Status", render: (a: Acordo) => <StatusAcordo status={a.status} /> },
                {
                  key: "acoes",
                  label: "",
                  align: "right",
                  render: (a: Acordo) => (
                    <Button size="sm" variant="ghost" iconEnd="chevron-right" aria-label={`Ver o acordo de ${a.debtor.name}`} onClick={() => router.push(`/acordos/${a.id}`)}>
                      Ver
                    </Button>
                  ),
                },
              ]}
            />
          )
        )}
      </div>

      {dialogo && condominios && (
        <AcordoDialog
          condominios={condominios}
          advogados={advogados}
          onClose={() => setDialogo(false)}
          onSaved={(salvo, avisoDoCadastro) => {
            setDialogo(false);
            setAviso(avisoDoCadastro ? { tom: "warn", texto: avisoDoCadastro } : { tom: "ok", texto: `Acordo de ${salvo.debtor.name} cadastrado com sucesso.` });
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {aviso && (
        <ToastStack>
          <Toast tone={aviso.tom} title={aviso.texto} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </PlataformaShell>
  );
}
