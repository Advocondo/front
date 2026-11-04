import type { Metadata } from "next";
import { CondominiosView } from "./CondominiosView";

export const metadata: Metadata = { title: "Condomínios · Advocondo" };

// Server Component fino: a interação (busca, diálogos) fica na view client.
export default function CondominiosPage() {
  return <CondominiosView />;
}
