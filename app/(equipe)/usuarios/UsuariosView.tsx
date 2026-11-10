"use client";

import { Alert, Badge, Button, Card, DataTable, EmptyState, Input, StatusPill, Tag, Toast, ToastStack } from "edson-alexandre-design-system";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { useSession } from "@/app/lib/session";
import { useCelular } from "@/app/lib/useCelular";
import { listUsuarios, mudarStatus, reenviarConvite, ROTULO_DA_SITUACAO, ROTULO_DO_PERFIL, type ResultadoDoConvite, type StatusUsuario, type Usuario } from "./api";
import { ConviteDialog } from "./ConviteDialog";
import { HistoricoDialog } from "./HistoricoDialog";
import { InativarDialog } from "./InativarDialog";
import { PerfilDialog } from "./PerfilDialog";
import { VinculosDialog } from "./VinculosDialog";

type Dialogo = { tipo: "convite" } | { tipo: "perfil"; usuario: Usuario } | { tipo: "inativar"; usuario: Usuario } | { tipo: "vinculos"; usuario: Usuario } | { tipo: "historico"; usuario: Usuario } | null;

const DEBOUNCE_MS = 300;
const FILTROS: { status: StatusUsuario | ""; label: string }[] = [
  { status: "", label: "Todos" },
  { status: "active", label: "Ativos" },
  { status: "pending", label: "Pendentes" },
  { status: "inactive", label: "Inativos" },
];
const SITUACAO: Record<StatusUsuario, { label: string; tone: "ok" | "warn" | "neutral" }> = {
  active: { label: ROTULO_DA_SITUACAO.active, tone: "ok" },
  pending: { label: ROTULO_DA_SITUACAO.pending, tone: "warn" },
  inactive: { label: ROTULO_DA_SITUACAO.inactive, tone: "neutral" },
};

