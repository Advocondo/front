"use client";

import { Icon } from "edson-alexandre-design-system";
import Link from "next/link";
import { useEffect, useState } from "react";
import { contarNaoLidas } from "@/app/(equipe)/notificacoes/api";

const ate99 = (n: number): string => (n > 99 ? "99+" : String(n));

/**
 * O sino da barra superior (US30). A contagem é buscada ao abrir cada tela. Uma falha aqui
 * não atrapalha a tela: o sino só fica sem o número. `contagem` vem da tela de notificações,
 * que já sabe o número e o muda ao marcar como lida.
 */
export function SinoDeNotificacoes({ contagem }: { contagem?: number }) {
  const [buscada, setBuscada] = useState(0);
  const naoLidas = contagem ?? buscada;

  useEffect(() => {
    if (contagem !== undefined) return;
    const controller = new AbortController();
    contarNaoLidas(controller.signal)
      .then((pagina) => setBuscada(pagina.unread_count))
      .catch(() => {});
    return () => controller.abort();
  }, [contagem]);

  return (
    <Link href="/notificacoes" aria-label={naoLidas === 0 ? "Notificações" : `Notificações, ${naoLidas} ${naoLidas === 1 ? "não lida" : "não lidas"}`} className="relative inline-flex h-9 w-9 items-center justify-center rounded" style={{ color: "var(--text-body, inherit)" }}>
      <Icon name="bell" size={20} />
      {naoLidas > 0 && (
        <span aria-hidden className="absolute -right-1 -top-1 min-w-[18px] rounded-full px-1 text-center text-xs font-semibold text-white" style={{ background: "var(--red-600, #b91c1c)" }}>
          {ate99(naoLidas)}
        </span>
      )}
    </Link>
  );
}
