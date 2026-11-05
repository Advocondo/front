"use client";

import { Alert, Badge, Button, Dialog, MetricCard, Select } from "edson-alexandre-design-system";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { Condominio } from "@/app/(equipe)/condominios/types";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { formatarTamanho, salvarArquivo } from "@/app/lib/arquivos";
import { baixarModeloDePlanilha, enviarPlanilha, type LinhaDaPlanilha, type ResultadoDaPlanilha } from "./api";

type Props = {
  condominios: Condominio[];
  condominioInicial: string;
  onClose: () => void;
  onImported: (aviso: string) => void;
};

const contar = (linhas: LinhaDaPlanilha[], status: LinhaDaPlanilha["status"]): number => linhas.filter((l) => l.status === status).length;

function motivo(linha: LinhaDaPlanilha): string {
  if (linha.status === "invalid") return linha.errors.join(" ");
  if (linha.repeats_row !== null) return `Repete a linha ${linha.repeats_row} da planilha.`;
  const parecidos = linha.similar_debtors.map((d) => `${d.name} (${d.unit})`).join(", ");
  return `Parecido com quem já está cadastrado: ${parecidos}.`;
}

const quem = (linha: LinhaDaPlanilha): string => [linha.values.name, linha.values.unit].filter(Boolean).join(" · ");

/** US14. Escolher o arquivo só valida (CA01); nada é gravado até a confirmação, que reenvia o mesmo arquivo. */
export function ImportarDialog({ condominios, condominioInicial, onClose, onImported }: Props) {
  const [condominioId, setCondominioId] = useState(condominioInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<ResultadoDaPlanilha | null>(null);
  const [validando, setValidando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const seletor = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!condominioId || !arquivo) return;
    const controller = new AbortController();
    enviarPlanilha(condominioId, arquivo, false, controller.signal)
      .then((resultado) => {
        setPrevia(resultado);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setPrevia(null);
        setErro(e instanceof ApiError ? e.message : "Não foi possível validar a planilha. Tente novamente.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setValidando(false);
      });
    return () => controller.abort();
  }, [condominioId, arquivo]);

  /** A prévia vale para um par de condomínio e arquivo: trocar qualquer um deles a invalida. */
  function aoTrocar() {
    setPrevia(null);
    setErro(null);
  }

  function escolher(event: ChangeEvent<HTMLInputElement>) {
    const escolhido = event.target.files?.[0] ?? null;
    // Limpa o campo para a mesma planilha, corrigida, poder ser escolhida de novo.
    event.target.value = "";
    if (!escolhido) return;
    aoTrocar();
    setArquivo(escolhido);
    setValidando(Boolean(condominioId));
  }

  function trocarCondominio(id: string) {
    aoTrocar();
    setCondominioId(id);
    setValidando(Boolean(id && arquivo));
  }

  async function baixarModelo() {
    setErro(null);
    try {
      salvarArquivo(await baixarModeloDePlanilha(), "modelo-inadimplentes.xlsx");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível baixar o modelo. Tente novamente.");
    }
  }

  async function importar() {
    if (!arquivo || !condominioId) return;
    setImportando(true);
    setErro(null);
    try {
      const resultado = await enviarPlanilha(condominioId, arquivo, true);
      const deFora = resultado.rows.length - resultado.imported;
      // A confirmação valida de novo: alguém pode ter cadastrado o mesmo devedor depois da prévia.
      if (resultado.imported === 0) {
        setPrevia(resultado);
        setErro("Nenhuma linha foi importada. Revise a validação abaixo.");
        return;
      }
      onImported(`${resultado.imported} ${resultado.imported === 1 ? "devedor importado" : "devedores importados"}${deFora > 0 ? `. ${deFora} ${deFora === 1 ? "linha ficou" : "linhas ficaram"} de fora` : ""}.`);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível importar a planilha. Tente novamente.");
    } finally {
      setImportando(false);
    }
  }

  const validas = previa ? contar(previa.rows, "valid") : 0;
  const problemas = previa?.rows.filter((l) => l.status !== "valid") ?? [];

  return (
    <Dialog
      open
      width={640}
      title="Importar inadimplentes"
      description="Planilha recebida do condomínio. Nada é gravado antes de você confirmar."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={importando}>
            Cancelar
          </Button>
          <Button icon="upload" loading={importando} disabled={validas === 0 || validando} onClick={() => void importar()}>
            {validas > 0 ? `Importar ${validas} ${validas === 1 ? "registro válido" : "registros válidos"}` : "Importar"}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1 [&>*]:shrink-0">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível concluir">
            {erro}
          </Alert>
        )}
        <Field id="importar-condominio" label="Condomínio" required>
          <Select id="importar-condominio" placeholder="Selecione" options={condominios.map((c) => ({ value: c.id, label: c.nome }))} value={condominioId} onChange={(e) => trocarCondominio(e.target.value)} />
        </Field>

        <div className="grid gap-2">
          <p className="text-sm font-medium">Planilha .xlsx, até 1 MB e 1000 linhas</p>
          <input ref={seletor} type="file" aria-label="Arquivo da planilha" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" tabIndex={-1} onChange={escolher} />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="secondary" icon="file-spreadsheet" onClick={() => seletor.current?.click()}>
              {arquivo ? "Trocar planilha" : "Escolher planilha"}
            </Button>
            {arquivo && <span className="min-w-0 truncate text-sm">{`${arquivo.name} · ${formatarTamanho(arquivo.size)}`}</span>}
          </div>
          <button type="button" className="justify-self-start text-sm underline" onClick={() => void baixarModelo()}>
            Baixar modelo de planilha
          </button>
        </div>

        {arquivo && !condominioId && <p className="text-sm">Selecione o condomínio para validar a planilha.</p>}
        {validando && <p role="status">Validando a planilha…</p>}

        {previa && !validando && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard label="Linhas válidas" icon="circle-check" value={String(validas)} footnote="prontas para importar" />
              <MetricCard label="Ficam de fora" icon="triangle-alert" value={String(problemas.length)} footnote="com erro ou parecidas" />
            </div>
            {problemas.length > 0 && (
              <ul className="grid gap-3">
                {problemas.map((linha) => (
                  <li key={linha.number} className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{`Linha ${linha.number}${quem(linha) ? ` · ${quem(linha)}` : ""}`}</p>
                      <p className="text-sm">{motivo(linha)}</p>
                    </div>
                    <Badge tone={linha.status === "invalid" ? "risk" : "warn"}>{linha.status === "invalid" ? "Erro" : "Parecido"}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {problemas.length > 0 && (
              <Alert tone="info" title="As linhas que ficam de fora não são gravadas">
                Corrija os erros na planilha e importe de novo. Se um parecido for outra pessoa, cadastre em Novo devedor.
              </Alert>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
