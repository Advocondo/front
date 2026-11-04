import { RequireAuth } from "@/app/components/RequireAuth";

// Telas do perfil Cliente (síndicos).
export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth roles={["client"]}>{children}</RequireAuth>;
}
