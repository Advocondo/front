import type { Metadata } from "next";
import { AcompanhamentoView } from "./AcompanhamentoView";

export const metadata: Metadata = { title: "Faturas do mês · Advocondo" };

export default function AcompanhamentoPage() {
  return <AcompanhamentoView />;
}
