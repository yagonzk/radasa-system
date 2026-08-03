import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number } from "../utils/serialize";

const include = { produtos: true } as const;

const serialize = (item: any) => ({
  ...item,
  valorDesconto: number(item.valorDesconto),
  valorTotal: number(item.valorTotal),
  hodometro: number(item.hodometro),
  dataEmissao: dateOnly(item.dataEmissao),
  createdAt: created(item.createdAt),
  produtos: (item.produtos ?? []).map((produto: any) => ({
    produtoId: produto.produtoId,
    quantidadeLitros: number(produto.quantidadeLitros),
    valorUnitario: number(produto.valorUnitario),
    valorTotal: number(produto.valorTotal),
  })),
});

async function ensureReferences(clienteId: string, veiculoId: string, produtoIds: string[]) {
  const [cliente, veiculo, produtos] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } }),
    prisma.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true } }),
    prisma.produto.findMany({ where: { id: { in: produtoIds } }, select: { id: true } }),
  ]);
  if (!cliente) throw new AppError(404, "Cliente não encontrado.");
  if (!veiculo) throw new AppError(404, "Veículo não encontrado.");
  if (produtos.length !== new Set(produtoIds).size) throw new AppError(404, "Um ou mais produtos não foram encontrados.");
}

function buildProducts(produtos: any[]) {
  return produtos.map((produto) => {
    const quantidadeLitros = Number(produto.quantidadeLitros);
    const valorUnitario = Number(produto.valorUnitario);
    return {
      produtoId: produto.produtoId,
      quantidadeLitros,
      valorUnitario,
      valorTotal: Number((quantidadeLitros * valorUnitario).toFixed(2)),
    };
  });
}

function buildHeader(input: any, produtos: ReturnType<typeof buildProducts>) {
  const valorDesconto = Number(input.valorDesconto ?? 0);
  const valorBruto = produtos.reduce((sum, produto) => sum + produto.valorTotal, 0);
  if (valorDesconto > valorBruto) {
    throw new AppError(400, "O valor do desconto não pode ser maior que o valor bruto.");
  }
  return {
    clienteId: input.clienteId,
    veiculoId: input.veiculoId,
    dataEmissao: parseDateOnly(input.dataEmissao),
    valorDesconto,
    valorTotal: Number((valorBruto - valorDesconto).toFixed(2)),
    hodometro: Number(input.hodometro),
    pdfUrl: input.pdfUrl || null,
    ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
  };
}

export const abastecimentosService = {
  async list() {
    return (await prisma.abastecimento.findMany({
      include,
      orderBy: [{ hodometro: "desc" }, { dataEmissao: "desc" }, { createdAt: "desc" }],
    })).map(serialize);
  },

  async get(id: string) {
    const item = await prisma.abastecimento.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, "Abastecimento não encontrado.");
    return serialize(item);
  },

  async create(input: any) {
    const produtos = buildProducts(input.produtos);
    await ensureReferences(input.clienteId, input.veiculoId, produtos.map((p) => p.produtoId));
    return serialize(await prisma.abastecimento.create({
      data: {
        ...buildHeader(input, produtos),
        produtos: { create: produtos },
      },
      include,
    }));
  },

  async update(id: string, input: any) {
    const current = await prisma.abastecimento.findUnique({ where: { id }, include });
    if (!current) throw new AppError(404, "Abastecimento não encontrado.");
    const merged = {
      clienteId: input.clienteId ?? current.clienteId,
      veiculoId: input.veiculoId ?? current.veiculoId,
      dataEmissao: input.dataEmissao ?? dateOnly(current.dataEmissao),
      produtos: input.produtos ?? current.produtos.map((p) => ({
        produtoId: p.produtoId,
        quantidadeLitros: number(p.quantidadeLitros),
        valorUnitario: number(p.valorUnitario),
      })),
      valorDesconto: input.valorDesconto ?? number(current.valorDesconto),
      hodometro: input.hodometro ?? number(current.hodometro),
      pdfUrl: input.pdfUrl === undefined ? current.pdfUrl : input.pdfUrl,
    };
    const produtos = buildProducts(merged.produtos);
    await ensureReferences(merged.clienteId, merged.veiculoId, produtos.map((p) => p.produtoId));
    return serialize(await prisma.$transaction(async (tx) => {
      await tx.abastecimentoProduto.deleteMany({ where: { abastecimentoId: id } });
      return tx.abastecimento.update({
        where: { id },
        data: {
          ...buildHeader(merged, produtos),
          produtos: { create: produtos },
        },
        include,
      });
    }));
  },

  async remove(id: string) {
    await prisma.abastecimento.delete({ where: { id } });
  },
};
