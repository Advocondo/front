"use client";

import { Alert, Button, Card, Icon } from "edson-alexandre-design-system";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ApiError } from "@/app/lib/api";
import { formatarTamanho, salvarArquivo } from "@/app/lib/arquivos";
import { formatDateTime } from "@/app/lib/dates";
import { anexarDocumento, baixarDocumento, listDocumentos } from "../api";
import type { DocumentoDoAcordo } from "../types";

const LIMITE_EM_BYTES = 10 * 1024 * 1024;

/** O back só aceita http e https, mas o endereço vai para um href: confere de novo aqui. */
const linkSeguro = (url: string | null): url is string => Boolean(url && /^https?:\/\//i.test(url));

function detalhe(d: DocumentoDoAcordo): string {
  const tamanho = d.size === null ? "Link" : formatarTamanho(d.size);
  return `${tamanho} · anexado em ${formatDateTime(d.uploaded_at)} por ${d.uploaded_by.name}`;
}

/** US21: os anexos ficam no acordo mesmo depois de cancelado. */
export function DocumentosDoAcordo({ acordoId, onAviso }: { acordoId: string; onAviso: (texto: string) => void }) {
  const [documentos, setDocumentos] = useState<DocumentoDoAcordo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const seletor = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    listDocumentos(acordoId, controller.signal)
      .then((lista) => {
        setDocumentos(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os documentos.");
      });
    return () => controller.abort();
  }, [acordoId, recarregar]);

  async function anexar(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    // Limpa o campo para o mesmo arquivo poder ser escolhido de novo depois de um erro.
    event.target.value = "";
    if (!arquivo) return;
    setErroDaAcao(null);
    if (arquivo.size > LIMITE_EM_BYTES) {
      setErroDaAcao("O arquivo passa de 10 MB.");
      return;
    }
    setEnviando(true);
    try {
      await anexarDocumento(acordoId, arquivo);
      onAviso(`${arquivo.name} anexado com sucesso.`);
      setRecarregar((n) => n + 1);
    } catch (e) {
      setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível anexar o arquivo. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function baixar(documento: DocumentoDoAcordo) {
    setBaixando(documento.id);
    setErroDaAcao(null);
    try {
      salvarArquivo(await baixarDocumento(acordoId, documento.id), documento.filename);
    } catch (e) {
      setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível baixar o arquivo. Tente novamente.");
    } finally {
      setBaixando(null);
    }
  }

  return (
    <Card
      title="Documentos"
      action={
        <Button size="sm" variant="secondary" icon="paperclip" loading={enviando} onClick={() => seletor.current?.click()}>
          Anexar documento
        </Button>
      }
    >
      <div className="grid gap-3">
        <input ref={seletor} type="file" aria-label="Arquivo do documento" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="sr-only" tabIndex={-1} onChange={(e) => void anexar(e)} />
        {erro && (
          <Alert tone="risk" title="Não foi possível carregar os documentos" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        {erroDaAcao && (
          <Alert tone="risk" role="alert">
            {erroDaAcao}
          </Alert>
        )}
        {!documentos && !erro && <p role="status">Carregando documentos…</p>}
        {documentos?.length === 0 && <p className="text-sm">Nenhum documento anexado.</p>}
        {documentos && documentos.length > 0 && (
          <ul className="grid gap-3">
            {documentos.map((d) => (
              <li key={d.id} className="flex items-center gap-3">
                <Icon name={d.kind === "link" ? "link" : "file-text"} size={18} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.filename}</p>
                  <p className="text-sm">{detalhe(d)}</p>
                </div>
                {d.kind === "file" ? (
                  <Button size="sm" variant="ghost" icon="download" aria-label={`Baixar ${d.filename}`} loading={baixando === d.id} onClick={() => void baixar(d)}>
                    Baixar
                  </Button>
                ) : (
                  linkSeguro(d.url) && (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium" aria-label={`Abrir ${d.filename}`}>
                      Abrir
                    </a>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm">PDF, PNG ou JPEG, até 10 MB. Os documentos ficam vinculados ao acordo de forma permanente, mesmo se ele for cancelado.</p>
      </div>
    </Card>
  );
}
