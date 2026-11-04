import type { Metadata } from "next";
import { RequireAuth } from "@/app/components/RequireAuth";
import { UsuariosView } from "./UsuariosView";

export const metadata: Metadata = { title: "Gestão de usuários · Advocondo" };

// Só o Administrador vê e acessa este módulo (US07-CA02).
export default function UsuariosPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <UsuariosView />
    </RequireAuth>
  );
}
