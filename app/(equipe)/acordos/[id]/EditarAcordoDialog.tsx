"use client";

import { Alert, Button, Checkbox, Dialog, Input, Radio, Select } from "edson-alexandre-design-system";
import { useEffect, useState, type FormEvent } from "react";
import { listDevedores } from "@/app/(equipe)/devedores/api";
import type { Devedor } from "@/app/(equipe)/devedores/types";
import { Field } from "@/app/components/FormField";
import { ApiError } from "@/app/lib/api";
import { centsFromApi, centsFromMasked, centsToApi, formatBRL, maskMoney, parsePercent } from "@/app/lib/money";
import { atualizarAcordo, type MudancasNoAcordo } from "../api";
import { feeFromPercent } from "../plan";
import type { Acordo } from "../types";

type Props = {
  acordo: Acordo;
  /** Quantas parcelas pagas a tela conhece. O back confere de novo ao salvar. */
  parcelasPagas: number;
  onClose: () => void;
  onSaved: () => void;
};

type Erros = { debtor_id?: string; total_amount?: string; fee?: string };

/** "20.00" -> "20"; "12.50" -> "12,5". */
const percentualNaTela = (valor: string): string => valor.replace(/\.?0+$/, "").replace(".", ",");

/** US19. Número e datas das parcelas continuam sendo editados parcela a parcela. */
export function EditarAcordoDialog({ acordo, parcelasPagas, onClose, onSaved }: Props) {
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [devedorId, setDevedorId] = useState(acordo.debtor.id);
  const [total, setTotal] = useState(() => maskMoney(acordo.total_amount));
  const [modo, setModo] = useState<"percentual" | "valor">(acordo.fee_percentage ? "percentual" : "valor");
  const [percentual, setPercentual] = useState(acordo.fee_percentage ? percentualNaTela(acordo.fee_percentage) : "");
  const [valorHonorarios, setValorHonorarios] = useState(() => maskMoney(acordo.fee_amount));
  const [confirmou, setConfirmou] = useState(false);
  const [backPediuConfirmacao, setBackPediuConfirmacao] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listDevedores("", acordo.condominium.id, controller.signal)
      .then(setDevedores)
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os devedores.");
      });
    return () => controller.abort();
  }, [acordo.condominium.id]);

  const totalCentavos = centsFromMasked(total);
  const percentualCentesimos = parsePercent(percentual);
  const honorarios = modo === "percentual" ? (percentualCentesimos === null ? null : feeFromPercent(totalCentavos, percentualCentesimos)) : valorHonorarios ? centsFromMasked(valorHonorarios) : null;

  const mudouDevedor = devedorId !== acordo.debtor.id;
  const mudouTotal = totalCentavos !== centsFromApi(acordo.total_amount);
  const mudouPercentual = modo === "percentual" && (acordo.fee_percentage === null || percentualCentesimos !== centsFromApi(acordo.fee_percentage));
  const mudouValor = modo === "valor" && (acordo.fee_percentage !== null || centsFromMasked(valorHonorarios) !== centsFromApi(acordo.fee_amount));
  const mudouAlgo = mudouDevedor || mudouTotal || mudouPercentual || mudouValor;
  const precisaConfirmar = parcelasPagas > 0 || backPediuConfirmacao;

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    const invalidos: Erros = {
      total_amount: totalCentavos > 0n ? undefined : "Informe o valor total da dívida.",
      fee: honorarios === null ? (modo === "percentual" ? "Informe um percentual de 0 a 100." : "Informe o valor dos honorários.") : honorarios > totalCentavos ? "Os honorários não podem ser maiores que o valor total." : undefined,
    };
    setErros(invalidos);
    if (Object.values(invalidos).some(Boolean)) return;
    if (precisaConfirmar && !confirmou) {
      setErro("Marque a confirmação para alterar um acordo com parcelas pagas.");
      return;
    }

    const mudancas: MudancasNoAcordo = {
      ...(mudouDevedor && { debtor_id: devedorId }),
      ...(mudouTotal && { total_amount: centsToApi(totalCentavos) }),
      ...(mudouPercentual && percentualCentesimos !== null && { fee_percentage: centsToApi(percentualCentesimos) }),
      ...(mudouValor && { fee_amount: centsToApi(centsFromMasked(valorHonorarios)) }),
      confirm_paid_installments: confirmou,
    };
    setSaving(true);
    try {
      await atualizarAcordo(acordo.id, mudancas);
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Alguém deu baixa depois de a tela abrir: agora há parcela paga, e a confirmação aparece.
        setBackPediuConfirmacao(true);
        setErro(e.message);
      } else if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        const { fee_percentage, fee_amount, ...demais } = e.fieldErrors;
        setErros({ ...demais, fee: fee_percentage ?? fee_amount });
      } else {
        setErro(e instanceof ApiError ? e.message : "Não foi possível salvar o acordo. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      width={600}
      title="Editar acordo"
      description={`${acordo.condominium.name} · ${acordo.debtor.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Voltar
          </Button>
          <Button type="submit" form="editar-acordo-form" loading={saving} disabled={!mudouAlgo}>
            Salvar alterações
          </Button>
        </>
      }
    >
      <form id="editar-acordo-form" onSubmit={salvar} noValidate className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1 [&>*]:shrink-0">
        {erro && (
          <Alert tone="risk" role="alert" title="Não foi possível salvar">
            {erro}
          </Alert>
        )}
        {precisaConfirmar && (
          <Alert tone="warn" title={parcelasPagas === 1 ? "Este acordo tem 1 parcela paga" : parcelasPagas > 1 ? `Este acordo tem ${parcelasPagas} parcelas pagas` : "Este acordo tem parcelas pagas"}>
            As parcelas pagas não mudam: um valor novo recalcula só as em aberto. A alteração fica registrada com o seu nome.
          </Alert>
        )}

        <Field id="editar-devedor" label="Devedor" hint="do mesmo condomínio">
          <Select
            id="editar-devedor"
            options={devedores.length > 0 ? devedores.map((d) => ({ value: d.id, label: `${d.name} · ${d.unit}` })) : [{ value: acordo.debtor.id, label: `${acordo.debtor.name} · ${acordo.debtor.unit}` }]}
            value={devedorId}
            invalid={Boolean(erros.debtor_id)}
            onChange={(e) => setDevedorId(e.target.value)}
          />
          {erros.debtor_id && <span role="alert" className="text-sm text-red-700">{erros.debtor_id}</span>}
        </Field>

        <Field id="editar-total" label="Valor total da dívida" required hint="renegociado">
          <Input id="editar-total" icon="banknote" mono inputMode="numeric" value={total} invalid={Boolean(erros.total_amount)} error={erros.total_amount} onChange={(e) => setTotal(maskMoney(e.target.value))} />
        </Field>

        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 text-sm font-medium">Honorários do escritório <span className="text-red-700">*</span></legend>
          <div className="flex gap-4">
            <Radio name="editar-modo-honorarios" value="percentual" label="Percentual" checked={modo === "percentual"} onChange={() => setModo("percentual")} />
            <Radio name="editar-modo-honorarios" value="valor" label="Valor fixo" checked={modo === "valor"} onChange={() => setModo("valor")} />
          </div>
          {modo === "percentual" ? (
            <Input id="editar-honorarios" aria-label="Percentual de honorários" icon="percent" mono inputMode="decimal" value={percentual} invalid={Boolean(erros.fee)} error={erros.fee} onChange={(e) => setPercentual(e.target.value)} />
          ) : (
            <Input id="editar-honorarios" aria-label="Valor dos honorários" icon="banknote" mono inputMode="numeric" value={valorHonorarios} invalid={Boolean(erros.fee)} error={erros.fee} onChange={(e) => setValorHonorarios(maskMoney(e.target.value))} />
          )}
          {honorarios !== null && honorarios <= totalCentavos && <p className="text-sm">{`Honorários de ${formatBRL(honorarios)}, com ${formatBRL(totalCentavos - honorarios)} de repasse ao condomínio.`}</p>}
        </fieldset>

        {precisaConfirmar && <Checkbox label="Confirmo a alteração em um acordo com parcelas pagas" checked={confirmou} onChange={(e) => setConfirmou(e.target.checked)} />}

        <p className="text-sm">O número de parcelas e os vencimentos são editados em cada parcela, na tabela do acordo.</p>
      </form>
    </Dialog>
  );
}
