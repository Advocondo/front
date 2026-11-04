"use client";

import { Alert, Badge, Button, DataTable, EmptyState, Input, StatusPill, Tag, Toast, ToastStack } from "edson-alexandre-design-system";
import { useEffect, useMemo, useState } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { useSession } from "@/app/lib/session";
import { listUsuarios, mudarStatus, ROTULO_DO_PERFIL, type StatusUsuario, type Usuario } from "./api";
import { ConviteDialog } from "./ConviteDialog";
import { InativarDialog } from "./InativarDialog";
import { PerfilDialog } from "./PerfilDialog";

type Dialogo = { tipo: "convite" } | { tipo: "perfil"; usuario: Usuario } | { tipo: "inativar"; usuario: Usuario } | null;

const DEBOUNCE_MS = 300;
const FILTROS: { status: StatusUsuario | ""; label: string }[] = [
  { status: "", label: "Todos" },
  { status: "active", label: "Ativos" },
  { status: "pending", label: "Pendentes" },
  { status: "inactive", label: "Inativos" },
];
const SITUACAO: Record<StatusUsuario, { label: string; tone: "ok" | "warn" | "neutral" }> = {
  active: { label: "Ativo", tone: "ok" },
  pending: { label: "Pendente", tone: "warn" },
  inactive: { label: "Inativo", tone: "neutral" },
};

export function UsuariosView() {
  const session = useSession();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusUsuario | "">("");
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      listUsuarios(busca, controller.signal)
        .then((lista) => {
          setUsuarios(lista);
          setErro(null);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os usuários.");
        });
    }, busca ? DEBOUNCE_MS : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [busca, recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const contagem = useMemo(() => {
    const lista = usuarios ?? [];
    return { "": lista.length, active: 0, pending: 0, inactive: 0, ...Object.fromEntries((["active", "pending", "inactive"] as const).map((s) => [s, lista.filter((u) => u.status === s).length])) };
  }, [usuarios]);
  const visiveis = filtro ? usuarios?.filter((u) => u.status === filtro) : usuarios;

  function concluir(texto: string) {
    setDialogo(null);
    setErroDaAcao(null);
    setAviso(texto);
    setRecarregar((n) => n + 1);
  }

  async function reativar(usuario: Usuario) {
    setErroDaAcao(null);
    try {
      await mudarStatus(usuario.id, "active");
      concluir(`Acesso de ${usuario.name} reativado com sucesso.`);
    } catch (e) {
      setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível reativar o acesso. Tente novamente.");
    }
  }

  return (
    <PlataformaShell activeId="usuarios" title="Gestão de usuários" subtitle="Acessos da equipe e dos clientes">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div style={{ width: 320 }}>
            <Input icon="search" placeholder="Buscar por nome ou e-mail" aria-label="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {FILTROS.map((f) => (
            <button key={f.label} type="button" aria-pressed={filtro === f.status} onClick={() => setFiltro(f.status)}>
              <Tag selected={filtro === f.status}>{`${f.label} · ${contagem[f.status]}`}</Tag>
            </button>
          ))}
          <div className="flex-1" />
          <Button icon="user-plus" onClick={() => setDialogo({ tipo: "convite" })}>
            Convidar membro
          </Button>
        </div>

        {erro && (
          <Alert tone="risk" title="Não foi possível carregar a lista" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        {erroDaAcao && (
          <Alert tone="risk" role="alert" title="Não foi possível concluir">
            {erroDaAcao}
          </Alert>
        )}

        {visiveis === null || visiveis === undefined ? (
          !erro && <p role="status">Carregando usuários…</p>
        ) : (
          <DataTable
            rows={visiveis}
            empty={<EmptyState icon="search" title="Nenhum usuário encontrado" description="Revise a busca ou o filtro." />}
            columns={[
              { key: "name", label: "Nome", strong: true },
              { key: "email", label: "E-mail" },
              {
                key: "perfil",
                label: "Perfil",
                render: (u: Usuario) => (
                  <span className="inline-flex flex-wrap gap-1">
                    <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{ROTULO_DO_PERFIL[u.role]}</Badge>
                    {u.is_lawyer && <Badge tone="ok">{`Advogado · OAB ${u.oab_number}`}</Badge>}
                  </span>
                ),
              },
              { key: "status", label: "Status", render: (u: Usuario) => <StatusPill label={SITUACAO[u.status].label} tone={SITUACAO[u.status].tone} /> },
              {
                key: "acoes",
                label: "",
                align: "right",
                render: (u: Usuario) =>
                  // O back não deixa o Administrador mudar o próprio perfil nem se inativar.
                  u.id === session?.user.id ? (
                    <span className="text-sm">você</span>
                  ) : (
                    <span className="inline-flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" aria-label={`Definir nível de acesso de ${u.name}`} onClick={() => setDialogo({ tipo: "perfil", usuario: u })}>
                        Perfil
                      </Button>
                      {u.status === "active" && (
                        <Button size="sm" variant="ghost" aria-label={`Inativar ${u.name}`} onClick={() => setDialogo({ tipo: "inativar", usuario: u })}>
                          Inativar
                        </Button>
                      )}
                      {u.status === "inactive" && (
                        <Button size="sm" variant="ghost" aria-label={`Reativar ${u.name}`} onClick={() => void reativar(u)}>
                          Reativar
                        </Button>
                      )}
                    </span>
                  ),
              },
            ]}
          />
        )}
      </div>

      {dialogo?.tipo === "convite" && <ConviteDialog onClose={() => setDialogo(null)} onSaved={(u) => concluir(`Convite enviado para ${u.email}.`)} />}
      {dialogo?.tipo === "perfil" && <PerfilDialog usuario={dialogo.usuario} onClose={() => setDialogo(null)} onSaved={(u) => concluir(`${u.name} agora é ${ROTULO_DO_PERFIL[u.role]}.`)} />}
      {dialogo?.tipo === "inativar" && <InativarDialog usuario={dialogo.usuario} onClose={() => setDialogo(null)} onSaved={(u) => concluir(`Acesso de ${u.name} inativado.`)} />}

      {aviso && (
        <ToastStack>
          <Toast tone="ok" title={aviso} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </PlataformaShell>
  );
}
