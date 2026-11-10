"use client";

import { Alert, Badge, Button, Card, Input, Select, Textarea } from "edson-alexandre-design-system";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Field } from "@/app/components/FormField";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ApiError } from "@/app/lib/api";
import { apiBaseUrl } from "@/app/lib/api-url";
import type { LandingContent } from "@/app/_landing/types";
import { descartarFotoEquipe, enviarFotoEquipe, getConteudoInstitucional, salvarSecao, type LandingSection } from "./api";

type Caminho = (string | number)[];

export const SECOES: { id: LandingSection; label: string }[] = [
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
  rating: "Nota", reviews: "Avaliações", call_to_review_title: "Título do convite", call_to_review_text: "Texto do convite",
  google_reviews_url: "Link das avaliações no Google", members: "Integrantes", name: "Nome", role: "Cargo ou função", photo_id: "Foto",
  highlights: "Destaques", phone: "Telefone", whatsapp: "WhatsApp", email: "E-mail", address: "Endereço", opening_hours: "Horário de atendimento",
  facebook_url: "Facebook", instagram_url: "Instagram",
};

/** Como se chama um item de cada lista, no botão de adicionar e no título de cada item. */
const ITEM_DA_LISTA: Record<string, string> = {
  areas: "Área", reviews: "Avaliação", members: "Integrante", paragraphs: "Parágrafo", highlights: "Destaque",
};

const MODELOS: Record<string, unknown> = {
  areas: { title: "", description: "" },
  reviews: { author: "", author_details: null, rating: 5, text: "" },
  members: { name: "", role: "", photo_id: null },
  paragraphs: "",
  highlights: "",
};
const CAMPOS_NULAVEIS = new Set(["author_details", "google_reviews_url", "phone", "whatsapp", "email", "address", "opening_hours", "facebook_url", "instagram_url"]);
const CAMPOS_LONGOS = new Set(["text", "description", "subtitle", "closing_text", "paragraphs", "highlights", "call_to_review_text", "address", "opening_hours"]);
const NOTAS = ["1", "2", "3", "4", "5"];

