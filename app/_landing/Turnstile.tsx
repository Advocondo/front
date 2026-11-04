"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Props = {
  siteKey: string;
  onToken: (token: string) => void;
  /** Mudar este valor pede um token novo: cada token só vale para um envio. */
  resetKey: number;
};

/** Widget do Cloudflare Turnstile. Em geral não pede nada ao visitante. */
export function Turnstile({ siteKey, onToken, resetKey }: Props) {
  const elemento = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!carregado || !elemento.current || !window.turnstile) return;
    const api = window.turnstile;
    const id = api.render(elemento.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    widgetId.current = id;
    return () => {
      api.remove(id);
      widgetId.current = null;
    };
  }, [carregado, siteKey, onToken]);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current) return;
    window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setCarregado(true)} />
      <div ref={elemento} />
    </>
  );
}
