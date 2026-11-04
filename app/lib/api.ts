/** Cliente HTTP da API do back-end. A URL vem de NEXT_PUBLIC_API_URL (ver .env.example). */

import { apiBaseUrl } from "./api-url";
import { clearSession, getSession } from "./session";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Erros por campo (422), com o nome do campo do back-end como chave. */
    readonly fieldErrors: Record<string, string> = {},
    /** Corpo da resposta, para os erros que trazem mais que a mensagem. */
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ValidationItem = { loc?: unknown[]; msg?: string };

function parseError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return new ApiError(status, detail, {}, body);
  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as ValidationItem[]) {
      const field = item.loc?.filter((part) => typeof part === "string").at(-1);
      if (typeof field === "string" && field !== "body" && !(field in fieldErrors)) {
        // As mensagens em português são as do back, com o prefixo "Value error, " do Pydantic.
        // As demais são do próprio Pydantic, em inglês, e não devem chegar ao usuário.
        const msg = item.msg ?? "";
        fieldErrors[field] = msg.startsWith("Value error, ") ? msg.replace("Value error, ", "") : "Valor inválido.";
      }
    }
    return new ApiError(status, "Verifique os campos destacados.", fieldErrors);
  }
  return new ApiError(status, "Não foi possível concluir a operação. Tente novamente.");
}

async function enviar(path: string, init: RequestInit): Promise<Response> {
  const token = getSession()?.token;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }
  // Token recusado: a sessão acabou no servidor, e o RequireAuth leva ao login.
  if (response.status === 401 && token) clearSession();
  return response;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await enviar(path, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw parseError(response.status, body);
  return body as T;
}

/** Para respostas que não são JSON, como um PDF. Os erros continuam vindo em JSON. */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const response = await enviar(path, {});
  if (!response.ok) throw parseError(response.status, await response.json().catch(() => null));
  return response.blob();
}
