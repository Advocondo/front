"use client";

import { Alert, Button, DataTable, EmptyState, Icon, Input, StatusPill, Toast, ToastStack } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { listCondominios } from "./api";
import { CondominioDialog } from "./CondominioDialog";
import { diasAte, formatDate } from "./format";
import { RenovacaoDialog } from "./RenovacaoDialog";
import type { Condominio } from "./types";

type Dialogo = { tipo: "novo" } | { tipo: "editar"; condominio: Condominio } | { tipo: "renovar"; condominio: Condominio } | null;

const DEBOUNCE_MS = 300;

/** O aviso continua depois da data: o prazo de renegociação ainda exige uma ação. */
function PrazoDeRenovacao({ data }: { data: string }) {
  const dias = diasAte(data);
  if (dias < 0) return <StatusPill label={`Venceu há ${-dias} ${dias === -1 ? "dia" : "dias"}`} tone="risk" />;
  if (dias === 0) return <StatusPill label="Renova hoje" tone="risk" />;
  return <StatusPill label={dias === 1 ? "Renova amanhã" : `Renova em ${dias} dias`} tone="warn" />;
}

export function CondominiosView() {
  const [busca, setBusca] = useState("");
  const [condominios, setCondominios] = useState<Condominio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      listCondominios(busca, controller.signal)
        .then((lista) => {
          setCondominios(lista);
          setErro(null);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os condomínios.");
        });
    }, busca ? DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [busca, recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const vazio = busca.trim() ? (
    <EmptyState icon="search" title="Nenhum condomínio encontrado" description="Revise a busca ou cadastre um novo condomínio." />
  ) : (
    <EmptyState icon="building-2" title="Nenhum condomínio cadastrado" description="Cadastre um condomínio para vincular acordos e usuários Cliente." action={<Button icon="plus" onClick={() => setDialogo({ tipo: "novo" })}>Novo condomínio</Button>} />
  );

  return (
    <PlataformaShell activeId="condominios" title="Condomínios" subtitle="Carteira de clientes assessorados">
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          <Input icon="search" placeholder="Buscar condomínio ou síndico" aria-label="Buscar condomínio ou síndico" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ width: 320 }} />
          <div className="flex-1" />
          <Button icon="plus" onClick={() => setDialogo({ tipo: "novo" })}>
            Novo condomínio
          </Button>
        </div>

        {erro && (
          <Alert tone="risk" title="Não foi possível carregar a lista" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}

        {condominios === null && !erro ? (
          <p role="status">Carregando condomínios…</p>
        ) : (
          condominios && (
            <DataTable
              rows={condominios}
              empty={vazio}
              columns={[
                {
                  key: "nome",
                  label: "Condomínio",
                  strong: true,
                  render: (c: Condominio) => (
                    <span className="inline-flex items-center gap-2">
                      <Icon name="building-2" size={16} />
                      {c.nome}
                    </span>
                  ),
                },
                { key: "localidade", label: "Localidade", render: (c: Condominio) => [c.cidade, c.uf].filter(Boolean).join("/") || "—" },
                { key: "sindico_nome", label: "Síndico", render: (c: Condominio) => c.sindico_nome ?? "—" },
                { key: "contrato_renovacao", label: "Renovação do contrato", mono: true, align: "right", render: (c: Condominio) => (
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      {c.proximo_da_renovacao && c.contrato_renovacao && <PrazoDeRenovacao data={c.contrato_renovacao} />}
                      {formatDate(c.contrato_renovacao)}
                    </span>
                  ) },
                {
                  key: "acoes",
                  label: "",
                  align: "right",
                  render: (c: Condominio) => (
                    <span className="inline-flex items-center justify-end gap-1">
                      {c.proximo_da_renovacao && (
                        <Button size="sm" variant="secondary" aria-label={`Registrar renovação de ${c.nome}`} onClick={() => setDialogo({ tipo: "renovar", condominio: c })}>
                          Registrar renovação
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" icon="pencil" aria-label={`Editar ${c.nome}`} onClick={() => setDialogo({ tipo: "editar", condominio: c })}>
                        Editar
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
          )
        )}
      </div>

      {dialogo?.tipo === "renovar" && (
        <RenovacaoDialog
          condominio={dialogo.condominio}
          onClose={() => setDialogo(null)}
          onSaved={() => {
            setDialogo(null);
            setAviso(`Renovação de ${dialogo.condominio.nome} registrada com sucesso.`);
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {dialogo && dialogo.tipo !== "renovar" && (
        <CondominioDialog
          condominio={dialogo.tipo === "editar" ? dialogo.condominio : undefined}
          onClose={() => setDialogo(null)}
          onSaved={(salvo, modo) => {
            setDialogo(null);
            setAviso(`Condomínio ${salvo.nome} ${modo} com sucesso.`);
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
