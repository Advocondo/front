export type Aparelho = { nome: string; icone: "smartphone" | "tablet" | "monitor" };

const NAVEGADORES: [RegExp, string][] = [
  [/Edg/, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox|FxiOS/, "Firefox"],
  [/Chrome|CriOS/, "Chrome"],
  [/Safari/, "Safari"],
];

const SISTEMAS: [RegExp, string, Aparelho["icone"]][] = [
  [/iPhone/, "iPhone", "smartphone"],
  [/iPad/, "iPad", "tablet"],
  [/Android.*Mobile/, "Android", "smartphone"],
  [/Android/, "Android", "tablet"],
  [/Windows/, "Windows", "monitor"],
  [/Mac OS X/, "macOS", "monitor"],
  [/Linux/, "Linux", "monitor"],
];

/** "...(Windows NT 10.0)... Chrome/130.0" -> "Windows · Chrome". O cabeçalho é só uma pista, enviada pelo próprio navegador. */
export function descreverAparelho(userAgent: string | null): Aparelho {
  const sistema = userAgent ? SISTEMAS.find(([padrao]) => padrao.test(userAgent)) : undefined;
  const navegador = userAgent ? NAVEGADORES.find(([padrao]) => padrao.test(userAgent)) : undefined;
  const partes = [sistema?.[1], navegador?.[1]].filter(Boolean);
  return { nome: partes.length > 0 ? partes.join(" · ") : "Aparelho não identificado", icone: sistema?.[2] ?? "monitor" };
}
