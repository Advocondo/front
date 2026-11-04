import type { Metadata } from "next";
import { FaturaDetalheView } from "./FaturaDetalheView";

export const metadata: Metadata = { title: "Detalhe da fatura · Advocondo" };

export default async function FaturaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FaturaDetalheView id={id} />;
}
