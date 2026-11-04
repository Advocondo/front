"use client";

import { Alert, Button, Checkbox, Dialog, EmptyState, Input } from "edson-alexandre-design-system";
import { useEffect, useMemo, useState } from "react";
import { listCondominios } from "@/app/(equipe)/condominios/api";
import { ApiError } from "@/app/lib/api";
import { listVinculos, salvarVinculos, type Usuario } from "./api";

type Props = {
  usuario: Usuario;
  onClose: () => void;
  onSaved: () => void;
};

type Opcao = { id: string; nome: string; detalhe?: string };

const semAcentos = (texto: string): string => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const localDe = (cidade: string | null, uf: string | null): string | null => (cidade && uf ? `${cidade}/${uf}` : cidade || uf);

/** US10: o Cliente vê só os acordos dos condomínios marcados aqui. */
export function VinculosDialog({ usuario, onClose, onSaved }: Props) {
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [filtro, setFiltro] = useState("");
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([listCondominios("", controller.signal), listVinculos(usuario.id, controller.signal)])
      .then(([condominios, vinculos]) => {
        const lista: Opcao[] = condominios.map((c) => ({ id: c.id, nome: c.nome, detalhe: [c.sindico_nome, localDe(c.cidade, c.uf)].filter(Boolean).join(" · ") || undefined }));
        // A lista tem um limite de registros, e salvar substitui todos os vínculos: um vínculo fora dela
        // precisa aparecer, ou seria desfeito sem ninguém ter desmarcado.
        const ids = new Set(lista.map((o) => o.id));
        const foraDaLista = vinculos.filter((v) => !ids.has(v.id)).map((v) => ({ id: v.id, nome: v.name }));
        setOpcoes([...lista, ...foraDaLista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
        setMarcados(new Set(vinculos.map((v) => v.id)));
        setErroDeCarga(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErroDeCarga(e instanceof ApiError ? e.message : "Não foi possível carregar os condomínios.");
      });
    return () => controller.abort();
  }, [usuario.id, recarregar]);

  const visiveis = useMemo(() => {
    const termo = semAcentos(filtro.trim());
    return opcoes?.filter((o) => semAcentos(o.nome).includes(termo));
  }, [opcoes, filtro]);

  function alternar(id: string) {
    setMarcados((atuais) => {
      const proximos = new Set(atuais);
      if (!proximos.delete(id)) proximos.add(id);
      return proximos;
    });
  }

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSaving(true);
    setErro(null);
    try {
      await salvarVinculos(usuario.id, [...marcados]);
      onSaved();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar os vínculos. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={520}
      title="Condomínios vinculados"
      description={`${usuario.name} · ${usuario.email}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="vinculos-form" loading={saving} disabled={!opcoes || opcoes.length === 0}>
            Salvar vínculos
          </Button>
        </>
      }
    >
      <form id="vinculos-form" onSubmit={submit} noValidate className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1 [&>*]:shrink-0">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {erro}
          </Alert>
        )}
        {erroDeCarga && (
          <Alert tone="risk" title="Não foi possível carregar" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erroDeCarga}
          </Alert>
        )}
        {!opcoes && !erroDeCarga && <p role="status">Carregando condomínios…</p>}
        {opcoes?.length === 0 && <EmptyState icon="building-2" title="Nenhum condomínio cadastrado" description="Cadastre um condomínio para poder vinculá-lo a este Cliente." />}
        {opcoes && opcoes.length > 0 && (
          <>
            <Input icon="search" placeholder="Filtrar por nome" aria-label="Filtrar condomínios por nome" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
            <div className="grid gap-3">
              {visiveis?.map((o) => (
                <Checkbox key={o.id} label={o.nome} description={o.detalhe} checked={marcados.has(o.id)} onChange={() => alternar(o.id)} />
              ))}
              {visiveis?.length === 0 && <p className="text-sm">Nenhum condomínio com esse nome.</p>}
            </div>
            <p className="text-sm" role="status">{`${marcados.size} ${marcados.size === 1 ? "condomínio marcado" : "condomínios marcados"}. O Cliente vê só os acordos dos condomínios marcados. Sem vínculo, não vê nenhum.`}</p>
          </>
        )}
      </form>
    </Dialog>
  );
}
