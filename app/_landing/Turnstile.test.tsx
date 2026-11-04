import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Turnstile } from "./Turnstile";

// O next/script só carrega de verdade no navegador; aqui ele avisa logo que está pronto.
vi.mock("next/script", async () => {
  const { useEffect } = await import("react");
  return {
    default: function Script({ onReady }: { onReady: () => void }) {
      useEffect(() => onReady(), [onReady]);
      return null;
    },
  };
});

const api = { render: vi.fn(() => "widget-1"), reset: vi.fn(), remove: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("turnstile", api);
});
afterEach(() => vi.unstubAllGlobals());

describe("Turnstile", () => {
  it("desenha o widget com a chave pública", () => {
    render(<Turnstile siteKey="chave" onToken={vi.fn()} resetKey={0} />);
    expect(api.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: "chave" }));
  });

  it("entrega o token e o apaga quando ele expira ou dá erro", () => {
    const onToken = vi.fn();
    render(<Turnstile siteKey="chave" onToken={onToken} resetKey={0} />);
    const opcoes = (api.render.mock.calls as unknown as [HTMLElement, Record<string, (token?: string) => void>][])[0][1];
    opcoes.callback("token");
    expect(onToken).toHaveBeenLastCalledWith("token");
    opcoes["expired-callback"]();
    expect(onToken).toHaveBeenLastCalledWith("");
    opcoes["error-callback"]();
    expect(onToken).toHaveBeenLastCalledWith("");
  });

  it("pede um token novo a cada envio, e não ao aparecer", () => {
    const onToken = vi.fn();
    const { rerender } = render(<Turnstile siteKey="chave" onToken={onToken} resetKey={0} />);
    expect(api.reset).not.toHaveBeenCalled();
    rerender(<Turnstile siteKey="chave" onToken={onToken} resetKey={1} />);
    expect(api.reset).toHaveBeenCalledWith("widget-1");
  });

  it("remove o widget ao sair da tela", () => {
    const { unmount } = render(<Turnstile siteKey="chave" onToken={vi.fn()} resetKey={0} />);
    unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });
});
