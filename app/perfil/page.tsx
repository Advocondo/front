import type { Metadata } from "next";
import { RequireAuth } from "@/app/components/RequireAuth";
import { PerfilView } from "./PerfilView";

export const metadata: Metadata = { title: "Meu perfil · Advocondo" };

// US05 e US06 valem para qualquer perfil, por isso a página fica fora dos grupos (equipe) e (cliente).
export default function PerfilPage() {
  return (
    <RequireAuth roles={["admin", "operator", "client"]}>
      <PerfilView />
    </RequireAuth>
  );
}
