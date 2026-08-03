import { prisma } from "../lib/prisma";
import { created} from "../utils/serialize";
import { AppError } from "../utils/app-error";

const serialize = (item: any) => ({ ...item, createdAt: created(item.createdAt) });

export const veiculosService = {
  async list() { return (await prisma.veiculo.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.veiculo.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Veiculo não encontrado."); return serialize(item); },
  async create(data: any) { const { createdAt, ...rest } = data; const item = await prisma.veiculo.create({ data: { ...rest, ...(createdAt ? { createdAt: new Date(createdAt) } : {}) } }); return serialize(item); },
  async update(id: string, data: any) { const { createdAt, ...rest } = data; const item = await prisma.veiculo.update({ where: { id }, data: rest }); return serialize(item); },
  async remove(id: string) { await prisma.veiculo.delete({ where: { id } }); },
};
