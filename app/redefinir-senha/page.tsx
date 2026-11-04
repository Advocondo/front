import type { Metadata } from "next";
import { RedefinirSenhaView } from "./RedefinirSenhaView";

export const metadata: Metadata = { title: "Redefinir senha · Advocondo" };

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <RedefinirSenhaView token={typeof token === "string" ? token : ""} />;
}
