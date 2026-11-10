import { vi } from "vitest";

/** Faz `useCelular()` responder que a tela é de celular. `vi.unstubAllGlobals()` desfaz. */
export function simularCelular(): void {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta === "(max-width: 767px)",
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
