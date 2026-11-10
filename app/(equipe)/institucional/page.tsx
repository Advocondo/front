import type { Metadata } from "next";
import { RequireAuth } from "@/app/components/RequireAuth";
import { InstitucionalView } from "./InstitucionalView";

export const metadata: Metadata = { title: "Conteúdo institucional · Advocondo" };

export default function InstitucionalPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <InstitucionalView />
    </RequireAuth>
  );
}
