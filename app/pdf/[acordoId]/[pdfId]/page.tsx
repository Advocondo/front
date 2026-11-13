import type { Metadata } from "next";
import { RequireAuth } from "@/app/components/RequireAuth";
import { PdfView } from "./PdfView";

export const metadata: Metadata = { title: "PDF do acordo · Advocondo" };

// Link de acesso (US24-CA02). Vale para qualquer perfil: quem decide se a pessoa vê este acordo é o back (CA03).
export default async function PdfPage({ params }: { params: Promise<{ acordoId: string; pdfId: string }> }) {
  const { acordoId, pdfId } = await params;
  return (
    <RequireAuth
      roles={["admin", "operator", "client"]}
      returnTo={`/pdf/${encodeURIComponent(acordoId)}/${encodeURIComponent(pdfId)}`}
    >
      <PdfView acordoId={acordoId} pdfId={pdfId} />
    </RequireAuth>
  );
}
