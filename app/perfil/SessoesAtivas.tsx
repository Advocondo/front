"use client";

import { Alert, Badge, Button, Card, Icon } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { ApiError } from "@/app/lib/api";
import { formatDateTime } from "@/app/lib/dates";
import { encerrarOutrasSessoes, encerrarSessao, listSessoes, type SessaoAtiva } from "./api";
import { descreverAparelho } from "./aparelho";

/** US06. `versao` muda quando a troca de senha encerra as outras sessões, para a lista acompanhar. */
export function SessoesAtivas({ versao, onEnded }: { versao: number; onEnded: (aviso: string) => void }) {
  const [sessoes, setSessoes] = useState<SessaoAtiva[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listSessoes(controller.signal)
      .then((lista) => {
        setSessoes(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar as sessões.");
      });
    return () => controller.abort();
  }, [versao, recarregar]);

  async function encerrar(chave: string, executar: () => Promise<void>, aviso: string) {
    setAcao(chave);
    setErroDaAcao(null);
    try {
      await executar();
      onEnded(aviso);
      setRecarregar((n) => n + 1);
    } catch (e) {
      // 404: a sessão já tinha acabado. A lista é que estava velha.
      if (e instanceof ApiError && e.status === 404) setRecarregar((n) => n + 1);
      else setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível encerrar. Tente novamente.");
    } finally {
      setAcao(null);
    }
  }

  const haOutras = sessoes?.some((s) => !s.is_current) ?? false;

  return (
    <Card
      title="Sessões ativas"
      action={
        haOutras && (
          <Button size="sm" variant="ghost" icon="log-out" loading={acao === "outras"} onClick={() => void encerrar("outras", encerrarOutrasSessoes, "Outras sessões encerradas.")}>
            Encerrar as outras
          </Button>
        )
      }
    >
      <div className="grid gap-3">
        {erro && (
          <Alert tone="risk" title="Não foi possível carregar as sessões" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        {erroDaAcao && (
          <Alert tone="risk" role="alert">
            {erroDaAcao}
          </Alert>
        )}
        {!sessoes && !erro && <p role="status">Carregando sessões…</p>}
        {sessoes && (
          <ul className="grid gap-3">
            {sessoes.map((sessao) => {
              const aparelho = descreverAparelho(sessao.user_agent);
              return (
                <li key={sessao.id} className="flex items-center gap-3">
                  <Icon name={aparelho.icone} size={18} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{aparelho.nome}</p>
                    <p className="text-sm">{`Entrou em ${formatDateTime(sessao.created_at)}`}</p>
                  </div>
                  {sessao.is_current ? (
                    <Badge tone="brand">Este aparelho</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" aria-label={`Encerrar a sessão de ${aparelho.nome}, de ${formatDateTime(sessao.created_at)}`} loading={acao === sessao.id} onClick={() => void encerrar(sessao.id, () => encerrarSessao(sessao.id), `Sessão de ${aparelho.nome} encerrada.`)}>
                      Encerrar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
