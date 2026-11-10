import type { Metadata } from "next";
import { RequireAuth } from "@/app/components/RequireAuth";
import { AuditoriaView } from "./AuditoriaView";

export const metadata: Metadata = { title: "Trilha de auditoria · Advocondo" };

export default function AuditoriaPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <AuditoriaView />
    </RequireAuth>
  );
}
