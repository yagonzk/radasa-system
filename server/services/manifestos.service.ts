import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number, tipoFromDb, tipoToDb } from "../utils/serialize";

const include = { produtos: { orderBy: { id: "asc" as const } } } as const;

const serialize = (item: any) => ({
  id: item.id,
  clienteId: item.clienteId,
  dataManifesto: dateOnly(item.dataManifesto),
  tipoManifesto: tipoFromDb(item.tipoManifesto),
  pdfUrl: item.pdfUrl ?? undefined,
  transportadoraCodigo: item.transportadoraCodigo ?? "",
  transportadoraNome: item.transportadoraNome ?? "",
  veiculoCodigo: item.veiculoCodigo ?? "",
  placaVeiculo: item.placaVeiculo ?? "",
  modeloVeiculo: item.modeloVeiculo ?? "",
  romaneios: item.romaneios ?? "",
  notasFiscais: item.notasFiscais ?? "",
  produtos: item.produtos.map((produto: any) => ({
    id: produto.id,
    produtoId: produto.produtoId,
    clienteId: produto.clienteId ?? item.clienteId,
    romaneio: produto.romaneio ?? "",
    notaFiscal: produto.notaFiscal ?? "",
    serieNf: produto.serieNf ?? "",
    instrucaoCobranca: produto.instrucaoCobranca ?? "",
    quantidade: number(produto.quantidade),
    valorUnitario: number(produto.valorUnitario),
    valorTotal: number(produto.valorTotal),
    tipoManifesto: produto.tipoManifesto
      ? tipoFromDb(produto.tipoManifesto)
      : tipoFromDb(item.tipoManifesto),
    pagoCliente: produto.pagoCliente ?? null,
  })),
  createdAt: created(item.createdAt),
});

const nested = (items: any[], fallbackClientId: string) =>
  items.map((produto) => ({
    produtoId: produto.produtoId,
    clienteId: produto.clienteId || fallbackClientId,
    romaneio: produto.romaneio || "",
    notaFiscal: produto.notaFiscal || "",
    serieNf: produto.serieNf || "",
    instrucaoCobranca: produto.instrucaoCobranca || "",
    quantidade: Number(produto.quantidade),
    valorUnitario: Number(produto.valorUnitario),
    valorTotal: Number(produto.valorTotal),
    tipoManifesto: produto.tipoManifesto
      ? tipoToDb(produto.tipoManifesto)
      : undefined,
    pagoCliente: produto.pagoCliente ?? null,
  }));

export const manifestosService = {
  async list() {
    return (
      await prisma.manifesto.findMany({
        include,
        orderBy: [{ dataManifesto: "desc" }, { createdAt: "desc" }],
      })
    ).map(serialize);
  },

  async get(id: string) {
    const item = await prisma.manifesto.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, "Romaneio não encontrado.");
    return serialize(item);
  },

  async create(input: any) {
    const clienteId = input.clienteId || input.produtos?.[0]?.clienteId;
    if (!clienteId) throw new AppError(400, "Informe o cliente de pelo menos um item.");
    const item = await prisma.manifesto.create({
      include,
      data: {
        id: input.id,
        clienteId,
        dataManifesto: parseDateOnly(input.dataManifesto),
        tipoManifesto: tipoToDb(input.tipoManifesto),
        pdfUrl: input.pdfUrl || null,
        transportadoraCodigo: input.transportadoraCodigo || "",
        transportadoraNome: input.transportadoraNome || "",
        veiculoCodigo: input.veiculoCodigo || "",
        placaVeiculo: input.placaVeiculo || "",
        modeloVeiculo: input.modeloVeiculo || "",
        romaneios: input.romaneios || "",
        notasFiscais: input.notasFiscais || "",
        createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
        produtos: { create: nested(input.produtos, clienteId) },
      },
    });
    return serialize(item);
  },

  async update(id: string, input: any) {
    const current = await prisma.manifesto.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Romaneio não encontrado.");
    const clienteId = input.clienteId || input.produtos?.[0]?.clienteId || current.clienteId;
    const item = await prisma.$transaction(async (tx) => {
      await tx.manifestoProduto.deleteMany({ where: { manifestoId: id } });
      return tx.manifesto.update({
        where: { id },
        include,
        data: {
          clienteId,
          dataManifesto: parseDateOnly(input.dataManifesto),
          tipoManifesto: tipoToDb(input.tipoManifesto),
          pdfUrl: input.pdfUrl || null,
          transportadoraCodigo: input.transportadoraCodigo || "",
          transportadoraNome: input.transportadoraNome || "",
          veiculoCodigo: input.veiculoCodigo || "",
          placaVeiculo: input.placaVeiculo || "",
          modeloVeiculo: input.modeloVeiculo || "",
          romaneios: input.romaneios || "",
          notasFiscais: input.notasFiscais || "",
          produtos: { create: nested(input.produtos, clienteId) },
        },
      });
    });
    return serialize(item);
  },

  async remove(id: string) {
    await prisma.manifesto.delete({ where: { id } });
  },

  async updatePagamentoCliente(manifestoId: string, produtoId: string, pago: boolean) {
    const produto = await prisma.manifestoProduto.findFirst({
      where: { id: produtoId, manifestoId },
      include: { manifesto: true },
    });
    if (!produto) throw new AppError(404, "Item do romaneio não encontrado.");

    const tipo = produto.tipoManifesto
      ? tipoFromDb(produto.tipoManifesto)
      : tipoFromDb(produto.manifesto.tipoManifesto);
    if (tipo !== "Receber c/ Cliente") {
      throw new AppError(400, "Somente itens 'Receber c/ Cliente' possuem controle de pagamento.");
    }

    await prisma.manifestoProduto.update({
      where: { id: produtoId },
      data: { pagoCliente: pago },
    });
    return this.get(manifestoId);
  },
};
