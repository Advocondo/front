import type { Metadata } from "next";
import { DevedoresView } from "./DevedoresView";

export const metadata: Metadata = { title: "Devedores · Advocondo" };

export default function DevedoresPage() {
  return <DevedoresView />;
}
