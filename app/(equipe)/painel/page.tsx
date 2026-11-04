import type { Metadata } from "next";
import { RequireAuth } from "@/app/components/RequireAuth";
import { PainelView } from "./PainelView";

export const metadata: Metadata = { title: "Painel · Advocondo" };

// A US34 é do Administrador, e o back recusa estes indicadores para os outros perfis.
export default function PainelPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <PainelView />
    </RequireAuth>
  );
}
