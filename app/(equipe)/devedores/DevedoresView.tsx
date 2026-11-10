"use client";

import { Alert, Button, DataTable, EmptyState, Input, Select, Toast, ToastStack } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { maskTelefone } from "@/app/lib/masks";
import { listCondominios } from "@/app/(equipe)/condominios/api";
import type { Condominio } from "@/app/(equipe)/condominios/types";
import { listDevedores } from "./api";
import { DevedorDialog } from "./DevedorDialog";
import { ImportarDialog } from "./ImportarDialog";
import type { Devedor } from "./types";

type Dialogo = { tipo: "novo" } | { tipo: "editar"; devedor: Devedor } | { tipo: "importar" } | null;

const DEBOUNCE_MS = 300;

export function DevedoresView() {
  const [busca, setBusca] = useState("");
  const [condominioId, setCondominioId] = useState("");
  const [devedores, setDevedores] = useState<Devedor[] | null>(null);
  const [condominios, setCondominios] = useState<Condominio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listCondominios("", controller.signal)
      .then(setCondominios)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os condomínios.");
      });
    return () => controller.abort();
  }, [recarregar]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      listDevedores(busca, condominioId, controller.signal)
        .then((lista) => {
          setDevedores(lista);
          setErro(null);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os devedores.");
        });
    }, busca ? DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [busca, condominioId, recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const nomeDoCondominio = (id: string) => condominios?.find((c) => c.id === id)?.nome ?? "—";
  const semCondominio = condominios?.length === 0;

  const filtrando = busca.trim() || condominioId;
  const vazio = filtrando ? (
    <EmptyState icon="search" title="Nenhum devedor encontrado" description="Revise a busca ou cadastre um novo devedor." />
  ) : (
    <EmptyState icon="users" title="Nenhum devedor cadastrado" description="Cadastre um devedor para reaproveitar os dados dele nos acordos." action={<Button icon="plus" onClick={() => setDialogo({ tipo: "novo" })}>Novo devedor</Button>} />
  );

  return (
    <PlataformaShell activeId="devedores" title="Devedores" subtitle="Moradores inadimplentes dos condomínios assessorados">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div style={{ width: 320 }}>
            <Input icon="search" placeholder="Buscar por nome ou unidade" aria-label="Buscar por nome ou unidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div style={{ width: 260 }}>
            <Select
              id="filtro-condominio"
              aria-label="Filtrar por condomínio"
              placeholder="Todos os condomínios"
              options={(condominios ?? []).map((c) => ({ value: c.id, label: c.nome }))}
              value={condominioId}
              onChange={(e) => setCondominioId(e.target.value)}
            />
          </div>
          <div className="flex-1" />
          <Button variant="secondary" icon="upload" disabled={!condominios || semCondominio} onClick={() => setDialogo({ tipo: "importar" })}>
            Importar planilha
          </Button>
          <Button icon="plus" disabled={!condominios || semCondominio} onClick={() => setDialogo({ tipo: "novo" })}>
            Novo devedor
          </Button>
        </div>

        {semCondominio && (
          <Alert tone="info" title="Cadastre um condomínio primeiro">
            Todo devedor pertence a um condomínio. <Link href="/condominios">Ir para Condomínios</Link>
          </Alert>
        )}

        {erro && (
          <Alert tone="risk" title="Não foi possível carregar a lista" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}

        {devedores === null && !erro ? (
          <p role="status">Carregando devedores…</p>
        ) : (
          devedores && (
            <DataTable
              rows={devedores}
              empty={vazio}
              columns={[
                { key: "name", label: "Devedor", strong: true },
                { key: "unit", label: "Unidade" },
                { key: "condominio", label: "Condomínio", render: (d: Devedor) => nomeDoCondominio(d.condominium_id) },
                { key: "phone", label: "Telefone", mono: true, render: (d: Devedor) => (d.phone ? maskTelefone(d.phone) : "—") },
                { key: "email", label: "E-mail", render: (d: Devedor) => d.email ?? "—" },
                {
                  key: "acoes",
                  label: "",
                  align: "right",
                  render: (d: Devedor) => (
                    <Button size="sm" variant="ghost" icon="pencil" aria-label={`Editar ${d.name}`} onClick={() => setDialogo({ tipo: "editar", devedor: d })}>
                      Editar
                    </Button>
                  ),
                },
              ]}
            />
          )
        )}
      </div>

      {dialogo?.tipo === "importar" && condominios && (
        <ImportarDialog
          condominios={condominios}
          condominioInicial={condominioId}
          onClose={() => setDialogo(null)}
          onImported={(texto) => {
            setDialogo(null);
            setAviso(texto);
            setRecarregar((n) => n + 1);
          }}
        />
      )}

      {dialogo && dialogo.tipo !== "importar" && condominios && (
        <DevedorDialog
          devedor={dialogo.tipo === "editar" ? dialogo.devedor : undefined}
          condominios={condominios}
          condominioInicial={condominioId}
          onClose={() => setDialogo(null)}
          onSaved={(salvo, modo) => {
            setDialogo(null);
            setAviso(`Devedor ${salvo.name} ${modo} com sucesso.`);
            setRecarregar((n) => n + 1);
          }}
          onUseExisting={(existente) => {
            setDialogo(null);
            setCondominioId(existente.condominium_id);
            setBusca(existente.name);
          }}
        />
      )}

      {aviso && (
        <ToastStack style={{ bottom: "var(--aviso-bottom, var(--space-6))" }}>
          <Toast tone="ok" title={aviso} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </PlataformaShell>
  );
}
