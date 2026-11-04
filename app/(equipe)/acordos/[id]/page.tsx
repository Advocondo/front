import type { Metadata } from "next";
import { AcordoDetalheView } from "./AcordoDetalheView";

export const metadata: Metadata = { title: "Detalhes do acordo · Advocondo" };

export default async function AcordoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AcordoDetalheView id={id} />;
}
