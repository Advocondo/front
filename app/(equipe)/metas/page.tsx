import type { Metadata } from "next";
import { MetasView } from "./MetasView";

export const metadata: Metadata = { title: "Metas e comissões · Advocondo" };

export default function MetasPage() {
  return <MetasView />;
}
