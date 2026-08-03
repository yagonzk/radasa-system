import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number } from "../utils/serialize";

const serialize = (item: any) => ({
  ...item,
  quantidadeLitros: number(item.quantidadeLitros),
  valorUnitario: number(item.valorUnitario),
  valorTotal: number(item.valorTotal),
  hodometro: number(item.hodometro),
  dataEmissao: dateOnly(item.dataEmissao),
  createdAt: created(item.createdAt),
});

async function ensureReferences(clienteId: string, veiculoId: string) {
  const [cliente, veiculo] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } }),
    prisma.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true } }),
  ]);
  if (!cliente) throw new AppError(404, "Cliente não encontrado.");
  if (!veiculo) throw new AppError(404, "Veículo não encontrado.");
}

function buildData(input: any) {
  const quantidadeLitros = Number(input.quantidadeLitros);
  const valorUnitario = Number(input.valorUnitario);
  return {
    clienteId: input.clienteId,
    veiculoId: input.veiculoId,
    dataEmissao: parseDateOnly(input.dataEmissao),
    produto: input.produto.trim(),
    quantidadeLitros,
    valorUnitario,
    valorTotal: Number((quantidadeLitros * valorUnitario).toFixed(2)),
    hodometro: Number(input.hodometro),
    ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
  };
}

export const abastecimentosService = {
  async list() {
    return (await prisma.abastecimento.findMany({ orderBy: [{ hodometro: "desc" }, { dataEmissao: "desc" }, { createdAt: "desc" }] })).map(serialize);
  },
  async get(id: string) {
    const item = await prisma.abastecimento.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Abastecimento não encontrado.");
    return serialize(item);
  },
  async create(input: any) {
    await ensureReferences(input.clienteId, input.veiculoId);
    return serialize(await prisma.abastecimento.create({ data: buildData(input) }));
  },
  async update(id: string, input: any) {
    const current = await prisma.abastecimento.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Abastecimento não encontrado.");
    const merged = {
      clienteId: input.clienteId ?? current.clienteId,
      veiculoId: input.veiculoId ?? current.veiculoId,
      dataEmissao: input.dataEmissao ?? dateOnly(current.dataEmissao),
      produto: input.produto ?? current.produto,
      quantidadeLitros: input.quantidadeLitros ?? number(current.quantidadeLitros),
      valorUnitario: input.valorUnitario ?? number(current.valorUnitario),
      hodometro: input.hodometro ?? number(current.hodometro),
    };
    await ensureReferences(merged.clienteId, merged.veiculoId);
    return serialize(await prisma.abastecimento.update({ where: { id }, data: buildData(merged) }));
  },
  async remove(id: string) { await prisma.abastecimento.delete({ where: { id } }); },
};
