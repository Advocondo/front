import { redirect } from "next/navigation";

// A landing page institucional (US01) assume esta rota quando for implementada.
export default function Home() {
  redirect("/condominios");
}
