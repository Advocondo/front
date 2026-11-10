import { apiFetch } from "@/app/lib/api";
import type { LandingContent } from "@/app/_landing/types";

export type LandingSection = keyof LandingContent;
export type LandingImage = { id: string };

export function getConteudoInstitucional(signal?: AbortSignal) {
  return apiFetch<LandingContent>("/landing", { signal });
}

/** O back substitui a seção informada por inteiro; por isso enviamos o objeto completo. */
export function salvarSecao<K extends LandingSection>(section: K, content: LandingContent[K]) {
  return apiFetch<LandingContent>("/landing", {
    method: "PATCH",
    body: JSON.stringify({ [section]: content }),
  });
}

export function enviarFotoEquipe(file: File) {
  const body = new FormData();
  body.set("file", file);
  return apiFetch<LandingImage>("/landing/images", { method: "POST", body });
}

export function descartarFotoEquipe(id: string) {
  return apiFetch<void>(`/landing/images/${encodeURIComponent(id)}`, { method: "DELETE" });
}
