/** Formatação visual progressiva de documentos brasileiros.
 * Os valores persistidos nos cadastros devem continuar contendo somente dígitos.
 */
export function documentDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatCpfInput(value: string | null | undefined): string {
  return documentDigits(value).slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function formatCnpjInput(value: string | null | undefined): string {
  return documentDigits(value).slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Até 11 dígitos mostra máscara de CPF; ao digitar o 12º, passa para CNPJ. */
export function formatCpfCnpjInput(value: string | null | undefined): string {
  const digits = documentDigits(value).slice(0, 14);
  return digits.length <= 11 ? formatCpfInput(digits) : formatCnpjInput(digits);
}
