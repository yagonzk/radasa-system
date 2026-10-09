/** Formata telefones brasileiros durante a digitação sem criar dígitos inexistentes. */
export function formatBrazilianPhoneInput(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length < 3) return `(${digits}`;
  const area = digits.slice(0, 2);
  const number = digits.slice(2);
  if (!number) return `(${area})`;
  if (number.length <= 4) return `(${area}) ${number}`;
  // Se começar por 9, aplica o padrão de celular desde o primeiro dígito.
  if (number[0] === "9") {
    const rest = number.slice(1);
    if (!rest) return `(${area}) 9`;
    return `(${area}) 9 ${rest.length <= 4 ? rest : `${rest.slice(0, 4)}-${rest.slice(4)}`}`;
  }
  // Números fixos legados preservam os 8 dígitos originais.
  if (number.length > 4) return `(${area}) ${number.slice(0, -4)}-${number.slice(-4)}`;
  return `(${area}) ${number}`;
}
