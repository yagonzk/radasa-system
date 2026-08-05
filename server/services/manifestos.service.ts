import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number, tipoFromDb, tipoToDb } from "../utils/serialize";

const include = { produtos: true } as const;
const serialize = (item: any) => ({
  id: item.id, clienteId: item.clienteId, dataManifesto: dateOnly(item.dataManifesto), tipoManifesto: tipoFromDb(item.tipoManifesto), pdfUrl: item.pdfUrl ?? undefined,
  transportadoraCodigo: item.transportadoraCodigo ?? "", transportadoraNome: item.transportadoraNome ?? "", veiculoCodigo: item.veiculoCodigo ?? "", placaVeiculo: item.placaVeiculo ?? "", modeloVeiculo: item.modeloVeiculo ?? "", romaneios: item.romaneios ?? "", notasFiscais: item.notasFiscais ?? "",
  produtos: item.produtos.map((p: any) => ({ produtoId: p.produtoId, quantidade: number(p.quantidade), valorUnitario: number(p.valorUnitario), valorTotal: number(p.valorTotal), ...(p.tipoManifesto ? { tipoManifesto: tipoFromDb(p.tipoManifesto) } : {}) })),
  createdAt: created(item.createdAt),
});
const nested = (items: any[]) => items.map(p => ({ produtoId: p.produtoId, quantidade: p.quantidade, valorUnitario: p.valorUnitario, valorTotal: p.valorTotal, tipoManifesto: p.tipoManifesto ? tipoToDb(p.tipoManifesto) : undefined }));

export const manifestosService = {
  async list() { return (await prisma.manifesto.findMany({ include, orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.manifesto.findUnique({ where: { id }, include }); if (!item) throw new AppError(404, "Manifesto não encontrado."); return serialize(item); },
  async create(input: any) {
    const item = await prisma.manifesto.create({ include, data: { id: input.id, clienteId: input.clienteId, dataManifesto: parseDateOnly(input.dataManifesto), tipoManifesto: tipoToDb(input.tipoManifesto), pdfUrl: input.pdfUrl || null, transportadoraCodigo: input.transportadoraCodigo || "", transportadoraNome: input.transportadoraNome || "", veiculoCodigo: input.veiculoCodigo || "", placaVeiculo: input.placaVeiculo || "", modeloVeiculo: input.modeloVeiculo || "", romaneios: input.romaneios || "", notasFiscais: input.notasFiscais || "", createdAt: input.createdAt ? new Date(input.createdAt) : undefined, produtos: { create: nested(input.produtos) } } });
    return serialize(item);
  },
  async update(id: string, input: any) {
    const item = await prisma.$transaction(async tx => {
      await tx.manifestoProduto.deleteMany({ where: { manifestoId: id } });
      return tx.manifesto.update({ where: { id }, include, data: { clienteId: input.clienteId, dataManifesto: parseDateOnly(input.dataManifesto), tipoManifesto: tipoToDb(input.tipoManifesto), pdfUrl: input.pdfUrl || null, transportadoraCodigo: input.transportadoraCodigo || "", transportadoraNome: input.transportadoraNome || "", veiculoCodigo: input.veiculoCodigo || "", placaVeiculo: input.placaVeiculo || "", modeloVeiculo: input.modeloVeiculo || "", romaneios: input.romaneios || "", notasFiscais: input.notasFiscais || "", produtos: { create: nested(input.produtos) } } });
    });
    return serialize(item);
  },
  async remove(id: string) { await prisma.manifesto.delete({ where: { id } }); },
};
