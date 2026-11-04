/** "27.40" -> "27,4%". A barra para em 100%, mas o texto mostra quando a meta é superada. */
export const formatarPercentual = (valor: string): string => `${Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function BarraDeAtingimento({ percentual, rotulo }: { percentual: string; rotulo: string }) {
  const largura = Math.min(Number(percentual), 100);
  return (
    <div role="progressbar" aria-label={rotulo} aria-valuenow={Math.round(largura)} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded" style={{ background: "var(--stone-200)" }}>
      <div className="h-full" style={{ width: `${largura}%`, background: "var(--navy-600)" }} />
    </div>
  );
}
