import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { created, dateOnly, number } from "../utils/serialize.js";
import {
  AGRO_MOVIMENTOS_ENTRADA,
  AGRO_MOVIMENTOS_SAIDA,
  AGRO_TIPOS_MOVIMENTO,
  agroMovementDelta,
  calculateAgroAverageCosts,
  currentAgroAverageCost,
  currentAgroBalance,
  getDefaultAgroLocation,
} from "./agro-stock-core.js";

const TIPOS_MANUAIS = new Set(["ENTRADA", "SAIDA", "AJUSTE_ENTRADA", "AJUSTE_SAIDA"]);

function clean(value: unknown, max = 500) { return String(value ?? "").trim().slice(0, max); }
function decimal(value: unknown, field: string, allowZero = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) throw new AppError(400, `Informe ${field} válido.`);
  return parsed;
}
function parseDate(value: unknown, field = "uma data") {
  const raw = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AppError(400, `Informe ${field} válida.`);
  const parsed = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, `Informe ${field} válida.`);
  return parsed;
}
function optionalDate(value: unknown) { return value === null || value === undefined || clean(value) === "" ? null : parseDate(value, "a validade"); }
function ensureNotFuture(value: Date, label: string) {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (value >= tomorrow) throw new AppError(400, `${label} não pode ter data futura.`);
}
function productDto(item: any) { return { ...item, estoqueMinimo: number(item.estoqueMinimo), createdAt: created(item.createdAt), updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt }; }
function localDto(item: any) { return { ...item, createdAt: created(item.createdAt), updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt }; }
function lotDto(item: any, saldo?: number) { return { ...item, validade: item.validade ? dateOnly(item.validade) : null, saldo: saldo ?? undefined, createdAt: created(item.createdAt), updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt }; }
function movementDto(item: any) {
  return {
    ...item,
    quantidade: number(item.quantidade), valorUnitario: number(item.valorUnitario), data: dateOnly(item.data), createdAt: created(item.createdAt),
    produto: item.produto ? productDto(item.produto) : item.produto,
    lote: item.lote ? lotDto(item.lote) : item.lote,
    local: item.local ? localDto(item.local) : item.local,
  };
}
function transferDto(item: any) {
  return {
    ...item, quantidade: number(item.quantidade), valorUnitario: number(item.valorUnitario), data: dateOnly(item.data), createdAt: created(item.createdAt),
    produto: item.produto ? productDto(item.produto) : item.produto, lote: item.lote ? lotDto(item.lote) : item.lote,
    localOrigem: item.localOrigem ? localDto(item.localOrigem) : item.localOrigem, localDestino: item.localDestino ? localDto(item.localDestino) : item.localDestino,
  };
}
function inventoryItemDto(item: any) { return { ...item, saldoSistema: number(item.saldoSistema), contagemFisica: number(item.contagemFisica), diferenca: number(item.diferenca), custoUnitario: number(item.custoUnitario), produto: item.produto ? productDto(item.produto) : item.produto, lote: item.lote ? lotDto(item.lote) : item.lote }; }
function inventoryDto(item: any) { return { ...item, data: dateOnly(item.data), finalizadoEm: item.finalizadoEm?.toISOString?.() ?? null, createdAt: created(item.createdAt), updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt, local: item.local ? localDto(item.local) : item.local, itens: Array.isArray(item.itens) ? item.itens.map(inventoryItemDto) : item.itens }; }

