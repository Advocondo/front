import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, saveSession, type Role } from "@/app/lib/session";
import { RequireAuth } from "./RequireAuth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

function entrarComo(role: Role) {
  saveSession({ token: "abc", expiresAt: "2999-01-01T00:00:00Z", user: { id: "1", name: "Ana", email: "a@b.c", role } }, true);
}

const tela = (
  <RequireAuth roles={["admin", "operator"]}>
    <p>Conteúdo</p>
  </RequireAuth>
);

beforeEach(() => replace.mockClear());
afterEach(() => clearSession());

describe("RequireAuth", () => {
  it("sem sessão, esconde o conteúdo e leva ao login", async () => {
    render(tela);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Conteúdo")).not.toBeInTheDocument();
  });

  it("com o perfil exigido, mostra o conteúdo", () => {
    entrarComo("operator");
    render(tela);
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("com outro perfil, esconde o conteúdo e leva ao painel dele", async () => {
    entrarComo("client");
    render(tela);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/painel-cliente"));
    expect(screen.queryByText("Conteúdo")).not.toBeInTheDocument();
  });

  it("quando a sessão acaba, sai da tela", async () => {
    entrarComo("admin");
    render(tela);
    act(() => clearSession());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Conteúdo")).not.toBeInTheDocument();
  });
});