function tituloCampo(key: string) {
  return ROTULOS[key] ?? key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** "Equipe › Integrante 2 › Nome", para dizer em qual item está o erro. */
export function descreverCaminho(caminho: Caminho): string {
  const partes: string[] = [];
  caminho.forEach((parte, i) => {
    if (i === 0) partes.push(SECOES.find((s) => s.id === parte)?.label ?? tituloCampo(String(parte)));
    else if (typeof parte === "number") {
      const lista = String(caminho[i - 1]);
      partes[partes.length - 1] = `${ITEM_DA_LISTA[lista] ?? "Item"} ${parte + 1}`;
    } else partes.push(tituloCampo(parte));
  });
  return partes.join(" › ");
}

function substituir(value: unknown, path: Caminho, next: unknown): unknown {
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

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type CampoProps = {
  value: unknown;
  path: Caminho;
  onChange: (path: Caminho, next: unknown) => void;
  onUploadPhoto: (memberIndex: number, file: File) => void;
  uploadingPhoto: boolean;
};

function CampoRecursivo({ value, path, onChange, onUploadPhoto, uploadingPhoto }: CampoProps) {
  const key = String(path.at(-1) ?? "");
  const id = `landing-${path.join("-")}`;
  const filho = (childValue: unknown, childPath: Caminho) => (
    <CampoRecursivo key={childPath.join("-")} value={childValue} path={childPath} onChange={onChange} onUploadPhoto={onUploadPhoto} uploadingPhoto={uploadingPhoto} />
  );

  if (Array.isArray(value)) {
    const item = ITEM_DA_LISTA[key] ?? "Item";
    return (
      <div className="grid gap-3 sm:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{tituloCampo(key)}</span>
          <Button size="sm" variant="secondary" icon="plus" onClick={() => onChange(path, [...value, structuredClone(MODELOS[key] ?? "")])}>
            {`Adicionar ${item.toLowerCase()}`}
          </Button>
        </div>
        {value.length === 0 && <p className="text-sm">Nenhum item cadastrado.</p>}
        {value.map((valorDoItem, index) => {
          const rotulo = `${item} ${index + 1}`;
          const remover = (
            <Button size="sm" variant="ghost" icon="trash-2" aria-label={`Remover ${rotulo.toLowerCase()}`} onClick={() => onChange(path, value.filter((_, i) => i !== index))}>
              Remover
            </Button>
          );
          if (typeof valorDoItem === "object" && valorDoItem !== null) {
            return (
              <Card key={`${id}-${index}`} tone="sunken" padding="sm" title={rotulo} action={remover}>
                <div className="grid gap-4 sm:grid-cols-2">{Object.entries(valorDoItem).map(([childKey, childValue]) => filho(childValue, [...path, index, childKey]))}</div>
              </Card>
            );
          }
          return (
            <div key={`${id}-${index}`} className="grid gap-1">
              <Field id={`${id}-${index}`} label={rotulo}>
                <Textarea id={`${id}-${index}`} rows={2} value={String(valorDoItem ?? "")} onChange={(event) => onChange([...path, index], event.target.value)} />
              </Field>
              <div className="justify-self-end">{remover}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    return <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">{Object.entries(value).map(([childKey, childValue]) => filho(childValue, [...path, childKey]))}</div>;
  }

  if (key === "photo_id" && path[0] === "team") {
    const memberIndex = path[2] as number;
    return (
      <div className="grid gap-2 sm:col-span-2">
        <span className="text-sm font-semibold">Foto do integrante</span>
        {typeof value === "string" ? (
          // A foto vem da API, em outro domínio e sem tamanho fixo: o otimizador do Next não ajuda aqui.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-24 w-24 rounded-full object-cover" src={`${apiBaseUrl()}/landing/images/${encodeURIComponent(value)}`} alt={`Foto do integrante ${memberIndex + 1}`} />
        ) : (
          <span className="text-sm">Nenhuma foto selecionada.</span>
        )}
        <input
          aria-label={`Enviar foto do integrante ${memberIndex + 1}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploadingPhoto}
          className="text-sm"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onUploadPhoto(memberIndex, file);
            event.currentTarget.value = "";
          }}
        />
        <span className="text-xs">PNG, JPEG ou WebP.</span>
        {value !== null && (
          <div>
            <Button size="sm" variant="ghost" icon="image-off" onClick={() => onChange(path, null)}>
              Remover foto
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (key === "rating") {
    // Uma lista de 1 a 5 não deixa a nota vazia nem fora da faixa que o back aceita.
    return (
      <Field id={id} label="Nota (1 a 5)">
        <Select id={id} options={NOTAS} value={String(value ?? 5)} onChange={(event) => onChange(path, Number(event.target.value))} />
      </Field>
    );
  }

  const nullable = value === null || CAMPOS_NULAVEIS.has(key);
  const atualizar = (texto: string) => onChange(path, nullable && !texto ? null : texto);
  return (
    <div className={CAMPOS_LONGOS.has(key) ? "sm:col-span-2" : undefined}>
      <Field id={id} label={tituloCampo(key)} hint={nullable ? "opcional" : undefined}>
        {CAMPOS_LONGOS.has(key) ? (
          <Textarea id={id} rows={3} value={String(value ?? "")} onChange={(event) => atualizar(event.target.value)} />
        ) : (
          <Input id={id} value={String(value ?? "")} onChange={(event) => atualizar(event.target.value)} />
        )}
      </Field>
    </div>
  );
}

type ItemDeValidacao = { loc?: unknown[]; msg?: string };

export function mensagemErro(error: unknown): string {
  if (!(error instanceof ApiError)) return "Não foi possível concluir a operação. Tente novamente.";
  if (error.status === 403) return "Seu perfil não tem permissão para editar o conteúdo institucional.";
  const detail = (error.body as { detail?: unknown } | undefined)?.detail;
  if (error.status === 422 && Array.isArray(detail)) {
    const campos = (detail as ItemDeValidacao[]).flatMap((item) => {
      // O loc vem como ["body", "<seção>", ...]; os índices dizem qual item da lista está errado.
      const caminho = (item.loc ?? []).filter((parte): parte is string | number => typeof parte === "string" || typeof parte === "number");
      const semBody = caminho[0] === "body" ? caminho.slice(1) : caminho;
      if (semBody.length === 0) return [];
      const msg = item.msg?.startsWith("Value error, ") ? item.msg.replace("Value error, ", "") : "valor inválido";
      return [`${descreverCaminho(semBody)}: ${msg}`];
    });
    if (campos.length) return `Revise os campos: ${[...new Set(campos)].join("; ")}.`;
  }
  return error.message;
}

export function InstitucionalView() {
  const [content, setContent] = useState<LandingContent | null>(null);
  const [draft, setDraft] = useState<LandingContent | null>(null);
  const [selected, setSelected] = useState<LandingSection>("hero");
  const [loading, setLoading] = useState(true);
  const [recarregar, setRecarregar] = useState(0);
  const [saving, setSaving] = useState(false);
  const [photoUpload, setPhotoUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const uploadedIds = useRef(new Set<string>());
  const selectedSection = SECOES.find((section) => section.id === selected)!;

  const alteradas = useMemo(
    () => new Set(content && draft ? SECOES.filter((s) => !igual(content[s.id], draft[s.id])).map((s) => s.id) : []),
    [content, draft],
  );
  const temAlteracao = alteradas.size > 0;

  useEffect(() => {
    const controller = new AbortController();
    getConteudoInstitucional(controller.signal)
      .then((current) => { setContent(current); setDraft(structuredClone(current)); setError(null); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(mensagemErro(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [recarregar]);

  // Recarregar ou fechar a aba com algo não salvo pede confirmação ao navegador.
  useEffect(() => {
    if (!temAlteracao) return;
    const avisar = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [temAlteracao]);

  function limparAvisos() {
    setError(null);
    setSuccess(null);
    setWarning(null);
  }

  function change(path: Caminho, next: unknown) {
    setDraft((current) => current ? substituir(current, path, next) as LandingContent : current);
    limparAvisos();
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
    limparAvisos();
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
    limparAvisos();
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
    limparAvisos();
    if (selected === "team") {
      const persistedPhotos = new Set(content.team.members.flatMap((member) => member.photo_id ? [member.photo_id] : []));
      if (await descartarUploadsSemUso(persistedPhotos)) setWarning("Não foi possível descartar uma foto enviada. Tente descartar as alterações da equipe novamente.");
    }
    setDraft((current) => current ? { ...current, [selected]: structuredClone(content[selected]) } as LandingContent : current);
    setSuccess("As alterações não salvas desta seção foram descartadas.");
  }

  let children: ReactNode;
  if (loading) {
    children = <p role="status">Carregando conteúdo institucional…</p>;
  } else if (!content || !draft) {
    children = (
      <Alert tone="risk" role="alert" title="Não foi possível carregar o conteúdo" action={<Button size="sm" variant="secondary" onClick={() => { setLoading(true); setError(null); setRecarregar((n) => n + 1); }}>Tentar novamente</Button>}>
        {error ?? "Tente novamente."}
      </Alert>
    );
  } else {
    const alteradaAqui = alteradas.has(selected);
    children = (
      <div className="grid gap-5">
        <p className="max-w-3xl text-sm">Edite uma seção por vez. Ao salvar, todos os campos da seção são enviados juntos.</p>
        {error && <Alert tone="risk" role="alert" title="Não foi possível concluir">{error}</Alert>}
        {success && <Alert tone="ok" role="status" title="Alteração registrada">{success}</Alert>}
        {warning && <Alert tone="warn" role="status" title="Atenção">{warning}</Alert>}
        {temAlteracao && (
          <Alert tone="info" title="Há alterações não salvas">
            {`Seções alteradas: ${SECOES.filter((s) => alteradas.has(s.id)).map((s) => s.label).join(", ")}. Salve cada uma antes de sair da tela.`}
          </Alert>
        )}
        <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <Card padding="sm" className="content-start">
            <nav aria-label="Seções do conteúdo institucional" className="grid gap-1">
              {SECOES.map((section) => (
                <Button
                  key={section.id}
                  variant={selected === section.id ? "secondary" : "ghost"}
                  block
                  disabled={photoUpload}
                  aria-current={selected === section.id ? "page" : undefined}
                  onClick={() => { setSelected(section.id); limparAvisos(); }}
                  iconEnd={alteradas.has(section.id) ? "circle-dot" : undefined}
                  aria-label={alteradas.has(section.id) ? `${section.label} (alterações não salvas)` : undefined}
                >
                  {section.label}
                </Button>
              ))}
            </nav>
          </Card>
          <Card title={selectedSection.label} action={alteradaAqui ? <Badge tone="warn">Não salva</Badge> : undefined}>
            <div className="grid gap-5">
              <fieldset disabled={photoUpload} className="m-0 grid min-w-0 gap-4 border-0 p-0">
                <CampoRecursivo value={draft[selected]} path={[selected]} onChange={change} onUploadPhoto={upload} uploadingPhoto={photoUpload} />
              </fieldset>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" disabled={saving || photoUpload} onClick={() => void cancelSection()}>Descartar alterações</Button>
                <Button icon="check" loading={saving} disabled={photoUpload} onClick={() => void save()}>Salvar seção</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <PlataformaShell activeId="institucional" title="Conteúdo institucional" subtitle="Edite o conteúdo público do site">{children}</PlataformaShell>;
}