function balancesFromGroups(rows: Array<{ produtoId: string; loteId?: string | null; tipo: string; _sum: { quantidade: unknown } }>) {
  const produtos = new Map<string, number>(); const lotes = new Map<string, number>();
  for (const row of rows) { const qty = row._sum.quantidade ?? 0; produtos.set(row.produtoId, (produtos.get(row.produtoId) ?? 0) + agroMovementDelta(row.tipo, qty)); if (row.loteId) lotes.set(row.loteId, (lotes.get(row.loteId) ?? 0) + agroMovementDelta(row.tipo, qty)); }
  return { produtos, lotes };
}
async function ensureUniqueProductName(nome: string, ignoreId?: string) {
  const existing = await prisma.agroProduto.findFirst({ where: { nome: { equals: nome, mode: "insensitive" }, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } });
  if (existing) throw new AppError(409, "Já existe um produto Agro cadastrado com este nome.");
}
async function nextProductCode(tx: any) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(72412601)');
  const last = await tx.agroProduto.findFirst({ where: { codigo: { startsWith: "AGR-" } }, select: { codigo: true }, orderBy: { codigo: "desc" } });
  return `AGR-${String(Math.max(0, Number(/^AGR-(\d+)$/.exec(last?.codigo ?? "")?.[1] ?? 0)) + 1).padStart(5, "0")}`;
}
async function nextLocationCode(tx: any) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(72412602)');
  const last = await tx.agroEstoqueLocal.findFirst({ where: { codigo: { startsWith: "BAR-" } }, select: { codigo: true }, orderBy: { codigo: "desc" } });
  return `BAR-${String(Math.max(0, Number(/^BAR-(\d+)$/.exec(last?.codigo ?? "")?.[1] ?? 0)) + 1).padStart(3, "0")}`;
}
function normalizeProduct(data: any, current?: any) {
  const nome = clean(data.nome ?? current?.nome, 160); if (!nome) throw new AppError(400, "Informe o nome do produto.");
  return { nome, categoria: clean(data.categoria ?? current?.categoria, 100), fabricante: clean(data.fabricante ?? current?.fabricante, 120), unidadeMedida: clean(data.unidadeMedida ?? current?.unidadeMedida ?? "UN", 20).toUpperCase() || "UN", estoqueMinimo: decimal(data.estoqueMinimo ?? current?.estoqueMinimo ?? 0, "um estoque mínimo", true), localizacao: clean(data.localizacao ?? current?.localizacao, 160), controlaLote: data.controlaLote === undefined ? Boolean(current?.controlaLote) : Boolean(data.controlaLote), ativo: data.ativo === undefined ? current?.ativo !== false : Boolean(data.ativo) };
}
async function resolveLocation(tx: any, rawId?: unknown) {
  const id = clean(rawId, 80);
  const local = id ? await tx.agroEstoqueLocal.findUnique({ where: { id } }) : await getDefaultAgroLocation(tx);
  if (!local) throw new AppError(404, "Local de estoque não encontrado.");
  if (!local.ativo) throw new AppError(409, "Este local de estoque está inativo.");
  return local;
}

