"use client";

import { Alert, Button } from "edson-alexandre-design-system";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { apiBaseUrl } from "@/app/lib/api-url";
import type { LandingContent } from "@/app/_landing/types";
import { descartarFotoEquipe, enviarFotoEquipe, getConteudoInstitucional, salvarSecao, type LandingSection } from "./api";

const SECOES: { id: LandingSection; label: string }[] = [
  { id: "hero", label: "Apresentação" },
  { id: "practice_areas", label: "Áreas de atuação" },
  { id: "online_service", label: "Assessoria online" },
  { id: "condominium_advisory", label: "Assessoria condominial" },
  { id: "reviews", label: "Avaliações" },
  { id: "why_us", label: "Por que nos escolher" },
  { id: "team", label: "Equipe" },
  { id: "contact_form", label: "Formulário de contato" },
  { id: "visit", label: "Visita" },
  { id: "contact", label: "Contato e redes sociais" },
];

const ROTULOS: Record<string, string> = {
  title: "Título", subtitle: "Subtítulo", button_label: "Texto do botão", text: "Texto", description: "Descrição",
  closing_text: "Texto de encerramento", paragraphs: "Parágrafos", areas: "Áreas", author: "Autor", author_details: "Detalhes do autor",
  rating: "Nota (1 a 5)", reviews: "Avaliações", call_to_review_title: "Título do convite", call_to_review_text: "Texto do convite",
  google_reviews_url: "Link das avaliações no Google", members: "Integrantes", name: "Nome", role: "Cargo ou função", photo_id: "Foto",
  highlights: "Destaques", phone: "Telefone", whatsapp: "WhatsApp", email: "E-mail", address: "Endereço", opening_hours: "Horário de atendimento",
  facebook_url: "Facebook", instagram_url: "Instagram",
};

const MODELOS: Record<string, unknown> = {
  areas: { title: "", description: "" },
  reviews: { author: "", author_details: null, rating: 5, text: "" },
  members: { name: "", role: "", photo_id: null },
  paragraphs: "",
  highlights: "",
};
const CAMPOS_NULAVEIS = new Set(["author_details", "google_reviews_url", "phone", "whatsapp", "email", "address", "opening_hours", "facebook_url", "instagram_url"]);

