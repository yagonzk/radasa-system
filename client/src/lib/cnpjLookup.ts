import { api } from "@/lib/api";
import { documentDigits } from "@/lib/documentMasks";

export interface CnpjLookupResult {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  situacaoCadastral: string;
  dataAbertura: string;
  naturezaJuridica: string;
  atividadePrincipal: string;
}

export function isValidCnpj(value: string): boolean {
  const digits = documentDigits(value);
  if (!/^\d{14}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  const check = (size: number) => {
    let weight = size - 7;
    let sum = 0;
    for (let index = 0; index < size; index++) {
      sum += Number(digits[index]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return Number(digits[12]) === check(12) && Number(digits[13]) === check(13);
}

export function fillIfEmpty(current: string | null | undefined, incoming: string | null | undefined): string {
  return String(current ?? "").trim() ? String(current) : String(incoming ?? "").trim();
}

export function formatCompanyAddress(data: CnpjLookupResult): string {
  const street = [data.logradouro, data.numero].filter(Boolean).join(", ");
  const city = [data.cidade, data.uf].filter(Boolean).join("/");
  const cep = data.cep ? `CEP ${data.cep}` : "";
  return [street, data.complemento, data.bairro, city, cep].filter(Boolean).join(" - ");
}

export async function lookupCnpj(cnpj: string): Promise<CnpjLookupResult> {
  const digits = documentDigits(cnpj);
  if (!isValidCnpj(digits)) throw new Error("Informe um CNPJ válido com 14 dígitos.");
  const { data } = await api.get<CnpjLookupResult>(`/cnpj/${digits}`);
  if (documentDigits(data?.cnpj) !== digits || !data?.razaoSocial) {
    throw new Error("Os dados retornados não correspondem ao CNPJ informado.");
  }
  return data;
}
