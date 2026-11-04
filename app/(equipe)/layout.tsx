import { RequireAuth } from "@/app/components/RequireAuth";

// Telas do escritório: Administrador e Equipe Operacional.
export default function EquipeLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={["admin", "operator"]}>{children}</RequireAuth>;
}
