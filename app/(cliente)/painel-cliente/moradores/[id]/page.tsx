import type { Metadata } from "next";
import { HistoricoMoradorView } from "./HistoricoMoradorView";

export const metadata: Metadata = { title: "Histórico de pagamentos · Advocondo" };

export default async function HistoricoMoradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HistoricoMoradorView id={id} />;
}
