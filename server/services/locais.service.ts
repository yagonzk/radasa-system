import { prisma } from "../lib/prisma.js";
import { created, number } from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";
import { valorComissaoPorDestino } from "../utils/comissao.js";

const serialize = (item: any) => ({
  ...item,
  uf: item.uf || null,
  valorComissao: valorComissaoPorDestino({
    cidade: item.cidade,
    uf: item.uf,
    valorLegado: number(item.valorComissao),
  }),
  createdAt: created(item.createdAt),
});

function normalizeInput(data: any) {
  const uf = String(data?.uf ?? "").trim().toUpperCase() || null;
  const valorComissao = valorComissaoPorDestino({
    cidade: data?.cidade,
    uf,
    valorLegado: data?.valorComissao,
  });
  return { ...data, uf, valorComissao };
}

export const locaisService = {
  async list() {
    return (await prisma.local.findMany({ orderBy: { createdAt: "desc" } })).map(serialize);
  },
  async get(id: string) {
    const item = await prisma.local.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Local não encontrado.");
    return serialize(item);
  },
  async create(data: any) {
    const { createdAt, ...rest } = normalizeInput(data);
    const item = await prisma.local.create({
      data: { ...rest, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) },
    });
    return serialize(item);
  },
  async update(id: string, data: any) {
    const atual = await prisma.local.findUnique({ where: { id } });
    if (!atual) throw new AppError(404, "Local não encontrado.");

    const { createdAt, ...rest } = normalizeInput({
      cidade: data.cidade ?? atual.cidade,
      uf: data.uf !== undefined ? data.uf : atual.uf,
      valorComissao: data.valorComissao ?? atual.valorComissao,
      ...data,
    });
    const item = await prisma.local.update({ where: { id }, data: rest });
    return serialize(item);
  },
  async remove(id: string) {
    await prisma.local.delete({ where: { id } });
  },
};
