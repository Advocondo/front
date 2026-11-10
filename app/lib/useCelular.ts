"use client";

import { useSyncExternalStore } from "react";

/** O mesmo ponto em que a barra lateral dá lugar à navegação inferior (`md` do Tailwind). */
const CONSULTA = "(max-width: 767px)";

function assinar(avisar: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const lista = window.matchMedia(CONSULTA);
  lista.addEventListener("change", avisar);
  return () => lista.removeEventListener("change", avisar);
}

const noCelular = () => typeof window.matchMedia === "function" && window.matchMedia(CONSULTA).matches;

/**
 * Se a tela é de celular. As telas trocam a tabela por cartões aqui, em vez de esconder uma das duas
 * com CSS: assim cada botão existe uma vez só, para o leitor de tela e para os testes.
 * No servidor, e onde não há `matchMedia`, vale o desktop.
 */
export function useCelular(): boolean {
  return useSyncExternalStore(assinar, noCelular, () => false);
}
