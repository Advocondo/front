import type { Metadata } from "next";
import { AcordosView } from "./AcordosView";

export const metadata: Metadata = { title: "Acordos · Advocondo" };

export default function AcordosPage() {
  return <AcordosView />;
}
