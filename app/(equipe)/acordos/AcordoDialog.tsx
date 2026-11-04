"use client";

import { Alert, Button, Card, Dialog, Input, Radio, Select } from "edson-alexandre-design-system";
import { useEffect, useMemo, useState } from "react";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { centsFromMasked, centsToApi, formatBRL, maskMoney, parsePercent } from "@/app/lib/money";
import { formatDate } from "@/app/(equipe)/condominios/format";
import type { Condominio } from "@/app/(equipe)/condominios/types";
import { listDevedores } from "@/app/(equipe)/devedores/api";
import { DevedorDialog } from "@/app/(equipe)/devedores/DevedorDialog";
import type { Devedor } from "@/app/(equipe)/devedores/types";
import { assignLawyer, createAcordo } from "./api";
import { buildPreview, feeFromPercent } from "./plan";
import type { Acordo, Advogado } from "./types";

type Props = {
  condominios: Condominio[];
  advogados: Advogado[];
  onClose: () => void;
  /** `aviso` traz o que não saiu como esperado, mesmo com o acordo cadastrado. */
  onSaved: (acordo: Acordo, aviso: string | null) => void;
};

type Campo = "condominium_id" | "debtor_id" | "total_amount" | "fee" | "installment_count" | "first_due_date";
type FormErrors = Partial<Record<Campo, string>>;

const AVISO_RESPONSAVEL = "O acordo foi cadastrado, mas não foi possível atribuir o responsável. Tente de novo em Detalhes do acordo.";

