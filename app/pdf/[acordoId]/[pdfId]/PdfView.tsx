"use client";

import { Alert, Button, Card, EmptyState } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState } from "react";
import { baixarPdf, listPdfs } from "@/app/(equipe)/acordos/api";
import type { PdfDoAcordo } from "@/app/(equipe)/acordos/types";
import { ApiError } from "@/app/lib/api";
import { salvarArquivo } from "@/app/lib/arquivos";
import { homeForRole } from "@/app/lib/auth";
import { formatDateTime } from "@/app/lib/dates";
import { useSession } from "@/app/lib/session";

/** Onde o link do PDF leva. Sem acesso ao acordo, o back responde igual a um acordo que não existe. */
export function PdfView({ acordoId, pdfId }: { acordoId: string; pdfId: string }) {
  const session = useSession();
  const [pdf, setPdf] = useState<PdfDoAcordo | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listPdfs(acordoId, controller.signal)
      .then((lista) => {
        const achado = lista.find((p) => p.id === pdfId);
        setPdf(achado ?? null);
        setNaoEncontrado(!achado);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        // 422 é um endereço com id malformado.
        if (e instanceof ApiError && (e.status === 404 || e.status === 422)) setNaoEncontrado(true);
        else setErro(e instanceof ApiError ? e.message : "Não foi possível carregar o PDF.");
      });
    return () => controller.abort();
  }, [acordoId, pdfId, recarregar]);

  async function baixar(arquivo: PdfDoAcordo) {
    setBaixando(true);
    setErro(null);
    try {
      salvarArquivo(await baixarPdf(arquivo), arquivo.file_name);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível baixar o PDF. Tente novamente.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-xl content-start gap-4 p-6">
      <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
        PDF do acordo
      </h1>
      {erro && (
        <Alert tone="risk" role="alert" title="Não foi possível concluir" action={<Button size="sm" variant="secondary" onClick={() => setRecarregar((n) => n + 1)}>Tentar novamente</Button>}>
          {erro}
        </Alert>
      )}
      {!pdf && !erro && !naoEncontrado && <p role="status">Carregando PDF…</p>}
      {naoEncontrado && (
        <Card>
          <EmptyState icon="search" title="PDF não encontrado" description="Este PDF não existe ou você não tem acesso a este acordo." />
        </Card>
      )}
      {pdf && (
        <Card>
          <p className="font-semibold">{pdf.file_name}</p>
          <p className="mb-4 text-sm">{`Gerado em ${formatDateTime(pdf.generated_at)}`}</p>
          <Button icon="download" loading={baixando} onClick={() => void baixar(pdf)}>
            Baixar PDF
          </Button>
        </Card>
      )}
      {session && (
        <Link href={homeForRole(session.user.role)} className="text-sm font-medium">
          Ir para a tela inicial
        </Link>
      )}
    </main>
  );
}
