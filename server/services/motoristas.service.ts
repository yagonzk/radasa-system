import { prisma } from "../lib/prisma";
import { created, number} from "../utils/serialize";
import { AppError } from "../utils/app-error";

const serialize = (item: any) => ({ ...item, salarioBase: number(item.salarioBase), createdAt: created(item.createdAt) });

export const motoristasService = {
  async list() { return (await prisma.motorista.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.motorista.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Motorista não encontrado."); return serialize(item); },
  async create(data: any) { const { createdAt, ...rest } = data; const item = await prisma.motorista.create({ data: { ...rest, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) } }); return serialize(item); },
  async update(id: string, data: any) { const { createdAt, ...rest } = data; const item = await prisma.motorista.update({ where: { id }, data: rest }); return serialize(item); },
  async remove(id: string) { await prisma.motorista.delete({ where: { id } }); },
};
