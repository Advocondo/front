"use client";

import { IconButton } from "edson-alexandre-design-system";
import { hojeEmBrasilia } from "@/app/lib/dates";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export type Mes = { ano: number; mes: number };

export function mesAtual(): Mes {
  const [ano, mes] = hojeEmBrasilia().split("-").map(Number);
  return { ano, mes };
}

export const nomeDoMes = ({ ano, mes }: Mes): string => `${MESES[mes - 1]} ${ano}`;

/** Navega mês a mês, em Faturas do mês, Metas e no Painel. */
export function SeletorDeMes({ ano, mes, onChange }: Mes & { onChange: (periodo: Mes) => void }) {
  function mudar(delta: number) {
    const indice = ano * 12 + (mes - 1) + delta;
    onChange({ ano: Math.floor(indice / 12), mes: (indice % 12) + 1 });
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <IconButton icon="chevron-left" label="Mês anterior" onClick={() => mudar(-1)} />
      <h2 className="min-w-48 text-center text-xl font-semibold" style={{ fontFamily: "var(--font-sans)" }}>
        {nomeDoMes({ ano, mes })}
      </h2>
      <IconButton icon="chevron-right" label="Próximo mês" onClick={() => mudar(1)} />
    </div>
  );
}
