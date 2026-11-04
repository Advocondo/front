import { useMemo, useSyncExternalStore } from "react";

export type Role = "admin" | "operator" | "client";

export type Session = {
  token: string;
  expiresAt: string;
  user: { id: string; name: string; email: string; role: Role };
};

const CHAVE = "advocondo.session";
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function lerBruto(): string | null {
  return sessionStorage.getItem(CHAVE) ?? localStorage.getItem(CHAVE);
}

function interpretar(bruto: string | null): Session | null {
  if (!bruto) return null;
  try {
    const session = JSON.parse(bruto) as Session;
    return new Date(session.expiresAt).getTime() > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return interpretar(lerBruto());
}

/** "Manter conectado" guarda a sessão entre aberturas do navegador; sem ele, ela acaba com a aba. */
export function saveSession(session: Session, manterConectado: boolean) {
  localStorage.removeItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
  (manterConectado ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(session));
  avisar();
}

export function clearSession() {
  localStorage.removeItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
  avisar();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  // O evento "storage" traz o login ou a saída feitos em outra aba.
  window.addEventListener("storage", ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    window.removeEventListener("storage", ouvinte);
  };
}

/** `undefined` enquanto a sessão não pode ser lida (servidor e hidratação); `null` sem sessão. */
export function useSession(): Session | null | undefined {
  const bruto = useSyncExternalStore<string | null | undefined>(assinar, lerBruto, () => undefined);
  return useMemo(() => (bruto === undefined ? undefined : interpretar(bruto)), [bruto]);
}
