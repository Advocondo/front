/** URL da API. Fica à parte de api.ts para também poder ser usada em Server Components. */
export const apiBaseUrl = (): string =>
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
