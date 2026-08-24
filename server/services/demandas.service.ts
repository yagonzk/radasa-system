import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { created, dateOnly } from "../utils/serialize.js";

const serialize = (item: any) => ({
  ...item,
  dataPrazo: dateOnly(item.dataPrazo),
  createdAt: created(item.createdAt),
  updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
});

const normalize = (input: any) => {
  const output: any = { ...input };
  if (Object.prototype.hasOwnProperty.call(input, "dataPrazo")) {
    output.dataPrazo = input.dataPrazo ? new Date(`${input.dataPrazo}T00:00:00.000Z`) : null;
  }
  if (Object.prototype.hasOwnProperty.call(input, "etiquetas")) {
    output.etiquetas = Array.isArray(input.etiquetas) ? input.etiquetas.filter(Boolean).slice(0, 12) : [];
  }
  return output;
};

export const demandasService = {
  async list() {
    return (await prisma.demanda.findMany({
      where: { arquivada: false },
      orderBy: [{ status: "asc" }, { ordem: "asc" }, { createdAt: "desc" }],
    })).map(serialize);
  },
  async get(id: string) {
    const item = await prisma.demanda.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Demanda não encontrada.");
    return serialize(item);
  },
  async create(input: any) {
    const max = await prisma.demanda.aggregate({ where: { status: input.status ?? "A_FAZER", arquivada: false }, _max: { ordem: true } });
    return serialize(await prisma.demanda.create({ data: normalize({ ...input, ordem: (max._max.ordem ?? -1) + 1 }) }));
  },
  async update(id: string, input: any) {
    const existing = await prisma.demanda.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Demanda não encontrada.");
    const next = normalize(input);
    if (input.status && input.status !== existing.status && input.ordem === undefined) {
      const max = await prisma.demanda.aggregate({ where: { status: input.status, arquivada: false }, _max: { ordem: true } });
      next.ordem = (max._max.ordem ?? -1) + 1;
    }
    return serialize(await prisma.demanda.update({ where: { id }, data: next }));
  },
  async remove(id: string) {
    await prisma.demanda.delete({ where: { id } });
  },
};
