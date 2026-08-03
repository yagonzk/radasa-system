import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number } from "../utils/serialize";

const serialize = (item: any) => ({
  ...item,
  valorFrete: number(item.valorFrete), distanciaKm: number(item.distanciaKm),
  valorPedagio: number(item.valorPedagio), valorDiaria: number(item.valorDiaria),
  valorAbastecimento: number(item.valorAbastecimento), valorChapa: number(item.valorChapa),
  dataManifesto: dateOnly(item.dataManifesto), createdAt: created(item.createdAt),
});
const data = (input: any) => ({ ...input, dataManifesto: parseDateOnly(input.dataManifesto), createdAt: input.createdAt ? new Date(input.createdAt) : undefined });

export const viagensService = {
  async list() { return (await prisma.viagem.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.viagem.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Viagem não encontrada."); return serialize(item); },
  async create(input: any) { return serialize(await prisma.viagem.create({ data: data(input) })); },
  async update(id: string, input: any) { const { createdAt, id: _id, ...rest } = data(input); return serialize(await prisma.viagem.update({ where: { id }, data: rest })); },
  async remove(id: string) { await prisma.viagem.delete({ where: { id } }); },
};
