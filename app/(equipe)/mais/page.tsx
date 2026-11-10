import type { Metadata } from "next";
import { RequireAuth } from "@/app/components/RequireAuth";
import { MaisView } from "./MaisView";

export const metadata: Metadata = { title: "Mais · Advocondo" };

export default function MaisPage() {
  return (
    <RequireAuth roles={["admin", "operator"]}>
      <MaisView />
    </RequireAuth>
  );
}
