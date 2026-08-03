import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number } from "../utils/serialize";

const include = { viagens: { select: { localId: true, quantidade: true } } } as const;
const serialize = (item: any) => ({
  id: item.id, motoristaId: item.motoristaId, dataInicio: dateOnly(item.dataInicio), dataFim: dateOnly(item.dataFim),
  viagens: item.viagens.map((v: any) => ({ localId: v.localId, quantidade: v.quantidade })),
  valorTotal: number(item.valorTotal), createdAt: created(item.createdAt),
});
const nested = (input: any) => input.viagens.map((v: any) => ({ localId: v.localId, quantidade: v.quantidade }));

export const fechamentosService = {
  async list() { return (await prisma.fechamento.findMany({ include, orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.fechamento.findUnique({ where: { id }, include }); if (!item) throw new AppError(404, "Fechamento não encontrado."); return serialize(item); },
  async create(input: any) {
    const item = await prisma.fechamento.create({ include, data: { id: input.id, motoristaId: input.motoristaId, dataInicio: parseDateOnly(input.dataInicio), dataFim: parseDateOnly(input.dataFim), valorTotal: input.valorTotal ?? 0, createdAt: input.createdAt ? new Date(input.createdAt) : undefined, viagens: { create: nested(input) } } });
    return serialize(item);
  },
  async update(id: string, input: any) {
    const item = await prisma.$transaction(async (tx) => {
      await tx.fechamentoViagem.deleteMany({ where: { fechamentoId: id } });
      return tx.fechamento.update({ where: { id }, include, data: { motoristaId: input.motoristaId, dataInicio: parseDateOnly(input.dataInicio), dataFim: parseDateOnly(input.dataFim), valorTotal: input.valorTotal ?? 0, viagens: { create: nested(input) } } });
    });
    return serialize(item);
  },
  async remove(id: string) { await prisma.fechamento.delete({ where: { id } }); },
};
