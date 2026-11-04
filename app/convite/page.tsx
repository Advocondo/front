import type { Metadata } from "next";
import { ConviteView } from "./ConviteView";

export const metadata: Metadata = { title: "Aceitar convite · Advocondo" };

export default async function ConvitePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <ConviteView token={typeof token === "string" ? token : ""} />;
}
