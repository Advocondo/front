"use client";

import { Alert, Button, Dialog, Timeline } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { ApiError } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import type { Role } from "@/app/lib/session";
import { listHistoricoDoUsuario, ROTULO_DA_SITUACAO, ROTULO_DO_PERFIL, type RegistroDoUsuario, type StatusUsuario, type Usuario } from "./api";

const perfil = (valor: string | null): string => (valor && ROTULO_DO_PERFIL[valor as Role]) || "—";
const situacao = (valor: string | null): string => (valor && ROTULO_DA_SITUACAO[valor as StatusUsuario]) || "—";
const nomes = (lista: { name: string }[]): string => lista.map((c) => c.name).join(", ");

/** Traduz uma linha do registro do back (US11-CA01). */
export function descreverRegistro(r: RegistroDoUsuario): { title: string; description?: string; icon: string } {
  switch (r.action) {
    case "invited":
      return { title: "Convite enviado", description: `Perfil ${perfil(r.new_value)}`, icon: "user-plus" };
    case "status_changed":
      return { title: "Situação alterada", description: `De ${situacao(r.old_value)} para ${situacao(r.new_value)}`, icon: "user-check" };
    case "role_changed":
      return { title: "Perfil alterado", description: `De ${perfil(r.old_value)} para ${perfil(r.new_value)}`, icon: "users-round" };
    case "condominiums_changed": {
      const partes = [r.added_condominiums.length > 0 && `Vinculados: ${nomes(r.added_condominiums)}`, r.removed_condominiums.length > 0 && `Removidos: ${nomes(r.removed_condominiums)}`].filter(Boolean);
      return { title: "Condomínios alterados", description: partes.join(". "), icon: "building-2" };
    }
  }
}

/** US11: quem convidou, inativou ou mudou o perfil desta pessoa. A tela é só do Administrador. */
export function HistoricoDialog({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const [registros, setRegistros] = useState<RegistroDoUsuario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listHistoricoDoUsuario(usuario.id, controller.signal)
      .then((lista) => {
        setRegistros(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o histórico.");
      });
    return () => controller.abort();
  }, [usuario.id, recarregar]);

  return (
    <Dialog
      open
      width={520}
      title="Histórico de acesso"
      description={`${usuario.name} · ${usuario.email}`}
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {erro && (
          <Alert tone="risk" title="Não foi possível carregar" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        {!registros && !erro && <p role="status">Carregando histórico…</p>}
        {registros?.length === 0 && <p className="text-sm">Nenhuma ação registrada.</p>}
        {registros && registros.length > 0 && (
          <Timeline
            items={registros.map((r) => ({
              ...descreverRegistro(r),
              date: formatDateTime(r.created_at),
              // O registro fica mesmo se o usuário autor for apagado: o back só limpa a referência.
              meta: r.actor ? `por ${r.actor.name}` : "Autor não registrado",
            }))}
          />
        )}
      </div>
    </Dialog>
  );
}
