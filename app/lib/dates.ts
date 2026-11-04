const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "2026-11-04T15:30:00Z" -> "04/11/2026 12:30". Sempre no horário de Brasília, como o back. */
export const formatDateTime = (iso: string): string => DATA_HORA.format(new Date(iso)).replace(", ", " ");

const DATA_ISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/** A data de hoje em Brasília, "2026-11-04": à noite, em UTC, já pode ser o dia seguinte. */
export const hojeEmBrasilia = (): string => DATA_ISO.format(new Date());
