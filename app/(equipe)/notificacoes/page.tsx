import type { Metadata } from "next";
import { NotificacoesView } from "./NotificacoesView";

export const metadata: Metadata = { title: "Notificações · Advocondo" };

export default function NotificacoesPage() {
  return <NotificacoesView />;
}
