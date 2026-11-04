import type { Metadata } from "next";
import { connection } from "next/server";
import { getLanding } from "./_landing/content";
import { LandingPage, SiteIndisponivel } from "./_landing/LandingPage";

export const metadata: Metadata = {
  title: "Edson Alexandre Advogados",
  description: "Assessoria jurídica para condomínios e atendimento em todo o Brasil.",
};

export default async function Home() {
  // Renderiza a cada visita: a edição do Administrador fica pública assim que é salva.
  await connection();
  const content = await getLanding();
  return content ? <LandingPage content={content} /> : <SiteIndisponivel />;
}