export function UsuariosView() {
  const session = useSession();
  const celular = useCelular();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusUsuario | "">("");
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [falhaDeEnvio, setFalhaDeEnvio] = useState<string | null>(null);

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
    setFalhaDeEnvio(null);
    setAviso(texto);
    setRecarregar((n) => n + 1);
  }

  /** O usuário existe mesmo sem o e-mail: o aviso fica na tela até o Administrador agir. */
  function concluirConvite(resultado: ResultadoDoConvite, texto: string) {
    concluir(texto);
    if (!resultado.invite_sent) {
      setAviso(null);
      setFalhaDeEnvio(`O e-mail de convite para ${resultado.email} não saiu. A pessoa está cadastrada como pendente: use Reenviar convite para tentar de novo.`);
    }
  }

  async function reenviar(usuario: Usuario) {
    setErroDaAcao(null);
    try {
      concluirConvite(await reenviarConvite(usuario.id), `Convite reenviado para ${usuario.email}. O link anterior deixou de valer.`);
    } catch (e) {
      setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível reenviar o convite. Tente novamente.");
    }
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

  const perfil = (u: Usuario) => (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{ROTULO_DO_PERFIL[u.role]}</Badge>
      {u.is_lawyer && <Badge tone="ok">{`Advogado · OAB ${u.oab_number}`}</Badge>}
    </span>
  );

  const situacao = (u: Usuario) => <StatusPill label={SITUACAO[u.status].label} tone={SITUACAO[u.status].tone} />;

  const acoes = (u: Usuario) =>
    // O back não deixa o Administrador mudar o próprio perfil nem se inativar.
    u.id === session?.user.id ? (
      <span className="inline-flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" aria-label={`Ver histórico de ${u.name}`} onClick={() => setDialogo({ tipo: "historico", usuario: u })}>
          Histórico
        </Button>
        <span className="text-sm">você</span>
      </span>
    ) : (
      <span className="inline-flex flex-wrap items-center justify-end gap-1">
        <Button size="sm" variant="ghost" aria-label={`Ver histórico de ${u.name}`} onClick={() => setDialogo({ tipo: "historico", usuario: u })}>
          Histórico
        </Button>
        <Button size="sm" variant="ghost" aria-label={`Definir nível de acesso de ${u.name}`} onClick={() => setDialogo({ tipo: "perfil", usuario: u })}>
          Perfil
        </Button>
        {u.role === "client" && (
          <Button size="sm" variant="ghost" aria-label={`Vincular condomínios de ${u.name}`} onClick={() => setDialogo({ tipo: "vinculos", usuario: u })}>
            Condomínios
          </Button>
        )}
        {u.status === "pending" && (
          <Button size="sm" variant="ghost" aria-label={`Reenviar convite de ${u.name}`} onClick={() => void reenviar(u)}>
            Reenviar convite
          </Button>
        )}
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
    );

  return (
    <PlataformaShell activeId="usuarios" title="Gestão de usuários" subtitle="Acessos da equipe e dos clientes">
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-80">
            <Input icon="search" placeholder="Buscar por nome ou e-mail" aria-label="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {FILTROS.map((f) => (
            <button key={f.label} type="button" aria-pressed={filtro === f.status} onClick={() => setFiltro(f.status)}>
              <Tag selected={filtro === f.status}>{`${f.label} · ${contagem[f.status]}`}</Tag>
            </button>
          ))}
          <div className="flex-1" />
          <Button icon="user-plus" block={celular} onClick={() => setDialogo({ tipo: "convite" })}>
            Convidar membro
          </Button>
        </div>

        {erro && (
          <Alert tone="risk" title="Não foi possível carregar a lista" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        {falhaDeEnvio && (
          <Alert tone="warn" role="alert" title="O e-mail não saiu" onClose={() => setFalhaDeEnvio(null)}>
            {falhaDeEnvio}
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
          celular ? (
            <CartoesDeUsuario usuarios={visiveis} perfil={perfil} situacao={situacao} acoes={acoes} />
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
                  render: perfil,
                },
                { key: "status", label: "Status", render: situacao },
                {
                  key: "acoes",
                  label: "",
                  align: "right",
                  render: acoes,
                },
              ]}
            />
          )
        )}
      </div>

      {dialogo?.tipo === "convite" && <ConviteDialog onClose={() => setDialogo(null)} onSaved={(u) => concluirConvite(u, `Convite enviado para ${u.email}.`)} />}
      {dialogo?.tipo === "perfil" && <PerfilDialog usuario={dialogo.usuario} onClose={() => setDialogo(null)} onSaved={(u) => concluir(`${u.name} agora é ${ROTULO_DO_PERFIL[u.role]}.`)} />}
      {dialogo?.tipo === "vinculos" && <VinculosDialog usuario={dialogo.usuario} onClose={() => setDialogo(null)} onSaved={() => concluir(`Condomínios de ${dialogo.usuario.name} atualizados.`)} />}
      {dialogo?.tipo === "historico" && <HistoricoDialog usuario={dialogo.usuario} onClose={() => setDialogo(null)} />}
      {dialogo?.tipo === "inativar" && <InativarDialog usuario={dialogo.usuario} onClose={() => setDialogo(null)} onSaved={(u) => concluir(`Acesso de ${u.name} inativado.`)} />}

      {aviso && (
        <ToastStack style={{ bottom: "var(--aviso-bottom, var(--space-6))" }}>
          <Toast tone="ok" title={aviso} onClose={() => setAviso(null)} />
        </ToastStack>
      )}
    </PlataformaShell>
  );
}

type CartoesProps = { usuarios: Usuario[]; perfil: (u: Usuario) => ReactNode; situacao: (u: Usuario) => ReactNode; acoes: (u: Usuario) => ReactNode };

/** Usuários no celular: um cartão por pessoa, com perfil, situação e as mesmas ações da tabela. */
function CartoesDeUsuario({ usuarios, perfil, situacao, acoes }: CartoesProps) {
  if (usuarios.length === 0) return <EmptyState icon="search" title="Nenhum usuário encontrado" description="Revise a busca ou o filtro." />;
  return (
    <ul className="grid gap-3" aria-label="Usuários">
      {usuarios.map((u) => (
        <li key={u.id}>
          <Card padding="sm">
            <div className="grid gap-2">
              <div className="flex items-start justify-between gap-3">
                <span className="grid min-w-0">
                  <span className="font-semibold">{u.name}</span>
                  <span className="text-sm break-all">{u.email}</span>
                </span>
                {situacao(u)}
              </div>
              {perfil(u)}
              <div className="flex justify-end">{acoes(u)}</div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