function tituloCampo(key: string) {
  return ROTULOS[key] ?? key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function substituir(value: unknown, path: (string | number)[], next: unknown): unknown {
  if (path.length === 0) return next;
  const [first, ...rest] = path;
  if (Array.isArray(value)) {
    const copia = [...value];
    copia[first as number] = substituir(copia[first as number], rest, next);
    return copia;
  }
  const copia = { ...(value as Record<string, unknown>) };
  copia[first as string] = substituir(copia[first as string], rest, next);
  return copia;
}

function CampoRecursivo({
  value, path, onChange, onUploadPhoto, uploadingPhoto,
}: {
  value: unknown; path: (string | number)[]; onChange: (path: (string | number)[], next: unknown) => void;
  onUploadPhoto?: (memberIndex: number, file: File) => void; uploadingPhoto?: boolean;
}) {
  const key = String(path.at(-1) ?? "");
  const id = `landing-${path.join("-")}`;
  const controlClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20";

  if (Array.isArray(value)) {
    const template = MODELOS[key];
    return (
      <div className="grid gap-3 sm:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-800">{tituloCampo(key)}</span>
          <button type="button" className="text-sm font-medium text-blue-800 underline" onClick={() => onChange(path, [...value, structuredClone(template ?? "")])}>
            Adicionar {key === "members" ? "integrante" : key === "reviews" ? "avaliação" : key === "areas" ? "área" : "item"}
          </button>
        </div>
        {value.length === 0 && <p className="text-sm text-slate-500">Nenhum item cadastrado.</p>}
        {value.map((item, index) => (
          <div key={`${id}-${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
            {typeof item === "object" && item !== null ? (
              Object.entries(item).map(([childKey, childValue]) => (
                <CampoRecursivo
                  key={`${id}-${index}-${childKey}`}
                  value={childValue}
                  path={[...path, index, childKey]}
                  onChange={onChange}
                  onUploadPhoto={onUploadPhoto}
                  uploadingPhoto={uploadingPhoto}
                />
              ))
            ) : (
              <label className="grid gap-1 text-sm font-medium text-slate-800" htmlFor={`${id}-${index}`}>
                {tituloCampo(key)} {index + 1}
                <textarea id={`${id}-${index}`} className={controlClass} rows={2} value={String(item ?? "")} onChange={(event) => onChange([...path, index], event.target.value)} />
              </label>
            )}
            <div className="flex items-center justify-end sm:col-span-2">
              <button type="button" className="text-sm text-red-700 underline" onClick={() => onChange(path, value.filter((_, i) => i !== index))}>Remover item</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    return <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">{Object.entries(value).map(([childKey, childValue]) => <CampoRecursivo key={`${id}-${childKey}`} value={childValue} path={[...path, childKey]} onChange={onChange} onUploadPhoto={onUploadPhoto} uploadingPhoto={uploadingPhoto} />)}</div>;
  }

  if (key === "photo_id" && path[0] === "team") {
    const memberIndex = path[2] as number;
    return (
      <div className="grid gap-2">
        <span className="text-sm font-medium text-slate-800">Foto do integrante</span>
        {typeof value === "string" && <img className="h-24 w-24 rounded-full border border-slate-200 object-cover" src={`${apiBaseUrl()}/landing/images/${encodeURIComponent(value)}`} alt="Foto atual do integrante" />}
        {value === null && <span className="text-sm text-slate-500">Nenhuma foto selecionada.</span>}
        <input
          aria-label={`Enviar foto do integrante ${memberIndex + 1}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploadingPhoto}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onUploadPhoto?.(memberIndex, file);
            event.currentTarget.value = "";
          }}
        />
        {value !== null && <button type="button" className="justify-self-start text-sm text-red-700 underline" onClick={() => onChange(path, null)}>Remover foto</button>}
        <span className="text-xs text-slate-500">PNG, JPEG ou WebP.</span>
      </div>
    );
  }

  const nullable = value === null || CAMPOS_NULAVEIS.has(key);
  const rating = key === "rating";
  const text = typeof value === "string" || nullable;
  const multiline = text && ["text", "description", "subtitle", "closing_text", "paragraphs", "highlights", "call_to_review_text", "address", "opening_hours"].includes(key);
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-800" htmlFor={id}>
      {tituloCampo(key)}
      {multiline ? (
        <textarea id={id} className={controlClass} rows={3} value={String(value ?? "")} onChange={(event) => onChange(path, nullable && !event.target.value ? null : event.target.value)} />
      ) : (
        <input
          id={id}
          className={controlClass}
          type={rating ? "number" : "text"}
          min={rating ? 1 : undefined}
          max={rating ? 5 : undefined}
          step={rating ? 1 : undefined}
          value={String(value ?? "")}
          onChange={(event) => onChange(path, rating ? Number(event.target.value) : nullable && !event.target.value ? null : event.target.value)}
        />
      )}
    </label>
  );
}

function mensagemErro(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 422 && Object.keys(error.fieldErrors).length) {
      return `Revise os campos: ${Object.entries(error.fieldErrors).map(([field, message]) => `${tituloCampo(field)}: ${message}`).join("; ")}`;
    }
    return error.status === 403 ? "Seu perfil não tem permissão para editar o conteúdo institucional." : error.message;
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export function InstitucionalView() {
  const [content, setContent] = useState<LandingContent | null>(null);
  const [draft, setDraft] = useState<LandingContent | null>(null);
  const [selected, setSelected] = useState<LandingSection>("hero");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUpload, setPhotoUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const uploadedIds = useRef(new Set<string>());
  const selectedSection = useMemo(() => SECOES.find((section) => section.id === selected)!, [selected]);

  useEffect(() => {
    const controller = new AbortController();
    getConteudoInstitucional(controller.signal)
      .then((current) => { setContent(current); setDraft(structuredClone(current)); setError(null); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(mensagemErro(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  function change(path: (string | number)[], next: unknown) {
    setDraft((current) => current ? substituir(current, path, next) as LandingContent : current);
    setError(null);
    setSuccess(null);
    setWarning(null);
  }

  async function descartarUploadsSemUso(emUso: Set<string>) {
    const semUso = [...uploadedIds.current].filter((id) => !emUso.has(id));
    const resultados = await Promise.allSettled(semUso.map(async (id) => {
      await descartarFotoEquipe(id);
      uploadedIds.current.delete(id);
    }));
    return resultados.some((resultado) => resultado.status === "rejected");
  }

  async function upload(memberIndex: number, file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Escolha uma imagem PNG, JPEG ou WebP.");
      return;
    }
    setPhotoUpload(true);
    setError(null);
    try {
      const result = await enviarFotoEquipe(file);
      uploadedIds.current.add(result.id);
      setDraft((current) => current ? substituir(current, ["team", "members", memberIndex, "photo_id"], result.id) as LandingContent : current);
    } catch (reason) {
      setError(mensagemErro(reason));
    } finally {
      setPhotoUpload(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setWarning(null);
    try {
      await salvarSecao(selected, draft[selected]);
      setContent((current) => current ? { ...current, [selected]: structuredClone(draft[selected]) } as LandingContent : current);
      if (selected === "team") {
        const used = new Set(draft.team.members.flatMap((member) => member.photo_id ? [member.photo_id] : []));
        for (const id of used) uploadedIds.current.delete(id);
        if (await descartarUploadsSemUso(used)) setWarning("A seção foi salva, mas não foi possível descartar uma foto enviada que ficou sem uso. Descarte as alterações da equipe para tentar novamente.");
      }
      setSuccess(`A seção “${selectedSection.label}” foi salva. A página pública já pode exibir a alteração.`);
    } catch (reason) {
      setError(mensagemErro(reason));
    } finally {
      setSaving(false);
    }
  }

  async function cancelSection() {
    if (!content || !draft) return;
    setWarning(null);
    if (selected === "team") {
      const persistedPhotos = new Set(content.team.members.flatMap((member) => member.photo_id ? [member.photo_id] : []));
      if (await descartarUploadsSemUso(persistedPhotos)) setWarning("Não foi possível descartar uma foto enviada. Tente descartar as alterações da equipe novamente.");
    }
    setDraft((current) => current ? { ...current, [selected]: structuredClone(content[selected]) } as LandingContent : current);
    setError(null);
    setSuccess("As alterações não salvas desta seção foram descartadas.");
  }

  const children: ReactNode = loading ? (
    <p role="status" className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">Carregando conteúdo institucional…</p>
  ) : content && draft ? (
    <div className="grid gap-5">
      <p className="max-w-3xl text-sm text-slate-600">Edite uma seção por vez. Ao salvar, todos os campos exibidos nessa seção são enviados juntos.</p>
      {error && <Alert tone="risk" role="alert" title="Não foi possível concluir">{error}</Alert>}
      {success && <Alert tone="ok" role="status" title="Alteração registrada">{success}</Alert>}
      {warning && <Alert tone="warn" role="status" title="Atenção">{warning}</Alert>}
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Seções do conteúdo institucional" className="grid content-start gap-1 rounded-lg border border-slate-200 bg-white p-2">
          {SECOES.map((section) => (
            <button key={section.id} type="button" disabled={photoUpload} aria-current={selected === section.id ? "page" : undefined} onClick={() => { setSelected(section.id); setError(null); setSuccess(null); setWarning(null); }} className={`rounded-md px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${selected === section.id ? "bg-blue-50 font-semibold text-blue-900" : "text-slate-700 hover:bg-slate-50"}`}>
              {section.label}
            </button>
          ))}
        </nav>
        <section aria-labelledby="secao-titulo" className="grid content-start gap-5 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <h2 id="secao-titulo" className="text-lg font-semibold text-slate-900">{selectedSection.label}</h2>
            <p className="mt-1 text-sm text-slate-500">Os campos abaixo formam a seção inteira que será salva.</p>
          </div>
          <fieldset disabled={photoUpload} className="m-0 grid min-w-0 gap-4 border-0 p-0">
            <CampoRecursivo value={draft[selected]} path={[selected]} onChange={change} onUploadPhoto={upload} uploadingPhoto={photoUpload} />
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <Button variant="secondary" disabled={saving || photoUpload} onClick={() => void cancelSection()}>Descartar alterações</Button>
            <Button disabled={saving || photoUpload} onClick={() => void save()}>{saving ? "Salvando…" : "Salvar seção"}</Button>
          </div>
        </section>
      </div>
    </div>
  ) : (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-700">O conteúdo não foi carregado.</p>
      <Button variant="secondary" onClick={() => { setLoading(true); setError(null); getConteudoInstitucional().then((current) => { setContent(current); setDraft(structuredClone(current)); }).catch((reason: unknown) => setError(mensagemErro(reason))).finally(() => setLoading(false)); }}>Tentar novamente</Button>
      {error && <Alert tone="risk" role="alert" title="Falha ao carregar">{error}</Alert>}
    </div>
  );

  return <PlataformaShell activeId="institucional" title="Conteúdo institucional" subtitle="Edite o conteúdo público do site">{children}</PlataformaShell>;
}
