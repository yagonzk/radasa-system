import { formatDateOnly } from "./date.js";

export const number = (value: unknown) => Number(value);
export const created = (value: Date) => value.toISOString();
export const dateOnly = formatDateOnly;

export function tipoToDb(value: string) {
  if (value === "Bonificação - Lebrinha") return "BONIFICACAO_LEBRINHA" as const;
  if (value === "Acertar c/ Lebrinha") return "ACERTAR_LEBRINHA" as const;
  if (value === "Vasilhame") return "VASILHAME" as const;
  return "RECEBER_CLIENTE" as const;
}

export function tipoFromDb(value: string) {
  if (value === "BONIFICACAO_LEBRINHA") return "Bonificação - Lebrinha" as const;
  if (value === "ACERTAR_LEBRINHA") return "Acertar c/ Lebrinha" as const;
  if (value === "VASILHAME") return "Vasilhame" as const;
  return "Receber c/ Cliente" as const;
}
