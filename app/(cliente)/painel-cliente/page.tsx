import type { Metadata } from "next";
import { PainelClienteView } from "./PainelClienteView";

export const metadata: Metadata = { title: "Painel do Cliente · Advocondo" };

export default function PainelClientePage() {
  return <PainelClienteView />;
}
