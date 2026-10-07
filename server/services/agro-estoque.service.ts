import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { created, dateOnly, number } from "../utils/serialize.js";

const MOVIMENTOS_ENTRADA = new Set(["ENTRADA", "AJUSTE_ENTRADA"]);
const MOVIMENTOS_SAIDA = new Set(["SAIDA", "AJUSTE_SAIDA"]);
const TIPOS_MOVIMENTO = new Set([...MOVIMENTOS_ENTRADA, ...MOVIMENTOS_SAIDA]);

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function decimal(value: unknown, field: string, allowZero = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) {
    throw new AppError(400, `Informe ${field} válido.`);
  }
  return parsed;
}

function parseDate(value: unknown, field = "uma data") {
  const raw = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AppError(400, `Informe ${field} válida.`);
  const parsed = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, `Informe ${field} válida.`);
  return parsed;
}

function optionalDate(value: unknown) {
  if (value === null || value === undefined || clean(value) === "") return null;
  return parseDate(value, "a validade");
}

function productDto(item: any) {
  return {
    ...item,
    estoqueMinimo: number(item.estoqueMinimo),
    createdAt: created(item.createdAt),
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

function lotDto(item: any, saldo?: number) {
  return {
    ...item,
    validade: item.validade ? dateOnly(item.validade) : null,
    saldo: saldo ?? undefined,
    createdAt: created(item.createdAt),
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

function movementDto(item: any) {
  return {
    ...item,
    quantidade: number(item.quantidade),
    valorUnitario: number(item.valorUnitario),
    data: dateOnly(item.data),
    createdAt: created(item.createdAt),
    produto: item.produto ? productDto(item.produto) : item.produto,
    lote: item.lote ? lotDto(item.lote) : item.lote,
  };
}

function delta(tipo: string, quantidade: unknown) {
  const qty = number(quantidade);
  return MOVIMENTOS_ENTRADA.has(tipo) ? qty : -qty;
}

function balancesFromGroups(rows: Array<{ produtoId: string; loteId?: string | null; tipo: string; _sum: { quantidade: unknown } }>) {
  const produtos = new Map<string, number>();
  const lotes = new Map<string, number>();
  for (const row of rows) {
    const qty = row._sum.quantidade ?? 0;
    produtos.set(row.produtoId, (produtos.get(row.produtoId) ?? 0) + delta(row.tipo, qty));
    if (row.loteId) lotes.set(row.loteId, (lotes.get(row.loteId) ?? 0) + delta(row.tipo, qty));
  }
  return { produtos, lotes };
}

async function currentBalance(tx: any, produtoId: string, loteId?: string | null) {
  const rows = await tx.agroMovimentacao.groupBy({
    by: ["tipo"],
    where: { produtoId, ...(loteId ? { loteId } : {}) },
    _sum: { quantidade: true },
  });
  return rows.reduce((total: number, row: any) => total + delta(row.tipo, row._sum.quantidade ?? 0), 0);
}

async function ensureUniqueProductName(nome: string, ignoreId?: string) {
  const existing = await prisma.agroProduto.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" }, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new AppError(409, "Já existe um produto Agro cadastrado com este nome.");
}

async function nextProductCode(tx: any) {
  // Lock transacional curto para impedir dois cadastros de receberem o mesmo código.
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(72412601)');
  const last = await tx.agroProduto.findFirst({
    where: { codigo: { startsWith: "AGR-" } },
    select: { codigo: true },
    orderBy: { codigo: "desc" },
  });
  const n = Math.max(0, Number(/^AGR-(\d+)$/.exec(last?.codigo ?? "")?.[1] ?? 0)) + 1;
  return `AGR-${String(n).padStart(5, "0")}`;
}

function normalizeProduct(data: any, current?: any) {
  const nome = clean(data.nome ?? current?.nome, 160);
  if (!nome) throw new AppError(400, "Informe o nome do produto.");
  const unidadeMedida = clean(data.unidadeMedida ?? current?.unidadeMedida ?? "UN", 20).toUpperCase() || "UN";
  const estoqueMinimoValue = data.estoqueMinimo ?? current?.estoqueMinimo ?? 0;
  const estoqueMinimo = decimal(estoqueMinimoValue, "um estoque mínimo", true);
  return {
    nome,
    categoria: clean(data.categoria ?? current?.categoria, 100),
    fabricante: clean(data.fabricante ?? current?.fabricante, 120),
    unidadeMedida,
    estoqueMinimo,
    localizacao: clean(data.localizacao ?? current?.localizacao, 160),
    controlaLote: data.controlaLote === undefined ? Boolean(current?.controlaLote) : Boolean(data.controlaLote),
    ativo: data.ativo === undefined ? current?.ativo !== false : Boolean(data.ativo),
  };
}

export const agroEstoqueService = {
  async listProdutos() {
    const products = await prisma.agroProduto.findMany({
      orderBy: [{ ativo: "desc" }, { categoria: "asc" }, { nome: "asc" }],
      include: { _count: { select: { lotes: { where: { ativo: true } }, movimentacoes: true } } },
    });
    return products.map(productDto);
  },

  async createProduto(data: any) {
    const normalized = normalizeProduct(data);
    await ensureUniqueProductName(normalized.nome);
    const item = await prisma.$transaction(async (tx: any) => {
      const codigo = await nextProductCode(tx);
      return tx.agroProduto.create({ data: { codigo, ...normalized } });
    });
    return productDto(item);
  },

  async updateProduto(id: string, data: any) {
    const current = await prisma.agroProduto.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Produto Agro não encontrado.");
    const normalized = normalizeProduct(data, current);
    await ensureUniqueProductName(normalized.nome, id);
    if ((!normalized.ativo && current.ativo) || normalized.controlaLote !== current.controlaLote) {
      const saldo = await currentBalance(prisma, id);
      if (Math.abs(saldo) > 1e-9) {
        if (!normalized.ativo && current.ativo) throw new AppError(409, "Zere o saldo do produto antes de inativá-lo.");
        throw new AppError(409, "Zere o saldo do produto antes de alterar o controle por lote.");
      }
    }
    const item = await prisma.agroProduto.update({ where: { id }, data: normalized });
    return productDto(item);
  },

  async removeProduto(id: string) {
    const current = await prisma.agroProduto.findUnique({ where: { id }, select: { id: true, ativo: true } });
    if (!current) throw new AppError(404, "Produto Agro não encontrado.");
    const [movements, lots, saldo] = await Promise.all([
      prisma.agroMovimentacao.count({ where: { produtoId: id } }),
      prisma.agroLote.count({ where: { produtoId: id } }),
      currentBalance(prisma, id),
    ]);
    if (Math.abs(saldo) > 1e-9) throw new AppError(409, "Zere o saldo do produto antes de removê-lo ou inativá-lo.");
    if (movements > 0 || lots > 0) {
      await prisma.agroProduto.update({ where: { id }, data: { ativo: false } });
      return { deactivated: true };
    }
    await prisma.agroProduto.delete({ where: { id } });
    return { deactivated: false };
  },

  async listEstoque() {
    const [products, groups, lots] = await Promise.all([
      prisma.agroProduto.findMany({ orderBy: [{ ativo: "desc" }, { categoria: "asc" }, { nome: "asc" }] }),
      prisma.agroMovimentacao.groupBy({ by: ["produtoId", "tipo"], _sum: { quantidade: true } }),
      prisma.agroLote.findMany({ where: { ativo: true }, select: { id: true, produtoId: true, validade: true } }),
    ]);
    const { produtos } = balancesFromGroups(groups as any);
    const lotStats = new Map<string, { quantidade: number; proximaValidade: Date | null }>();
    for (const lot of lots) {
      const entry = lotStats.get(lot.produtoId) ?? { quantidade: 0, proximaValidade: null };
      entry.quantidade += 1;
      if (lot.validade && (!entry.proximaValidade || lot.validade < entry.proximaValidade)) entry.proximaValidade = lot.validade;
      lotStats.set(lot.produtoId, entry);
    }
    return products.map((item: any) => {
      const estoque = produtos.get(item.id) ?? 0;
      const stats = lotStats.get(item.id) ?? { quantidade: 0, proximaValidade: null };
      const minimo = number(item.estoqueMinimo);
      return {
        produto: productDto(item),
        estoque,
        abaixoMinimo: item.ativo && minimo > 0 && estoque <= minimo,
        semEstoque: item.ativo && estoque <= 0,
        lotesAtivos: stats.quantidade,
        proximaValidade: stats.proximaValidade ? dateOnly(stats.proximaValidade) : null,
      };
    });
  },

  async listLotes(produtoId: string) {
    const product = await prisma.agroProduto.findUnique({ where: { id: produtoId }, select: { id: true } });
    if (!product) throw new AppError(404, "Produto Agro não encontrado.");
    const [lots, groups] = await Promise.all([
      prisma.agroLote.findMany({ where: { produtoId }, orderBy: [{ ativo: "desc" }, { validade: "asc" }, { codigo: "asc" }] }),
      prisma.agroMovimentacao.groupBy({ by: ["produtoId", "loteId", "tipo"], where: { produtoId, loteId: { not: null } }, _sum: { quantidade: true } }),
    ]);
    const { lotes } = balancesFromGroups(groups as any);
    return lots.map((item: any) => lotDto(item, lotes.get(item.id) ?? 0));
  },

  async createLote(data: any) {
    const produtoId = clean(data.produtoId, 80);
    const codigo = clean(data.codigo, 100).toUpperCase();
    if (!produtoId || !codigo) throw new AppError(400, "Informe o produto e o código do lote.");
    const product = await prisma.agroProduto.findUnique({ where: { id: produtoId }, select: { id: true, ativo: true } });
    if (!product) throw new AppError(404, "Produto Agro não encontrado.");
    if (!product.ativo) throw new AppError(409, "Reative o produto antes de cadastrar novos lotes.");
    const duplicate = await prisma.agroLote.findFirst({ where: { produtoId, codigo: { equals: codigo, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) throw new AppError(409, "Este lote já está cadastrado para o produto.");
    const item = await prisma.agroLote.create({ data: {
      produtoId,
      codigo,
      validade: optionalDate(data.validade),
      localizacao: clean(data.localizacao, 160),
      observacoes: clean(data.observacoes, 2_000),
      ativo: data.ativo !== false,
    } });
    return lotDto(item, 0);
  },

  async updateLote(id: string, data: any) {
    const current = await prisma.agroLote.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Lote Agro não encontrado.");
    const codigo = data.codigo === undefined ? current.codigo : clean(data.codigo, 100).toUpperCase();
    if (!codigo) throw new AppError(400, "Informe o código do lote.");
    const duplicate = await prisma.agroLote.findFirst({
      where: { produtoId: current.produtoId, codigo: { equals: codigo, mode: "insensitive" }, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) throw new AppError(409, "Este lote já está cadastrado para o produto.");
    if (data.ativo === false && current.ativo) {
      const saldo = await currentBalance(prisma, current.produtoId, id);
      if (Math.abs(saldo) > 1e-9) throw new AppError(409, "Zere o saldo do lote antes de inativá-lo.");
    }
    const item = await prisma.agroLote.update({ where: { id }, data: {
      codigo,
      ...(data.validade !== undefined ? { validade: optionalDate(data.validade) } : {}),
      ...(data.localizacao !== undefined ? { localizacao: clean(data.localizacao, 160) } : {}),
      ...(data.observacoes !== undefined ? { observacoes: clean(data.observacoes, 2_000) } : {}),
      ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}),
    } });
    return lotDto(item);
  },

  async removeLote(id: string) {
    const current = await prisma.agroLote.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Lote Agro não encontrado.");
    const [movements, saldo] = await Promise.all([
      prisma.agroMovimentacao.count({ where: { loteId: id } }),
      currentBalance(prisma, current.produtoId, id),
    ]);
    if (Math.abs(saldo) > 1e-9) throw new AppError(409, "Zere o saldo do lote antes de removê-lo ou inativá-lo.");
    if (movements > 0) {
      await prisma.agroLote.update({ where: { id }, data: { ativo: false } });
      return { deactivated: true };
    }
    await prisma.agroLote.delete({ where: { id } });
    return { deactivated: false };
  },

  async listMovimentacoes(query: any) {
    const take = Math.min(500, Math.max(1, Number(query.take) || 200));
    const from = query.from ? parseDate(query.from, "a data inicial") : undefined;
    const to = query.to ? parseDate(query.to, "a data final") : undefined;
    if (from && to && from > to) throw new AppError(400, "A data inicial não pode ser maior que a data final.");
    if (from && to && (to.getTime() - from.getTime()) / 86_400_000 > 366) throw new AppError(400, "Consulte no máximo 366 dias por vez.");
    const tipo = clean(query.tipo, 30).toUpperCase();
    if (tipo && !TIPOS_MOVIMENTO.has(tipo)) throw new AppError(400, "Tipo de movimentação inválido.");
    const rows = await prisma.agroMovimentacao.findMany({
      where: {
        ...(clean(query.produtoId) ? { produtoId: clean(query.produtoId) } : {}),
        ...(tipo ? { tipo: tipo as any } : {}),
        ...((from || to) ? { data: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: {
        produto: true,
        lote: true,
        createdBy: { select: { id: true, name: true, username: true } },
      },
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map(movementDto);
  },

  async createMovimentacao(data: any, createdById?: string) {
    const produtoId = clean(data.produtoId, 80);
    const loteId = clean(data.loteId, 80) || null;
    const tipo = clean(data.tipo, 30).toUpperCase();
    if (!produtoId) throw new AppError(400, "Selecione o produto.");
    if (!TIPOS_MOVIMENTO.has(tipo)) throw new AppError(400, "Tipo de movimentação inválido.");
    const quantidade = decimal(data.quantidade, "uma quantidade");
    const valorUnitario = decimal(data.valorUnitario ?? 0, "um valor unitário", true);
    const dataMovimento = parseDate(data.data ?? new Date().toISOString().slice(0, 10), "a data da movimentação");
    const now = new Date();
    const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    if (dataMovimento >= tomorrowUtc) throw new AppError(400, "A movimentação de estoque não pode ter data futura.");

    try {
      const item = await prisma.$transaction(async (tx: any) => {
        // Serializa movimentações do mesmo produto durante a validação de saldo.
        await tx.$executeRawUnsafe('SELECT "id" FROM "agro_produtos" WHERE "id" = $1 FOR UPDATE', produtoId);
        const produto = await tx.agroProduto.findUnique({ where: { id: produtoId } });
        if (!produto) throw new AppError(404, "Produto Agro não encontrado.");
        if (!produto.ativo) throw new AppError(409, "Este produto está inativo.");

        let lote: any = null;
        if (loteId) {
          lote = await tx.agroLote.findUnique({ where: { id: loteId } });
          if (!lote || lote.produtoId !== produtoId) throw new AppError(400, "O lote informado não pertence ao produto selecionado.");
          if (!lote.ativo) throw new AppError(409, "Este lote está inativo.");
        }
        if (produto.controlaLote && !loteId) throw new AppError(400, "Selecione um lote para este produto.");

        if (MOVIMENTOS_SAIDA.has(tipo)) {
          const saldoProduto = await currentBalance(tx, produtoId);
          if (saldoProduto + 1e-9 < quantidade) {
            throw new AppError(409, `Saldo insuficiente. Disponível: ${saldoProduto.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${produto.unidadeMedida}.`);
          }
          if (loteId) {
            const saldoLote = await currentBalance(tx, produtoId, loteId);
            if (saldoLote + 1e-9 < quantidade) {
              throw new AppError(409, `Saldo insuficiente no lote ${lote.codigo}. Disponível: ${saldoLote.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${produto.unidadeMedida}.`);
            }
          }
        }

        return tx.agroMovimentacao.create({
          data: {
            produtoId,
            loteId,
            tipo: tipo as any,
            quantidade,
            valorUnitario,
            data: dataMovimento,
            responsavel: clean(data.responsavel, 160),
            destino: clean(data.destino, 220),
            documento: clean(data.documento, 120),
            observacoes: clean(data.observacoes, 2_000),
            createdById: createdById || null,
          },
          include: { produto: true, lote: true, createdBy: { select: { id: true, name: true, username: true } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
      return movementDto(item);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === "P2034") throw new AppError(409, "O estoque foi alterado por outra operação. Tente novamente.");
      throw error;
    }
  },

  async dashboard() {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const next60 = new Date(todayStart.getTime() + 60 * 86_400_000);
    const [estoque, saidasMes, lotesVencendo, recent] = await Promise.all([
      this.listEstoque(),
      prisma.agroMovimentacao.count({ where: { data: { gte: monthStart }, tipo: { in: ["SAIDA", "AJUSTE_SAIDA"] } } }),
      prisma.agroLote.count({ where: { ativo: true, validade: { gte: todayStart, lte: next60 } } }),
      prisma.agroMovimentacao.findMany({
        include: { produto: true, lote: true, createdBy: { select: { id: true, name: true, username: true } } },
        orderBy: [{ data: "desc" }, { createdAt: "desc" }],
        take: 8,
      }),
    ]);
    const ativos = estoque.filter((row: any) => row.produto.ativo);
    return {
      produtosAtivos: ativos.length,
      produtosComSaldo: ativos.filter((row: any) => row.estoque > 0).length,
      estoqueBaixo: ativos.filter((row: any) => row.abaixoMinimo).length,
      saidasMes,
      lotesVencendo,
      recent: recent.map(movementDto),
    };
  },
};
