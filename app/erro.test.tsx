import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErroDaTela from "./error";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

afterEach(() => captureException.mockClear());

describe("Página de erro", () => {
  it("avisa em português, sem mostrar o erro técnico, e envia o erro ao monitoramento", () => {
    const erro = new Error("detalhe técnico com dado interno");
    render(<ErroDaTela error={erro} retry={() => {}} />);
    expect(screen.getByText("Algo deu errado nesta tela")).toBeInTheDocument();
    expect(screen.queryByText(/detalhe técnico/)).not.toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(erro);
  });

  it("deixa tentar de novo", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(<ErroDaTela error={new Error("x")} retry={retry} />);
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