export const agroEstoqueService = {
  async listLocais() { return (await prisma.agroEstoqueLocal.findMany({ orderBy: [{ principal: "desc" }, { ativo: "desc" }, { nome: "asc" }] })).map(localDto); },
  async createLocal(data: any) {
    const nome = clean(data.nome, 140); if (!nome) throw new AppError(400, "Informe o nome do barracão/local.");
    const duplicate = await prisma.agroEstoqueLocal.findFirst({ where: { nome: { equals: nome, mode: "insensitive" } }, select: { id: true } }); if (duplicate) throw new AppError(409, "Já existe um local com este nome.");
    return localDto(await prisma.$transaction(async (tx: any) => { const codigo = await nextLocationCode(tx); const first = (await tx.agroEstoqueLocal.count()) === 0; if (data.principal || first) await tx.agroEstoqueLocal.updateMany({ data: { principal: false } }); return tx.agroEstoqueLocal.create({ data: { codigo, nome, descricao: clean(data.descricao, 500), ativo: data.ativo !== false, principal: Boolean(data.principal || first) } }); }));
  },
  async updateLocal(id: string, data: any) {
    const current = await prisma.agroEstoqueLocal.findUnique({ where: { id } }); if (!current) throw new AppError(404, "Local de estoque não encontrado.");
    const nome = data.nome === undefined ? current.nome : clean(data.nome, 140); if (!nome) throw new AppError(400, "Informe o nome do local.");
    const duplicate = await prisma.agroEstoqueLocal.findFirst({ where: { nome: { equals: nome, mode: "insensitive" }, id: { not: id } }, select: { id: true } }); if (duplicate) throw new AppError(409, "Já existe um local com este nome.");
    if (data.ativo === false && current.ativo) { const groups = await prisma.agroMovimentacao.groupBy({ by: ["produtoId", "tipo"], where: { localId: id }, _sum: { quantidade: true } }); const balances = new Map<string, number>(); for (const row of groups) balances.set(row.produtoId, (balances.get(row.produtoId) ?? 0) + agroMovementDelta(String(row.tipo), row._sum.quantidade ?? 0)); if ([...balances.values()].some((v) => Math.abs(v) > 1e-9)) throw new AppError(409, "Transfira ou zere o estoque deste local antes de inativá-lo."); }
    return localDto(await prisma.$transaction(async (tx: any) => { if (data.principal === true) await tx.agroEstoqueLocal.updateMany({ where: { id: { not: id } }, data: { principal: false } }); return tx.agroEstoqueLocal.update({ where: { id }, data: { nome, ...(data.descricao !== undefined ? { descricao: clean(data.descricao, 500) } : {}), ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}), ...(data.principal !== undefined ? { principal: Boolean(data.principal) } : {}) } }); }));
  },

  async listProdutos() { return (await prisma.agroProduto.findMany({ orderBy: [{ ativo: "desc" }, { categoria: "asc" }, { nome: "asc" }], include: { _count: { select: { lotes: { where: { ativo: true } }, movimentacoes: true } } } })).map(productDto); },
  async createProduto(data: any) { const normalized = normalizeProduct(data); await ensureUniqueProductName(normalized.nome); const item = await prisma.$transaction(async (tx: any) => tx.agroProduto.create({ data: { codigo: await nextProductCode(tx), ...normalized } })); return productDto(item); },
  async updateProduto(id: string, data: any) {
    const current = await prisma.agroProduto.findUnique({ where: { id } }); if (!current) throw new AppError(404, "Produto Agro não encontrado."); const normalized = normalizeProduct(data, current); await ensureUniqueProductName(normalized.nome, id);
    if ((!normalized.ativo && current.ativo) || normalized.controlaLote !== current.controlaLote) { const saldo = await currentAgroBalance(prisma, id); if (Math.abs(saldo) > 1e-9) { if (!normalized.ativo && current.ativo) throw new AppError(409, "Zere o saldo do produto antes de inativá-lo."); throw new AppError(409, "Zere o saldo do produto antes de alterar o controle por lote."); } }
    return productDto(await prisma.agroProduto.update({ where: { id }, data: normalized }));
  },
  async removeProduto(id: string) {
    const current = await prisma.agroProduto.findUnique({ where: { id }, select: { id: true } }); if (!current) throw new AppError(404, "Produto Agro não encontrado.");
    const [movements, lots, saldo] = await Promise.all([prisma.agroMovimentacao.count({ where: { produtoId: id } }), prisma.agroLote.count({ where: { produtoId: id } }), currentAgroBalance(prisma, id)]);
    if (Math.abs(saldo) > 1e-9) throw new AppError(409, "Zere o saldo do produto antes de removê-lo ou inativá-lo.");
    if (movements > 0 || lots > 0) { await prisma.agroProduto.update({ where: { id }, data: { ativo: false } }); return { deactivated: true }; }
    await prisma.agroProduto.delete({ where: { id } }); return { deactivated: false };
  },

  async listEstoque(localId?: string) {
    const localFilter = clean(localId, 80);
    const [products, groups, lots, costs] = await Promise.all([
      prisma.agroProduto.findMany({ orderBy: [{ ativo: "desc" }, { categoria: "asc" }, { nome: "asc" }] }),
      prisma.agroMovimentacao.groupBy({ by: ["produtoId", "tipo"], where: localFilter ? { localId: localFilter } : {}, _sum: { quantidade: true } }),
      prisma.agroLote.findMany({ where: { ativo: true }, select: { id: true, produtoId: true, validade: true } }),
      calculateAgroAverageCosts(prisma),
    ]);
    const { produtos } = balancesFromGroups(groups as any); const lotStats = new Map<string, { quantidade: number; proximaValidade: Date | null }>();
    for (const lot of lots) { const entry = lotStats.get(lot.produtoId) ?? { quantidade: 0, proximaValidade: null }; entry.quantidade += 1; if (lot.validade && (!entry.proximaValidade || lot.validade < entry.proximaValidade)) entry.proximaValidade = lot.validade; lotStats.set(lot.produtoId, entry); }
    return products.map((item: any) => { const estoque = produtos.get(item.id) ?? 0; const stats = lotStats.get(item.id) ?? { quantidade: 0, proximaValidade: null }; const minimo = number(item.estoqueMinimo); const custoMedio = costs.get(item.id) ?? 0; return { produto: productDto(item), estoque, custoMedio, valorEstoque: estoque * custoMedio, abaixoMinimo: item.ativo && minimo > 0 && estoque <= minimo, semEstoque: item.ativo && estoque <= 0, lotesAtivos: stats.quantidade, proximaValidade: stats.proximaValidade ? dateOnly(stats.proximaValidade) : null }; });
  },
  async listLotes(produtoId: string, localId?: string) {
    const product = await prisma.agroProduto.findUnique({ where: { id: produtoId }, select: { id: true } }); if (!product) throw new AppError(404, "Produto Agro não encontrado."); const localFilter = clean(localId, 80);
    const [lots, groups] = await Promise.all([prisma.agroLote.findMany({ where: { produtoId }, orderBy: [{ ativo: "desc" }, { validade: "asc" }, { codigo: "asc" }] }), prisma.agroMovimentacao.groupBy({ by: ["produtoId", "loteId", "tipo"], where: { produtoId, loteId: { not: null }, ...(localFilter ? { localId: localFilter } : {}) }, _sum: { quantidade: true } })]);
    const { lotes } = balancesFromGroups(groups as any); return lots.map((item: any) => lotDto(item, lotes.get(item.id) ?? 0));
  },
  async createLote(data: any) {
    const produtoId = clean(data.produtoId, 80), codigo = clean(data.codigo, 100).toUpperCase(); if (!produtoId || !codigo) throw new AppError(400, "Informe o produto e o código do lote.");
    const product = await prisma.agroProduto.findUnique({ where: { id: produtoId }, select: { id: true, ativo: true } }); if (!product) throw new AppError(404, "Produto Agro não encontrado."); if (!product.ativo) throw new AppError(409, "Reative o produto antes de cadastrar novos lotes.");
    if (await prisma.agroLote.findFirst({ where: { produtoId, codigo: { equals: codigo, mode: "insensitive" } }, select: { id: true } })) throw new AppError(409, "Este lote já está cadastrado para o produto.");
    return lotDto(await prisma.agroLote.create({ data: { produtoId, codigo, validade: optionalDate(data.validade), localizacao: clean(data.localizacao, 160), observacoes: clean(data.observacoes, 2_000), ativo: data.ativo !== false } }), 0);
  },
  async updateLote(id: string, data: any) {
    const current = await prisma.agroLote.findUnique({ where: { id } }); if (!current) throw new AppError(404, "Lote Agro não encontrado."); const codigo = data.codigo === undefined ? current.codigo : clean(data.codigo, 100).toUpperCase(); if (!codigo) throw new AppError(400, "Informe o código do lote.");
    if (await prisma.agroLote.findFirst({ where: { produtoId: current.produtoId, codigo: { equals: codigo, mode: "insensitive" }, id: { not: id } }, select: { id: true } })) throw new AppError(409, "Este lote já está cadastrado para o produto.");
    if (data.ativo === false && current.ativo && Math.abs(await currentAgroBalance(prisma, current.produtoId, id)) > 1e-9) throw new AppError(409, "Zere o saldo do lote antes de inativá-lo.");
    return lotDto(await prisma.agroLote.update({ where: { id }, data: { codigo, ...(data.validade !== undefined ? { validade: optionalDate(data.validade) } : {}), ...(data.localizacao !== undefined ? { localizacao: clean(data.localizacao, 160) } : {}), ...(data.observacoes !== undefined ? { observacoes: clean(data.observacoes, 2_000) } : {}), ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}) } }));
  },
  async removeLote(id: string) {
    const current = await prisma.agroLote.findUnique({ where: { id } }); if (!current) throw new AppError(404, "Lote Agro não encontrado."); const [movements, saldo] = await Promise.all([prisma.agroMovimentacao.count({ where: { loteId: id } }), currentAgroBalance(prisma, current.produtoId, id)]); if (Math.abs(saldo) > 1e-9) throw new AppError(409, "Zere o saldo do lote antes de removê-lo ou inativá-lo."); if (movements > 0) { await prisma.agroLote.update({ where: { id }, data: { ativo: false } }); return { deactivated: true }; } await prisma.agroLote.delete({ where: { id } }); return { deactivated: false };
  },

  async listMovimentacoes(query: any) {
    const take = Math.min(1000, Math.max(1, Number(query.take) || 300)); const from = query.from ? parseDate(query.from, "a data inicial") : undefined, to = query.to ? parseDate(query.to, "a data final") : undefined; if (from && to && from > to) throw new AppError(400, "A data inicial não pode ser maior que a data final."); if (from && to && (to.getTime() - from.getTime()) / 86_400_000 > 366) throw new AppError(400, "Consulte no máximo 366 dias por vez."); const tipo = clean(query.tipo, 40).toUpperCase(); if (tipo && !AGRO_TIPOS_MOVIMENTO.has(tipo)) throw new AppError(400, "Tipo de movimentação inválido.");
    const rows = await prisma.agroMovimentacao.findMany({ where: { ...(clean(query.produtoId) ? { produtoId: clean(query.produtoId) } : {}), ...(clean(query.localId) ? { localId: clean(query.localId) } : {}), ...(tipo ? { tipo: tipo as any } : {}), ...((from || to) ? { data: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) }, include: { produto: true, lote: true, local: true, createdBy: { select: { id: true, name: true, username: true } } }, orderBy: [{ data: "desc" }, { createdAt: "desc" }], take }); return rows.map(movementDto);
  },
  async createMovimentacao(data: any, createdById?: string) {
    const produtoId = clean(data.produtoId, 80), loteId = clean(data.loteId, 80) || null, tipo = clean(data.tipo, 30).toUpperCase(); if (!produtoId) throw new AppError(400, "Selecione o produto."); if (!TIPOS_MANUAIS.has(tipo)) throw new AppError(400, "Tipo de movimentação manual inválido."); const quantidade = decimal(data.quantidade, "uma quantidade"); let valorUnitario = decimal(data.valorUnitario ?? 0, "um valor unitário", true); const dataMovimento = parseDate(data.data ?? new Date().toISOString().slice(0, 10), "a data da movimentação"); ensureNotFuture(dataMovimento, "A movimentação de estoque");
    try { const item = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe('SELECT "id" FROM "agro_produtos" WHERE "id" = $1 FOR UPDATE', produtoId); const produto = await tx.agroProduto.findUnique({ where: { id: produtoId } }); if (!produto) throw new AppError(404, "Produto Agro não encontrado."); if (!produto.ativo) throw new AppError(409, "Este produto está inativo."); const local = await resolveLocation(tx, data.localId);
      let lote: any = null; if (loteId) { lote = await tx.agroLote.findUnique({ where: { id: loteId } }); if (!lote || lote.produtoId !== produtoId) throw new AppError(400, "O lote informado não pertence ao produto selecionado."); if (!lote.ativo) throw new AppError(409, "Este lote está inativo."); } if (produto.controlaLote && !loteId) throw new AppError(400, "Selecione um lote para este produto.");
      if (AGRO_MOVIMENTOS_SAIDA.has(tipo)) { const saldoProduto = await currentAgroBalance(tx, produtoId, null, local.id); if (saldoProduto + 1e-9 < quantidade) throw new AppError(409, `Saldo insuficiente em ${local.nome}. Disponível: ${saldoProduto.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${produto.unidadeMedida}.`); if (loteId) { const saldoLote = await currentAgroBalance(tx, produtoId, loteId, local.id); if (saldoLote + 1e-9 < quantidade) throw new AppError(409, `Saldo insuficiente no lote ${lote.codigo} em ${local.nome}. Disponível: ${saldoLote.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${produto.unidadeMedida}.`); } valorUnitario = await currentAgroAverageCost(tx, produtoId); }
      else if (tipo === "AJUSTE_ENTRADA" && valorUnitario <= 0) valorUnitario = await currentAgroAverageCost(tx, produtoId);
      return tx.agroMovimentacao.create({ data: { produtoId, loteId, localId: local.id, tipo: tipo as any, quantidade, valorUnitario, data: dataMovimento, responsavel: clean(data.responsavel, 160), destino: clean(data.destino, 220), documento: clean(data.documento, 120), observacoes: clean(data.observacoes, 2_000), createdById: createdById || null }, include: { produto: true, lote: true, local: true, createdBy: { select: { id: true, name: true, username: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 12_000 }); return movementDto(item); } catch (error: any) { if (error instanceof AppError) throw error; if (error?.code === "P2034") throw new AppError(409, "O estoque foi alterado por outra operação. Tente novamente."); throw error; }
  },

  async listTransferencias(query: any) {
    const take = Math.min(500, Math.max(1, Number(query.take) || 200)); const rows = await prisma.agroTransferencia.findMany({ where: { ...(clean(query.localId) ? { OR: [{ localOrigemId: clean(query.localId) }, { localDestinoId: clean(query.localId) }] } : {}) }, include: { produto: true, lote: true, localOrigem: true, localDestino: true, createdBy: { select: { id: true, name: true, username: true } } }, orderBy: [{ data: "desc" }, { createdAt: "desc" }], take }); return rows.map(transferDto);
  },
  async createTransferencia(data: any, createdById?: string) {
    const produtoId = clean(data.produtoId, 80), loteId = clean(data.loteId, 80) || null, origemId = clean(data.localOrigemId, 80), destinoId = clean(data.localDestinoId, 80); if (!produtoId || !origemId || !destinoId) throw new AppError(400, "Informe produto, origem e destino."); if (origemId === destinoId) throw new AppError(400, "Origem e destino devem ser diferentes."); const quantidade = decimal(data.quantidade, "uma quantidade"); const date = parseDate(data.data ?? new Date().toISOString().slice(0, 10), "a data da transferência"); ensureNotFuture(date, "A transferência");
    try { const result = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe('SELECT "id" FROM "agro_produtos" WHERE "id" = $1 FOR UPDATE', produtoId); const [produto, origem, destino] = await Promise.all([tx.agroProduto.findUnique({ where: { id: produtoId } }), tx.agroEstoqueLocal.findUnique({ where: { id: origemId } }), tx.agroEstoqueLocal.findUnique({ where: { id: destinoId } })]); if (!produto || !produto.ativo) throw new AppError(404, "Produto ativo não encontrado."); if (!origem?.ativo || !destino?.ativo) throw new AppError(409, "Origem e destino precisam estar ativos."); let lote: any = null; if (loteId) { lote = await tx.agroLote.findUnique({ where: { id: loteId } }); if (!lote || lote.produtoId !== produtoId || !lote.ativo) throw new AppError(400, "Lote inválido para a transferência."); } if (produto.controlaLote && !loteId) throw new AppError(400, "Selecione o lote para transferir este produto."); const saldo = await currentAgroBalance(tx, produtoId, loteId, origemId); if (saldo + 1e-9 < quantidade) throw new AppError(409, `Saldo insuficiente em ${origem.nome}. Disponível: ${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${produto.unidadeMedida}.`); const custo = await currentAgroAverageCost(tx, produtoId);
      const transfer = await tx.agroTransferencia.create({ data: { produtoId, loteId, localOrigemId: origemId, localDestinoId: destinoId, quantidade, valorUnitario: custo, data: date, responsavel: clean(data.responsavel, 160), documento: clean(data.documento, 120), observacoes: clean(data.observacoes, 2_000), createdById: createdById || null } });
      const common = { produtoId, loteId, quantidade, valorUnitario: custo, data: date, responsavel: clean(data.responsavel, 160), documento: clean(data.documento, 120), createdById: createdById || null, transferenciaId: transfer.id };
      await tx.agroMovimentacao.create({ data: { ...common, localId: origemId, tipo: "TRANSFERENCIA_SAIDA", destino: destino.nome, observacoes: `Transferência para ${destino.nome}. ${clean(data.observacoes, 1_700)}`.trim() } });
      await tx.agroMovimentacao.create({ data: { ...common, localId: destinoId, tipo: "TRANSFERENCIA_ENTRADA", destino: origem.nome, observacoes: `Transferência recebida de ${origem.nome}. ${clean(data.observacoes, 1_700)}`.trim() } });
      return tx.agroTransferencia.findUnique({ where: { id: transfer.id }, include: { produto: true, lote: true, localOrigem: true, localDestino: true, createdBy: { select: { id: true, name: true, username: true } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 }); return transferDto(result); } catch (error: any) { if (error instanceof AppError) throw error; if (error?.code === "P2034") throw new AppError(409, "O estoque foi alterado durante a transferência. Tente novamente."); throw error; }
  },

  async listInventarios() { return (await prisma.agroInventario.findMany({ include: { local: true, createdBy: { select: { id: true, name: true, username: true } }, _count: { select: { itens: true } } }, orderBy: [{ data: "desc" }, { createdAt: "desc" }], take: 200 })).map(inventoryDto); },
  async getInventario(id: string) { const item = await prisma.agroInventario.findUnique({ where: { id }, include: { local: true, createdBy: { select: { id: true, name: true, username: true } }, itens: { include: { produto: true, lote: true }, orderBy: [{ produto: { nome: "asc" } }, { lote: { codigo: "asc" } }] } } }); if (!item) throw new AppError(404, "Inventário não encontrado."); return inventoryDto(item); },
  async createInventario(data: any, createdById?: string) {
    const date = parseDate(data.data ?? new Date().toISOString().slice(0, 10), "a data do inventário"); ensureNotFuture(date, "O inventário");
    return inventoryDto(await prisma.$transaction(async (tx: any) => {
      const local = await resolveLocation(tx, data.localId); if (await tx.agroInventario.count({ where: { localId: local.id, status: "ABERTO" } })) throw new AppError(409, `Já existe um inventário aberto em ${local.nome}.`);
      const [products, lots, groups, costs] = await Promise.all([tx.agroProduto.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }), tx.agroLote.findMany({ where: { ativo: true }, orderBy: { codigo: "asc" } }), tx.agroMovimentacao.groupBy({ by: ["produtoId", "loteId", "tipo"], where: { localId: local.id }, _sum: { quantidade: true } }), calculateAgroAverageCosts(tx)]); const { produtos, lotes: lotBalances } = balancesFromGroups(groups as any); const inv = await tx.agroInventario.create({ data: { localId: local.id, data: date, descricao: clean(data.descricao, 180), observacoes: clean(data.observacoes, 2_000), createdById: createdById || null } }); const lotsByProduct = new Map<string, any[]>(); for (const lot of lots) lotsByProduct.set(lot.produtoId, [...(lotsByProduct.get(lot.produtoId) ?? []), lot]);
      const itens: any[] = [];
      for (const product of products) { const custo = costs.get(product.id) ?? 0; if (product.controlaLote) { for (const lot of lotsByProduct.get(product.id) ?? []) { const saldo = lotBalances.get(lot.id) ?? 0; itens.push({ inventarioId: inv.id, produtoId: product.id, loteId: lot.id, saldoSistema: saldo, contagemFisica: saldo, diferenca: 0, custoUnitario: custo }); } } else { const saldo = produtos.get(product.id) ?? 0; itens.push({ inventarioId: inv.id, produtoId: product.id, saldoSistema: saldo, contagemFisica: saldo, diferenca: 0, custoUnitario: custo }); } }
      if (itens.length) await tx.agroInventarioItem.createMany({ data: itens });
      return tx.agroInventario.findUnique({ where: { id: inv.id }, include: { local: true, createdBy: { select: { id: true, name: true, username: true } }, itens: { include: { produto: true, lote: true }, orderBy: [{ produto: { nome: "asc" } }, { lote: { codigo: "asc" } }] } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 20_000 }));
  },
  async updateInventarioItem(inventarioId: string, itemId: string, data: any) {
    const item = await prisma.agroInventarioItem.findUnique({ where: { id: itemId }, include: { inventario: true } }); if (!item || item.inventarioId !== inventarioId) throw new AppError(404, "Item do inventário não encontrado."); if (item.inventario.status !== "ABERTO") throw new AppError(409, "Somente inventários abertos podem ser alterados."); const contagem = decimal(data.contagemFisica, "uma contagem física", true); const updated = await prisma.agroInventarioItem.update({ where: { id: itemId }, data: { contagemFisica: contagem, diferenca: contagem - number(item.saldoSistema) }, include: { produto: true, lote: true } }); return inventoryItemDto(updated);
  },
  async finalizarInventario(id: string, createdById?: string) {
    try { const result = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe('SELECT "id" FROM "agro_inventarios" WHERE "id" = $1 FOR UPDATE', id); const inv = await tx.agroInventario.findUnique({ where: { id }, include: { local: true, itens: { include: { produto: true, lote: true } } } }); if (!inv) throw new AppError(404, "Inventário não encontrado."); if (inv.status !== "ABERTO") throw new AppError(409, "Este inventário não está aberto."); const productIds = [...new Set(inv.itens.map((x: any) => x.produtoId))].sort(); for (const produtoId of productIds) await tx.$executeRawUnsafe('SELECT "id" FROM "agro_produtos" WHERE "id" = $1 FOR UPDATE', produtoId); const costs = await calculateAgroAverageCosts(tx, productIds);
      for (const item of inv.itens) { const atual = await currentAgroBalance(tx, item.produtoId, item.loteId, inv.localId); const fisico = number(item.contagemFisica); const diff = fisico - atual; const custo = costs.get(item.produtoId) ?? number(item.custoUnitario); await tx.agroInventarioItem.update({ where: { id: item.id }, data: { saldoSistema: atual, diferenca: diff, custoUnitario: custo } }); if (Math.abs(diff) > 1e-9) await tx.agroMovimentacao.create({ data: { produtoId: item.produtoId, loteId: item.loteId, localId: inv.localId, tipo: diff > 0 ? "INVENTARIO_ENTRADA" : "INVENTARIO_SAIDA", quantidade: Math.abs(diff), valorUnitario: custo, data: inv.data, responsavel: inv.createdById === createdById ? "Inventário" : "Conferência de inventário", destino: inv.local.nome, documento: `INVENTARIO-${inv.id.slice(-8).toUpperCase()}`, observacoes: `Ajuste automático do inventário: ${inv.descricao || inv.local.nome}.`, createdById: createdById || inv.createdById, inventarioId: inv.id } }); }
      await tx.agroInventario.update({ where: { id }, data: { status: "FINALIZADO", finalizadoEm: new Date() } }); return tx.agroInventario.findUnique({ where: { id }, include: { local: true, createdBy: { select: { id: true, name: true, username: true } }, itens: { include: { produto: true, lote: true }, orderBy: [{ produto: { nome: "asc" } }] } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 30_000 }); return inventoryDto(result); } catch (error: any) { if (error instanceof AppError) throw error; if (error?.code === "P2034") throw new AppError(409, "O estoque mudou durante a finalização do inventário. Tente novamente."); throw error; }
  },
  async cancelarInventario(id: string) { const inv = await prisma.agroInventario.findUnique({ where: { id } }); if (!inv) throw new AppError(404, "Inventário não encontrado."); if (inv.status !== "ABERTO") throw new AppError(409, "Somente inventários abertos podem ser cancelados."); return inventoryDto(await prisma.agroInventario.update({ where: { id }, data: { status: "CANCELADO" }, include: { local: true, _count: { select: { itens: true } } } })); },

  async dashboard() {
    const now = new Date(), todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), next60 = new Date(todayStart.getTime() + 60 * 86_400_000);
    const [estoque, movementsMonth, lotesVencendo, recent, lavourasEmAndamento, operacoesMes, locations, inventariosAbertos] = await Promise.all([this.listEstoque(), prisma.agroMovimentacao.findMany({ where: { data: { gte: monthStart }, tipo: { in: ["ENTRADA", "SAIDA", "AJUSTE_ENTRADA", "AJUSTE_SAIDA", "INVENTARIO_ENTRADA", "INVENTARIO_SAIDA"] } }, select: { produtoId: true, tipo: true, quantidade: true, valorUnitario: true } }), prisma.agroLote.count({ where: { ativo: true, validade: { gte: todayStart, lte: next60 } } }), prisma.agroMovimentacao.findMany({ include: { produto: true, lote: true, local: true, createdBy: { select: { id: true, name: true, username: true } } }, orderBy: [{ data: "desc" }, { createdAt: "desc" }], take: 8 }), prisma.agroLavoura.count({ where: { status: "EM_ANDAMENTO" } }), prisma.agroOperacao.count({ where: { data: { gte: monthStart } } }), prisma.agroEstoqueLocal.count({ where: { ativo: true } }), prisma.agroInventario.count({ where: { status: "ABERTO" } })]);
    const ativos = estoque.filter((row: any) => row.produto.ativo); const entradasMes = movementsMonth.filter((m: any) => AGRO_MOVIMENTOS_ENTRADA.has(String(m.tipo)) && !String(m.tipo).startsWith("TRANSFERENCIA")).length; const saidasMes = movementsMonth.filter((m: any) => AGRO_MOVIMENTOS_SAIDA.has(String(m.tipo)) && !String(m.tipo).startsWith("TRANSFERENCIA")).length; const valorEstoque = ativos.reduce((s: number, r: any) => s + number(r.valorEstoque), 0); const costByProduct = new Map(estoque.map((row: any) => [row.produto.id, number(row.custoMedio)])); const consumoMes = movementsMonth.filter((m: any) => String(m.tipo) === "SAIDA").reduce((s: number, m: any) => { const unit = number(m.valorUnitario) > 0 ? number(m.valorUnitario) : (costByProduct.get(m.produtoId) ?? 0); return s + number(m.quantidade) * unit; }, 0);
    return { produtosAtivos: ativos.length, produtosComSaldo: ativos.filter((r: any) => r.estoque > 0).length, estoqueBaixo: ativos.filter((r: any) => r.abaixoMinimo).length, valorEstoque, entradasMes, saidasMes, consumoMes, lotesVencendo, lavourasEmAndamento, operacoesMes, locaisAtivos: locations, inventariosAbertos, recent: recent.map(movementDto) };
  },
};
