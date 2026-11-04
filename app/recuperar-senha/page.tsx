import type { Metadata } from "next";
import { RecuperarSenhaView } from "./RecuperarSenhaView";

export const metadata: Metadata = { title: "Recuperar senha · Advocondo" };

export default function RecuperarSenhaPage() {
  return <RecuperarSenhaView />;
}
