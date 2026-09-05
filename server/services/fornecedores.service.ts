import { prisma } from "../lib/prisma.js";
import { created } from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => ({ ...item, createdAt: created(item.createdAt), updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt });

function normalizedDocument(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

type FornecedorNormalizado = {
  razaoSocial: string;
  nomeFantasia: string;
  documento: string;
  tipos: string[];
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  uf: string;
  contato: string;
  observacoes: string;
  ativo: boolean;
};

function normalize(data: any): FornecedorNormalizado {
  const tipos: string[] = Array.isArray(data.tipos)
    ? Array.from(
        new Set<string>(
          data.tipos
            .map((x: unknown) => String(x).trim())
            .filter((x: string) => x.length > 0),
        ),
      )
    : [];

  return {
    razaoSocial: String(data.razaoSocial ?? "").trim(),
    nomeFantasia: String(data.nomeFantasia ?? "").trim(),
    documento: normalizedDocument(data.documento),
    tipos,
    telefone: String(data.telefone ?? "").trim(),
    email: String(data.email ?? "").trim(),
    endereco: String(data.endereco ?? "").trim(),
    cidade: String(data.cidade ?? "").trim(),
    uf: String(data.uf ?? "").trim().toUpperCase().slice(0, 2),
    contato: String(data.contato ?? "").trim(),
    observacoes: String(data.observacoes ?? "").trim(),
    ativo: data.ativo !== false,
  };
}

async function ensureUniqueDocument(documento: string, ignoreId?: string) {
  if (!documento) return;
  const existing = await prisma.fornecedor.findFirst({ where: { documento, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } });
  if (existing) throw new AppError(409, "Já existe um fornecedor cadastrado com este CNPJ/CPF.");
}

export const fornecedoresService = {
  async list() {
    return (await prisma.fornecedor.findMany({ orderBy: [{ ativo: "desc" }, { nomeFantasia: "asc" }, { razaoSocial: "asc" }] })).map(serialize);
  },
  async get(id: string) {
    const item = await prisma.fornecedor.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Fornecedor não encontrado.");
    return serialize(item);
  },
  async create(data: any) {
    const normalized = normalize(data);
    await ensureUniqueDocument(normalized.documento);
    return serialize(await prisma.fornecedor.create({ data: normalized }));
  },
  async update(id: string, data: any) {
    const current = await prisma.fornecedor.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Fornecedor não encontrado.");
    const normalized = normalize({ ...current, ...data });
    await ensureUniqueDocument(normalized.documento, id);
    return serialize(await prisma.fornecedor.update({ where: { id }, data: normalized }));
  },
  async remove(id: string) {
    const [uses, notasEstoque] = await Promise.all([
      prisma.ordemServico.count({ where: { fornecedorId: id } }),
      prisma.estoqueNotaFiscal.count({ where: { fornecedorId: id } }),
    ]);
    if (uses > 0 || notasEstoque > 0) {
      await prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
      return;
    }
    await prisma.fornecedor.delete({ where: { id } });
  },
};
