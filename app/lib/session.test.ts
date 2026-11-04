import { afterEach, describe, expect, it } from "vitest";
import { clearSession, getSession, saveSession, type Session } from "./session";

const session: Session = {
  token: "abc",
  expiresAt: "2999-01-01T00:00:00Z",
  user: { id: "1", name: "Ana", email: "ana@example.com", role: "admin" },
};

afterEach(() => clearSession());

describe("sessão", () => {
  it("com Manter conectado, guarda no localStorage", () => {
    saveSession(session, true);
    expect(localStorage.length).toBe(1);
    expect(sessionStorage.length).toBe(0);
    expect(getSession()).toEqual(session);
  });

  it("sem Manter conectado, guarda só no sessionStorage", () => {
    saveSession(session, false);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
    expect(getSession()).toEqual(session);
  });

  it("um novo login substitui a sessão anterior", () => {
    saveSession(session, true);
    saveSession({ ...session, token: "novo" }, false);
    expect(localStorage.length).toBe(0);
    expect(getSession()?.token).toBe("novo");
  });

  it("ignora sessão expirada", () => {
    saveSession({ ...session, expiresAt: "2000-01-01T00:00:00Z" }, true);
    expect(getSession()).toBeNull();
  });

  it("ignora conteúdo corrompido", () => {
    localStorage.setItem("advocondo.session", "{quebrado");
    expect(getSession()).toBeNull();
    localStorage.clear();
  });

  it("clearSession apaga dos dois lugares", () => {
    saveSession(session, true);
    clearSession();
    expect(localStorage.length).toBe(0);
    expect(getSession()).toBeNull();
  });
});
