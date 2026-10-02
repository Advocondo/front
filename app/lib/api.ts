/** Cliente HTTP da API do back-end. A URL vem de NEXT_PUBLIC_API_URL (ver .env.example). */

const baseUrl = (): string =>
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Erros por campo (422), com o nome do campo do back-end como chave. */
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ValidationItem = { loc?: unknown[]; msg?: string };

function parseError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return new ApiError(status, detail);
  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as ValidationItem[]) {
      const field = item.loc?.filter((part) => typeof part === "string").at(-1);
      if (typeof field === "string" && field !== "body" && !(field in fieldErrors)) {
        // O Pydantic prefixa a mensagem ("Value error, ..."); mostramos só o texto útil.
        fieldErrors[field] = (item.msg ?? "Valor inválido.").replace(/^Value error, /, "");
      }
    }
    return new ApiError(status, "Verifique os campos destacados.", fieldErrors);
  }
  return new ApiError(status, "Não foi possível concluir a operação. Tente novamente.");
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw parseError(response.status, body);
  return body as T;
}
