import { FieldLabel } from "edson-alexandre-design-system";
import type { ReactNode } from "react";

/** Rótulo + controle de um campo de formulário (o `id` liga o rótulo ao controle). */
export function Field({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor={id} required={required} hint={hint}>
        {label}
      </FieldLabel>
      {children}
    </div>
  );
}

/** Grupo de campos de um formulário, em duas colunas a partir do breakpoint `sm`. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid grid-cols-1 gap-4 border-0 p-0 sm:grid-cols-2">
      <legend className="mb-2 text-sm font-semibold uppercase tracking-wide">{title}</legend>
      {children}
    </fieldset>
  );
}
