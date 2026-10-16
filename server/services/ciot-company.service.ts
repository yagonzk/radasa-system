import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";

export const CIOT_COMPANY_BINDING_KEY = "ciot.empresa_emitente";
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

// The unique configuration key makes initialization atomic across Worker instances.
// Read the winning row after upsert; never replace an existing CNPJ binding.
export async function getCiotCompany(requestedId?: string | null) {
  let binding = await prisma.configuracaoSistema.findUnique({
    where: { chave: CIOT_COMPANY_BINDING_KEY },
  });
  if (!binding) {
    const active = await prisma.empresa.findMany({ where: { ativa: true } });
    const defaults = active.filter((company) => company.empresaPadrao);
    const candidate =
      defaults.length === 1
        ? defaults[0]
        : active.length === 1
          ? active[0]
          : null;
    if (!candidate)
      throw new AppError(
        422,
        active.length
          ? "Defina uma única empresa ativa como padrão em Cadastros > Empresa para vincular o CIOT."
          : "Cadastre e ative a empresa emitente em Cadastros > Empresa.",
      );
    if (!/^\d{14}$/.test(digits(candidate.cnpj)))
      throw new AppError(
        422,
        "Corrija o CNPJ da empresa em Cadastros > Empresa.",
      );
    // A forged request cannot choose or initialize a different company.
    if (requestedId && requestedId !== candidate.id)
      throw new AppError(
        422,
        "O CIOT permite somente a empresa e o CNPJ vinculados ao cadastro emitente.",
      );
    binding = await prisma.configuracaoSistema.upsert({
      where: { chave: CIOT_COMPANY_BINDING_KEY },
      create: {
        chave: CIOT_COMPANY_BINDING_KEY,
        valor: { empresaId: candidate.id, cnpj: digits(candidate.cnpj) },
      },
      update: {},
    });
  }
  const locked = binding.valor as { empresaId?: string; cnpj?: string } | null;
  if (!locked?.empresaId || !/^\d{14}$/.test(locked.cnpj ?? ""))
    throw new AppError(
      422,
      "O vínculo da empresa emitente do CIOT está inválido. Solicite revisão administrativa.",
    );
  if (requestedId && requestedId !== locked.empresaId)
    throw new AppError(
      422,
      "O CIOT permite somente a empresa e o CNPJ vinculados ao cadastro emitente.",
    );
  const company = await prisma.empresa.findUnique({
    where: { id: locked.empresaId },
  });
  if (!company)
    throw new AppError(
      422,
      "A empresa vinculada ao CIOT não foi encontrada em Cadastros > Empresa.",
    );
  if (digits(company.cnpj) !== locked.cnpj)
    throw new AppError(
      422,
      `O CNPJ do cadastro difere do único CNPJ vinculado ao CIOT (${locked.cnpj}). Restaure esse CNPJ em Cadastros > Empresa.`,
    );
  if (!company.ativa)
    throw new AppError(
      422,
      "A empresa vinculada ao CIOT está inativa. Ative-a em Cadastros > Empresa.",
    );
  return company;
}

export async function protectCiotCompany(
  id: string,
  nextCnpj?: string,
  deleting = false,
) {
  const binding = await prisma.configuracaoSistema.findUnique({
    where: { chave: CIOT_COMPANY_BINDING_KEY },
  });
  const locked = binding?.valor as
    { empresaId?: string; cnpj?: string } | undefined;
  if (
    locked?.empresaId === id &&
    (deleting || (nextCnpj !== undefined && digits(nextCnpj) !== locked.cnpj))
  )
    throw new AppError(
      409,
      "Esta empresa está vinculada à emissão de CIOT. Seu CNPJ não pode ser alterado e o cadastro não pode ser excluído.",
    );
}