export function AcordoDialog({ condominios, advogados, onClose, onSaved }: Props) {
  const [condominioId, setCondominioId] = useState("");
  const [devedorId, setDevedorId] = useState("");
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [recarregarDevedores, setRecarregarDevedores] = useState(0);
  const [novoDevedor, setNovoDevedor] = useState(false);
  const [total, setTotal] = useState("");
  const [modoHonorarios, setModoHonorarios] = useState<"percentual" | "valor">("percentual");
  const [percentual, setPercentual] = useState("");
  const [valorHonorarios, setValorHonorarios] = useState("");
  const [parcelas, setParcelas] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [advogadoId, setAdvogadoId] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!condominioId) return;
    const controller = new AbortController();
    listDevedores("", condominioId, controller.signal)
      .then(setDevedores)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setFormError(e instanceof ApiError ? e.message : "Não foi possível carregar os devedores.");
      });
    return () => controller.abort();
  }, [condominioId, recarregarDevedores]);

  const totalCentavos = centsFromMasked(total);
  const honorarios = modoHonorarios === "percentual" ? (parsePercent(percentual) === null ? null : feeFromPercent(totalCentavos, parsePercent(percentual) as bigint)) : valorHonorarios ? centsFromMasked(valorHonorarios) : null;
  const quantidade = Number(parcelas);
  const previa = useMemo(() => buildPreview(totalCentavos, honorarios, quantidade, vencimento), [totalCentavos, honorarios, quantidade, vencimento]);
  const devedor = devedores.find((d) => d.id === devedorId);

  function limpar(campo: Campo) {
    setErrors((atual) => ({ ...atual, [campo]: undefined }));
  }

  function validar(): FormErrors {
    const erros: FormErrors = {};
    if (!condominioId) erros.condominium_id = "Selecione o condomínio.";
    if (!devedorId) erros.debtor_id = "Selecione o devedor.";
    if (totalCentavos <= 0n) erros.total_amount = "Informe o valor total da dívida.";
    if (honorarios === null) erros.fee = modoHonorarios === "percentual" ? "Informe um percentual de 0 a 100." : "Informe o valor dos honorários.";
    else if (honorarios > totalCentavos) erros.fee = "Os honorários não podem ser maiores que o valor total.";
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 120) erros.installment_count = "Informe de 1 a 120 parcelas.";
    else if (totalCentavos > 0n && totalCentavos / BigInt(quantidade) === 0n) erros.installment_count = "Cada parcela precisa ter pelo menos R$ 0,01.";
    if (!vencimento) erros.first_due_date = "Informe o primeiro vencimento.";
    return erros;
  }

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const encontrados = validar();
    setErrors(encontrados);
    setFormError(null);
    if (Object.keys(encontrados).length > 0) return;

    setSaving(true);
    try {
      const percentualEmCentesimos = parsePercent(percentual);
      const criado = await createAcordo({
        condominium_id: condominioId,
        debtor_id: devedorId,
        total_amount: centsToApi(totalCentavos),
        installment_count: quantidade,
        first_due_date: vencimento,
        fee_percentage: modoHonorarios === "percentual" && percentualEmCentesimos !== null ? centsToApi(percentualEmCentesimos) : null,
        fee_amount: modoHonorarios === "valor" ? centsToApi(centsFromMasked(valorHonorarios)) : null,
      });
      if (!advogadoId) {
        onSaved(criado, null);
        return;
      }
      // O acordo já existe aqui: uma falha na atribuição não pode parecer falha no cadastro.
      try {
        onSaved(await assignLawyer(criado.id, advogadoId), null);
      } catch {
        onSaved(criado, AVISO_RESPONSAVEL);
      }
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const { fee_percentage, fee_amount, ...demais } = error.fieldErrors;
        setErrors({ ...demais, fee: fee_percentage ?? fee_amount });
      } else {
        setFormError(error instanceof ApiError ? error.message : "Não foi possível salvar o acordo. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open
        width={640}
        title="Novo acordo"
        description="Cadastro de acordo extrajudicial."
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="acordo-form" loading={saving}>
              Salvar acordo
            </Button>
          </>
        }
      >
        <form id="acordo-form" onSubmit={submit} noValidate className="flex max-h-[60vh] flex-col [&>*]:shrink-0 gap-4 overflow-y-auto pr-1">
          {formError && (
            <Alert tone="risk" role="alert" title="Não foi possível salvar">
              {formError}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="acordo-condominio" label="Condomínio" required>
              <Select
                id="acordo-condominio"
                placeholder="Selecione"
                options={condominios.map((c) => ({ value: c.id, label: c.nome }))}
                value={condominioId}
                invalid={Boolean(errors.condominium_id)}
                onChange={(e) => {
                  setCondominioId(e.target.value);
                  setDevedorId("");
                  setDevedores([]);
                  limpar("condominium_id");
                }}
              />
              {errors.condominium_id && <span role="alert" className="text-sm text-red-700">{errors.condominium_id}</span>}
            </Field>
            <Field id="acordo-devedor" label="Devedor" required hint="cadastrado no condomínio">
              <Select
                id="acordo-devedor"
                placeholder={condominioId ? "Selecione" : "Escolha o condomínio primeiro"}
                options={devedores.map((d) => ({ value: d.id, label: `${d.name} · ${d.unit}` }))}
                value={devedorId}
                disabled={!condominioId}
                invalid={Boolean(errors.debtor_id)}
                onChange={(e) => {
                  setDevedorId(e.target.value);
                  limpar("debtor_id");
                }}
              />
              {errors.debtor_id && <span role="alert" className="text-sm text-red-700">{errors.debtor_id}</span>}
              {condominioId && (
                <button type="button" className="self-start text-sm underline" onClick={() => setNovoDevedor(true)}>
                  Cadastrar novo devedor
                </button>
              )}
            </Field>
          </div>

          <Field id="acordo-unidade" label="Unidade">
            <Input id="acordo-unidade" value={devedor?.unit ?? ""} disabled onChange={() => {}} />
          </Field>

          <Field id="acordo-total" label="Valor total da dívida" required>
            <Input id="acordo-total" icon="banknote" mono inputMode="numeric" placeholder="0,00" value={total} invalid={Boolean(errors.total_amount)} error={errors.total_amount} onChange={(e) => { setTotal(maskMoney(e.target.value)); limpar("total_amount"); }} />
          </Field>

          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-medium">Honorários do escritório <span className="text-red-700">*</span></legend>
            <div className="flex gap-4">
              <Radio name="modo-honorarios" value="percentual" label="Percentual" checked={modoHonorarios === "percentual"} onChange={() => { setModoHonorarios("percentual"); limpar("fee"); }} />
              <Radio name="modo-honorarios" value="valor" label="Valor fixo" checked={modoHonorarios === "valor"} onChange={() => { setModoHonorarios("valor"); limpar("fee"); }} />
            </div>
            {modoHonorarios === "percentual" ? (
              <Input id="acordo-honorarios" aria-label="Percentual de honorários" icon="percent" mono inputMode="decimal" placeholder="20" value={percentual} invalid={Boolean(errors.fee)} error={errors.fee} onChange={(e) => { setPercentual(e.target.value); limpar("fee"); }} />
            ) : (
              <Input id="acordo-honorarios" aria-label="Valor dos honorários" icon="banknote" mono inputMode="numeric" placeholder="0,00" value={valorHonorarios} invalid={Boolean(errors.fee)} error={errors.fee} onChange={(e) => { setValorHonorarios(maskMoney(e.target.value)); limpar("fee"); }} />
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="acordo-parcelas" label="Parcelas" required>
              <Input id="acordo-parcelas" type="number" min={1} max={120} mono value={parcelas} invalid={Boolean(errors.installment_count)} error={errors.installment_count} onChange={(e) => { setParcelas(e.target.value); limpar("installment_count"); }} />
            </Field>
            <Field id="acordo-vencimento" label="1º vencimento" required>
              <Input id="acordo-vencimento" type="date" value={vencimento} invalid={Boolean(errors.first_due_date)} error={errors.first_due_date} onChange={(e) => { setVencimento(e.target.value); limpar("first_due_date"); }} />
            </Field>
          </div>

          {previa && (
            <Card tone="sunken" aria-label="Parcelamento gerado">
              <p className="ea-eyebrow">Parcelamento gerado</p>
              <p className="mt-2 font-semibold">
                {previa.parcelas} {previa.parcelas === 1 ? "parcela" : "parcelas"} de {formatBRL(previa.valorDaParcela)}
                {previa.valorDaUltima !== previa.valorDaParcela && ` (a última de ${formatBRL(previa.valorDaUltima)})`}
              </p>
              <p className="mt-1 text-sm">
                {formatBRL(previa.condominioPorParcela)} para o condomínio + {formatBRL(previa.honorariosPorParcela)} de honorários na primeira parcela.
              </p>
              <p className="mt-1 text-sm">
                De {formatDate(previa.primeiroVencimento)} a {formatDate(previa.ultimoVencimento)}. Você pode editar valor ou data de uma parcela específica depois de salvar.
              </p>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                <dt>Total do acordo</dt>
                <dd className="text-right font-semibold">{formatBRL(previa.total)}</dd>
                <dt>Honorários</dt>
                <dd className="text-right font-semibold">{formatBRL(previa.honorarios)}</dd>
                <dt>Repasse ao condomínio</dt>
                <dd className="text-right font-semibold">{formatBRL(previa.repasse)}</dd>
              </dl>
            </Card>
          )}

          <Field id="acordo-advogado" label="Advogado responsável" hint="só usuários com OAB">
            <Select id="acordo-advogado" placeholder="Atribuir depois" options={advogados.map((a) => ({ value: a.id, label: a.name }))} value={advogadoId} onChange={(e) => setAdvogadoId(e.target.value)} />
          </Field>

          <p className="text-sm">O acordo fica vinculado ao condomínio e aparece para o Cliente correspondente.</p>
        </form>
      </Dialog>

      {novoDevedor && (
        <DevedorDialog
          condominios={condominios}
          condominioInicial={condominioId}
          onClose={() => setNovoDevedor(false)}
          onSaved={(salvo) => {
            setNovoDevedor(false);
            setCondominioId(salvo.condominium_id);
            setDevedorId(salvo.id);
            setRecarregarDevedores((n) => n + 1);
            limpar("debtor_id");
          }}
          onUseExisting={(existente) => {
            setNovoDevedor(false);
            setCondominioId(existente.condominium_id);
            setDevedorId(existente.id);
            limpar("debtor_id");
          }}
        />
      )}
    </>
  );
}
