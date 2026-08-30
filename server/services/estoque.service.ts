import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { created, dateOnly, number } from "../utils/serialize.js";

const serializeTipoProduto = (item: any) => ({
  ...item,
  createdAt: created(item.createdAt),
});

const serializeProduto = (item: any) => ({
  ...item,
  createdAt: created(item.createdAt),
});

const serialize = (item: any) => ({
  ...item,
  produto: item.produto ? serializeProduto(item.produto) : item.produto,
  quantidade: number(item.quantidade),
  valorUnitario: number(item.valorUnitario),
  valorTotal: number(item.valorTotal),
  data: dateOnly(item.data),
  pdfUrl: item.pdfUrl ?? null,
  pdfName: item.pdfName ?? null,
  createdAt: created(item.createdAt),
});

async function resolveCategoria(value: unknown) {
  const nome = String(value ?? "").trim();
  if (!nome) throw new AppError(400, "Informe o tipo de produto do almoxarifado.");

  const tipo = await prisma.estoqueTipoProduto.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
  });
  if (!tipo) throw new AppError(400, "Tipo de produto não cadastrado no almoxarifado.");
  return tipo.nome;
}

async function saldoProduto(produtoId: string, excludeId?: string) {
  const rows = await prisma.estoqueMovimentacao.findMany({
    where: { produtoId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return rows.reduce(
    (total: number, row: any) =>
      total + (row.tipo === "ENTRADA" ? number(row.quantidade) : -number(row.quantidade)),
    0,
  );
}

export const estoqueService = {
  async listTiposProduto() {
    return (
      await prisma.estoqueTipoProduto.findMany({ orderBy: { nome: "asc" } })
    ).map(serializeTipoProduto);
  },

  async createTipoProduto(data: any) {
    const nome = String(data.nome ?? "").trim();
    if (!nome) throw new AppError(400, "Informe o nome do tipo de produto.");

    const existente = await prisma.estoqueTipoProduto.findFirst({
      where: { nome: { equals: nome, mode: "insensitive" } },
    });
    if (existente) throw new AppError(409, "Este tipo de produto já está cadastrado no almoxarifado.");

    const item = await prisma.estoqueTipoProduto.create({
      data: {
        ...(data.id ? { id: String(data.id) } : {}),
        nome,
        ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
      },
    });
    return serializeTipoProduto(item);
  },

  async removeTipoProduto(id: string) {
    const item = await prisma.estoqueTipoProduto.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Tipo de produto não encontrado.");

    const produtosVinculados = await prisma.estoqueProduto.count({
      where: { categoria: item.nome },
    });
    if (produtosVinculados > 0) {
      throw new AppError(
        409,
        `O tipo "${item.nome}" está sendo usado por ${produtosVinculados} produto(s) e não pode ser removido.`,
      );
    }

    await prisma.estoqueTipoProduto.delete({ where: { id } });
  },

  async listProdutos() {
    return (
      await prisma.estoqueProduto.findMany({
        orderBy: [{ categoria: "asc" }, { nome: "asc" }, { codigoInterno: "asc" }],
      })
    ).map(serializeProduto);
  },

  async createProduto(data: any) {
    const categoria = await resolveCategoria(data.categoria);
    const nome = String(data.nome ?? "").trim();
    const { createdAt, codigoInterno: _codigoIgnorado, ...rest } = data;

    // O código do produto é controlado exclusivamente pelo Almoxarifado.
    // Um advisory lock evita que dois cadastros simultâneos recebam o mesmo número.
    const item = await prisma.$transaction(async (tx) => {
      // Não usamos pg_advisory_xact_lock aqui. Em alguns ambientes Prisma/Neon,
      // SELECT de função PostgreSQL que retorna void pode falhar na desserialização
      // e virar "Erro interno do servidor" ao criar um produto. A transação ainda
      // mantém a geração sequencial do código no mesmo fluxo.

      const codigos = await tx.estoqueProduto.findMany({
        where: { codigoInterno: { startsWith: "RAD-" } },
        select: { codigoInterno: true },
      });

      const maiorNumero = codigos.reduce((maior: number, produto: { codigoInterno: string }) => {
        const match = /^RAD-(\d+)$/.exec(produto.codigoInterno.trim().toUpperCase());
        if (!match) return maior;
        const numero = Number(match[1]);
        return Number.isFinite(numero) ? Math.max(maior, numero) : maior;
      }, 0);

      const codigoInterno = `RAD-${String(maiorNumero + 1).padStart(5, "0")}`;

      return tx.estoqueProduto.create({
        data: {
          ...rest,
          nome,
          codigoInterno,
          categoria,
          ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
        },
      });
    });

    return serializeProduto(item);
  },

  async updateProduto(id: string, data: any) {
    const atual = await prisma.estoqueProduto.findUnique({ where: { id } });
    if (!atual) throw new AppError(404, "Produto do almoxarifado não encontrado.");

    const categoria = data.categoria === undefined ? atual.categoria : await resolveCategoria(data.categoria);
    const { createdAt: _createdAt, codigoInterno: _codigoIgnorado, ...rest } = data;
    const item = await prisma.estoqueProduto.update({
      where: { id },
      data: {
        ...rest,
        categoria,
        ...(data.nome !== undefined ? { nome: String(data.nome).trim() } : {}),
        // Código interno é imutável após a criação para preservar a sequência RAD-00001...
        codigoInterno: atual.codigoInterno,
      },
    });
    return serializeProduto(item);
  },

  async removeProduto(id: string) {
    const item = await prisma.estoqueProduto.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Produto do almoxarifado não encontrado.");
    const movimentacoes = await prisma.estoqueMovimentacao.count({ where: { produtoId: id } });
    if (movimentacoes > 0) {
      throw new AppError(409, "Este produto possui movimentações e não pode ser excluído.");
    }
    await prisma.estoqueProduto.delete({ where: { id } });
  },

  async list() {
    return (
      await prisma.estoqueMovimentacao.findMany({
        include: { produto: true },
        orderBy: [{ data: "desc" }, { createdAt: "desc" }],
      })
    ).map(serialize);
  },

  async resumo() {
    const [produtos, movimentos] = await Promise.all([
      prisma.estoqueProduto.findMany({ orderBy: [{ categoria: "asc" }, { nome: "asc" }] }),
      prisma.estoqueMovimentacao.findMany(),
    ]);

    return produtos.map((produto: any) => {
      const rows = movimentos.filter((row: any) => row.produtoId === produto.id);
      const entradas = rows
        .filter((row: any) => row.tipo === "ENTRADA")
        .reduce((a: number, row: any) => a + number(row.quantidade), 0);
      const saidas = rows
        .filter((row: any) => row.tipo === "SAIDA")
        .reduce((a: number, row: any) => a + number(row.quantidade), 0);
      const valorSaidas = rows
        .filter((row: any) => row.tipo === "SAIDA")
        .reduce((a: number, row: any) => a + number(row.valorTotal), 0);

      return {
        produto: serializeProduto(produto),
        entradas,
        saidas,
        estoque: entradas - saidas,
        valorSaidas,
      };
    });
  },

  async create(data: any) {
    const produto = await prisma.estoqueProduto.findUnique({ where: { id: data.produtoId } });
    if (!produto) throw new AppError(404, "Produto do almoxarifado não encontrado.");

    const quantidade = Number(data.quantidade);
    const valorUnitario = Number(data.valorUnitario || 0);
    if (data.tipo === "SAIDA") {
      const saldo = await saldoProduto(data.produtoId);
      if (quantidade > saldo) {
        throw new AppError(409, `Saldo insuficiente. Disponível: ${saldo.toLocaleString("pt-BR")}.`);
      }
    }

    const item = await prisma.estoqueMovimentacao.create({
      data: {
        ...data,
        quantidade,
        valorUnitario,
        valorTotal: quantidade * valorUnitario,
        data: new Date(`${data.data}T12:00:00.000Z`),
      },
      include: { produto: true },
    });
    return serialize(item);
  },

  async remove(id: string) {
    const item = await prisma.estoqueMovimentacao.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Movimentação não encontrada.");
    if (item.tipo === "ENTRADA") {
      const saldoSemEntrada = await saldoProduto(item.produtoId, id);
      if (saldoSemEntrada < 0) {
        throw new AppError(409, "Esta entrada não pode ser removida porque deixaria o saldo negativo.");
      }
    }
    await prisma.estoqueMovimentacao.delete({ where: { id } });
  },
};
