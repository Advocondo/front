"use client";

import { Alert, Button, Card, IconButton } from "edson-alexandre-design-system";
import { useEffect, useState } from "react";
import { ApiError } from "@/app/lib/api";
import { formatarTamanho, salvarArquivo } from "@/app/lib/arquivos";
import { formatDateTime } from "@/app/lib/dates";
import { baixarPdf, gerarPdf, listPdfs } from "../api";
import type { PdfDoAcordo } from "../types";

/**
 * US24. O PDF é uma foto do acordo: cada geração cria outro, e os anteriores continuam.
 * O link leva a uma tela do front, porque a rota do back exige o token no cabeçalho.
 */
export function PdfsDoAcordo({ acordoId, onAviso }: { acordoId: string; onAviso: (texto: string) => void }) {
  const [pdfs, setPdfs] = useState<PdfDoAcordo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listPdfs(acordoId, controller.signal)
      .then((lista) => {
        setPdfs(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os PDFs.");
      });
    return () => controller.abort();
  }, [acordoId, recarregar]);

  async function gerar() {
    setGerando(true);
    setErroDaAcao(null);
    try {
      await gerarPdf(acordoId);
      onAviso("PDF gerado com sucesso.");
      setRecarregar((n) => n + 1);
    } catch (e) {
      setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  async function baixar(pdf: PdfDoAcordo) {
    setBaixando(pdf.id);
    setErroDaAcao(null);
    try {
      salvarArquivo(await baixarPdf(pdf), pdf.file_name);
    } catch (e) {
      setErroDaAcao(e instanceof ApiError ? e.message : "Não foi possível baixar o PDF. Tente novamente.");
    } finally {
      setBaixando(null);
    }
  }

  async function copiarLink(pdf: PdfDoAcordo) {
    const link = `${window.location.origin}/pdf/${acordoId}/${pdf.id}`;
    try {
      await navigator.clipboard.writeText(link);
      onAviso("Link copiado. Quem abrir precisa entrar no sistema e ter acesso a este acordo.");
    } catch {
      // A área de transferência pode estar bloqueada: o link ainda precisa chegar à pessoa.
      setErroDaAcao(`Não foi possível copiar. Copie o link: ${link}`);
    }
  }

  return (
    <Card
      title="PDF do acordo"
      action={
        <Button size="sm" variant="secondary" icon="file-down" loading={gerando} onClick={() => void gerar()}>
          Gerar PDF
        </Button>
      }
    >
      <div className="grid gap-3">
        {erro && (
          <Alert tone="risk" title="Não foi possível carregar os PDFs" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
            {erro}
          </Alert>
        )}
        {erroDaAcao && (
          <Alert tone="risk" role="alert">
            {erroDaAcao}
          </Alert>
        )}
        {!pdfs && !erro && <p role="status">Carregando PDFs…</p>}
        {pdfs?.length === 0 && <p className="text-sm">Nenhum PDF gerado.</p>}
        {pdfs && pdfs.length > 0 && (
          <ul className="grid gap-3">
            {pdfs.map((pdf) => (
              <li key={pdf.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{pdf.file_name}</p>
                  <p className="text-sm">{`${formatarTamanho(pdf.size_bytes)} · gerado em ${formatDateTime(pdf.generated_at)} por ${pdf.generated_by.name}`}</p>
                </div>
                <IconButton icon="link" label={`Copiar o link de ${pdf.file_name}`} onClick={() => void copiarLink(pdf)} />
                <Button size="sm" variant="ghost" icon="download" aria-label={`Baixar ${pdf.file_name}`} loading={baixando === pdf.id} onClick={() => void baixar(pdf)}>
                  Baixar
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm">O PDF é uma foto do acordo no momento em que foi gerado, sem honorários. Para ver o estado atual, gere outro.</p>
      </div>
    </Card>
  );
}
