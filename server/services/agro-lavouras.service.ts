import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { created, dateOnly, number } from "../utils/serialize.js";

const STATUS_LAVOURA = new Set(["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA"]);
const TIPOS_OPERACAO = new Set(["PLANTIO", "ADUBACAO", "PULVERIZACAO", "APLICACAO", "MONITORAMENTO", "COLHEITA", "OUTROS"]);
const MOVIMENTOS_ENTRADA = new Set(["ENTRADA", "AJUSTE_ENTRADA"]);

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

function parseDate(value: unknown, field: string, optional = false) {
  const raw = clean(value, 10);
  if (optional && !raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AppError(400, `Informe ${field} válida.`);
  const parsed = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, `Informe ${field} válida.`);
  return parsed;
}

function dateIsFuture(value: Date) {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return value >= tomorrow;
}

function farmDto(item: any) {
  return {
    ...item,
    areaTotalHa: number(item.areaTotalHa),
    createdAt: created(item.createdAt),
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

function plotDto(item: any) {
  return {
    ...item,
    areaHa: number(item.areaHa),
    fazenda: item.fazenda ? farmDto(item.fazenda) : item.fazenda,
    createdAt: created(item.createdAt),
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

function seasonDto(item: any) {
  return {
    ...item,
    dataInicio: item.dataInicio ? dateOnly(item.dataInicio) : null,
    dataFim: item.dataFim ? dateOnly(item.dataFim) : null,
    createdAt: created(item.createdAt),
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

function cropDto(item: any) {
  return {
    ...item,
    createdAt: created(item.createdAt),
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

function cropCycleDto(item: any) {
  return {
    ...item,
    areaHa: number(item.areaHa),
    dataPlantio: item.dataPlantio ? dateOnly(item.dataPlantio) : null,
    dataPrevisaoColheita: item.dataPrevisaoColheita ? dateOnly(item.dataPrevisaoColheita) : null,
    talhao: item.talhao ? plotDto(item.talhao) : item.talhao,
    safra: item.safra ? seasonDto(item.safra) : item.safra,
    cultura: item.cultura ? cropDto(item.cultura) : item.cultura,
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
    produto: item.produto ? { ...item.produto, estoqueMinimo: number(item.produto.estoqueMinimo) } : item.produto,
    lote: item.lote ? { ...item.lote, validade: item.lote.validade ? dateOnly(item.lote.validade) : null } : item.lote,
  };
}

function operationDto(item: any) {
  return {
    ...item,
    areaHa: number(item.areaHa),
    data: dateOnly(item.data),
    lavoura: item.lavoura ? cropCycleDto(item.lavoura) : item.lavoura,
    movimentacoes: Array.isArray(item.movimentacoes) ? item.movimentacoes.map(movementDto) : item.movimentacoes,
    createdAt: created(item.createdAt),
  };
}

async function ensureUniqueName(model: "agroFazenda" | "agroSafra" | "agroCultura", nome: string, ignoreId?: string) {
  const existing = await (prisma as any)[model].findFirst({
    where: { nome: { equals: nome, mode: "insensitive" }, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new AppError(409, "Já existe um cadastro Agro com este nome.");
}

async function currentBalance(tx: any, produtoId: string, loteId?: string | null) {
  const rows = await tx.agroMovimentacao.groupBy({
    by: ["tipo"],
    where: { produtoId, ...(loteId ? { loteId } : {}) },
    _sum: { quantidade: true },
  });
  return rows.reduce((total: number, row: any) => {
    const qty = number(row._sum.quantidade ?? 0);
    return total + (MOVIMENTOS_ENTRADA.has(String(row.tipo)) ? qty : -qty);
  }, 0);
}

function normalizeProducts(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ produtoId: string; loteId: string | null; quantidade: number; valorUnitario: number }>;
  if (value.length > 30) throw new AppError(400, "Informe no máximo 30 produtos por operação.");
  const seen = new Set<string>();
  return value.map((raw: any) => {
    const produtoId = clean(raw?.produtoId, 80);
    const loteId = clean(raw?.loteId, 80) || null;
    if (!produtoId) throw new AppError(400, "Selecione o produto utilizado na operação.");
    const quantidade = decimal(raw?.quantidade, "uma quantidade de produto");
    const valorUnitario = decimal(raw?.valorUnitario ?? 0, "um valor unitário", true);
    const key = `${produtoId}:${loteId ?? ""}`;
    if (seen.has(key)) throw new AppError(400, "O mesmo produto/lote foi informado mais de uma vez na operação.");
    seen.add(key);
    return { produtoId, loteId, quantidade, valorUnitario };
  });
}

export const agroLavourasService = {
  async listFazendas() {
    const rows = await prisma.agroFazenda.findMany({
      include: { _count: { select: { talhoes: true } } },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    });
    return rows.map(farmDto);
  },

  async createFazenda(data: any) {
    const nome = clean(data.nome, 160);
    if (!nome) throw new AppError(400, "Informe o nome da fazenda.");
    await ensureUniqueName("agroFazenda", nome);
    const row = await prisma.agroFazenda.create({ data: {
      nome,
      cidade: clean(data.cidade, 120),
      uf: clean(data.uf, 2).toUpperCase(),
      areaTotalHa: decimal(data.areaTotalHa ?? 0, "uma área total", true),
      observacoes: clean(data.observacoes, 2_000),
      ativo: data.ativo !== false,
    } });
    return farmDto(row);
  },

  async updateFazenda(id: string, data: any) {
    const current = await prisma.agroFazenda.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Fazenda não encontrada.");
    const nome = data.nome === undefined ? current.nome : clean(data.nome, 160);
    if (!nome) throw new AppError(400, "Informe o nome da fazenda.");
    await ensureUniqueName("agroFazenda", nome, id);
    const row = await prisma.agroFazenda.update({ where: { id }, data: {
      nome,
      ...(data.cidade !== undefined ? { cidade: clean(data.cidade, 120) } : {}),
      ...(data.uf !== undefined ? { uf: clean(data.uf, 2).toUpperCase() } : {}),
      ...(data.areaTotalHa !== undefined ? { areaTotalHa: decimal(data.areaTotalHa, "uma área total", true) } : {}),
      ...(data.observacoes !== undefined ? { observacoes: clean(data.observacoes, 2_000) } : {}),
      ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}),
    } });
    return farmDto(row);
  },

  async listTalhoes(fazendaId?: string) {
    const rows = await prisma.agroTalhao.findMany({
      where: clean(fazendaId) ? { fazendaId: clean(fazendaId) } : {},
      include: { fazenda: true, _count: { select: { lavouras: true } } },
      orderBy: [{ ativo: "desc" }, { fazenda: { nome: "asc" } }, { nome: "asc" }],
    });
    return rows.map(plotDto);
  },

  async createTalhao(data: any) {
    const fazendaId = clean(data.fazendaId, 80);
    const nome = clean(data.nome, 120);
    if (!fazendaId) throw new AppError(400, "Selecione a fazenda.");
    if (!nome) throw new AppError(400, "Informe o nome do talhão.");
    const fazenda = await prisma.agroFazenda.findUnique({ where: { id: fazendaId }, select: { id: true, ativo: true } });
    if (!fazenda) throw new AppError(404, "Fazenda não encontrada.");
    if (!fazenda.ativo) throw new AppError(409, "Reative a fazenda antes de cadastrar talhões.");
    const duplicate = await prisma.agroTalhao.findFirst({ where: { fazendaId, nome: { equals: nome, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) throw new AppError(409, "Já existe um talhão com este nome nesta fazenda.");
    const row = await prisma.agroTalhao.create({ data: {
      fazendaId,
      nome,
      areaHa: decimal(data.areaHa ?? 0, "uma área", true),
      observacoes: clean(data.observacoes, 2_000),
      ativo: data.ativo !== false,
    }, include: { fazenda: true } });
    return plotDto(row);
  },

  async updateTalhao(id: string, data: any) {
    const current = await prisma.agroTalhao.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Talhão não encontrado.");
    const fazendaId = data.fazendaId === undefined ? current.fazendaId : clean(data.fazendaId, 80);
    const nome = data.nome === undefined ? current.nome : clean(data.nome, 120);
    if (!fazendaId || !nome) throw new AppError(400, "Informe fazenda e nome do talhão.");
    const duplicate = await prisma.agroTalhao.findFirst({ where: { fazendaId, nome: { equals: nome, mode: "insensitive" }, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new AppError(409, "Já existe um talhão com este nome nesta fazenda.");
    const row = await prisma.agroTalhao.update({ where: { id }, data: {
      fazendaId,
      nome,
      ...(data.areaHa !== undefined ? { areaHa: decimal(data.areaHa, "uma área", true) } : {}),
      ...(data.observacoes !== undefined ? { observacoes: clean(data.observacoes, 2_000) } : {}),
      ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}),
    }, include: { fazenda: true } });
    return plotDto(row);
  },

  async listSafras() {
    const rows = await prisma.agroSafra.findMany({ include: { _count: { select: { lavouras: true } } }, orderBy: [{ ativo: "desc" }, { nome: "desc" }] });
    return rows.map(seasonDto);
  },

  async createSafra(data: any) {
    const nome = clean(data.nome, 80);
    if (!nome) throw new AppError(400, "Informe o nome da safra.");
    await ensureUniqueName("agroSafra", nome);
    const dataInicio = parseDate(data.dataInicio, "a data inicial", true);
    const dataFim = parseDate(data.dataFim, "a data final", true);
    if (dataInicio && dataFim && dataFim < dataInicio) throw new AppError(400, "A data final da safra não pode ser anterior à inicial.");
    const row = await prisma.agroSafra.create({ data: { nome, dataInicio, dataFim, ativo: data.ativo !== false } });
    return seasonDto(row);
  },

  async updateSafra(id: string, data: any) {
    const current = await prisma.agroSafra.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Safra não encontrada.");
    const nome = data.nome === undefined ? current.nome : clean(data.nome, 80);
    if (!nome) throw new AppError(400, "Informe o nome da safra.");
    await ensureUniqueName("agroSafra", nome, id);
    const dataInicio = data.dataInicio === undefined ? current.dataInicio : parseDate(data.dataInicio, "a data inicial", true);
    const dataFim = data.dataFim === undefined ? current.dataFim : parseDate(data.dataFim, "a data final", true);
    if (dataInicio && dataFim && dataFim < dataInicio) throw new AppError(400, "A data final da safra não pode ser anterior à inicial.");
    const row = await prisma.agroSafra.update({ where: { id }, data: { nome, dataInicio, dataFim, ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}) } });
    return seasonDto(row);
  },

  async listCulturas() {
    const rows = await prisma.agroCultura.findMany({ include: { _count: { select: { lavouras: true } } }, orderBy: [{ ativo: "desc" }, { nome: "asc" }] });
    return rows.map(cropDto);
  },

  async createCultura(data: any) {
    const nome = clean(data.nome, 100);
    if (!nome) throw new AppError(400, "Informe o nome da cultura.");
    await ensureUniqueName("agroCultura", nome);
    return cropDto(await prisma.agroCultura.create({ data: { nome, ativo: data.ativo !== false } }));
  },

  async updateCultura(id: string, data: any) {
    const current = await prisma.agroCultura.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Cultura não encontrada.");
    const nome = data.nome === undefined ? current.nome : clean(data.nome, 100);
    if (!nome) throw new AppError(400, "Informe o nome da cultura.");
    await ensureUniqueName("agroCultura", nome, id);
    return cropDto(await prisma.agroCultura.update({ where: { id }, data: { nome, ...(data.ativo !== undefined ? { ativo: Boolean(data.ativo) } : {}) } }));
  },

  async listLavouras() {
    const rows = await prisma.agroLavoura.findMany({
      include: {
        talhao: { include: { fazenda: true } },
        safra: true,
        cultura: true,
        _count: { select: { operacoes: true } },
      },
      orderBy: [{ status: "asc" }, { safra: { nome: "desc" } }, { talhao: { nome: "asc" } }],
    });
    return rows.map(cropCycleDto);
  },

  async createLavoura(data: any) {
    const talhaoId = clean(data.talhaoId, 80);
    const safraId = clean(data.safraId, 80);
    const culturaId = clean(data.culturaId, 80);
    if (!talhaoId || !safraId || !culturaId) throw new AppError(400, "Selecione talhão, safra e cultura.");
    const [talhao, safra, cultura] = await Promise.all([
      prisma.agroTalhao.findUnique({ where: { id: talhaoId }, include: { fazenda: true } }),
      prisma.agroSafra.findUnique({ where: { id: safraId } }),
      prisma.agroCultura.findUnique({ where: { id: culturaId } }),
    ]);
    if (!talhao || !safra || !cultura) throw new AppError(404, "Talhão, safra ou cultura não encontrado.");
    if (!talhao.ativo || !talhao.fazenda.ativo || !safra.ativo || !cultura.ativo) throw new AppError(409, "Reative os cadastros selecionados antes de criar a lavoura.");
    const duplicate = await prisma.agroLavoura.findFirst({ where: { talhaoId, safraId, culturaId }, select: { id: true } });
    if (duplicate) throw new AppError(409, "Esta cultura já está vinculada ao talhão nesta safra.");
    const areaHa = data.areaHa === undefined || data.areaHa === "" ? number(talhao.areaHa) : decimal(data.areaHa, "uma área", true);
    if (number(talhao.areaHa) > 0 && areaHa > number(talhao.areaHa) + 1e-9) throw new AppError(400, "A área da lavoura não pode ser maior que a área do talhão.");
    const status = clean(data.status || "PLANEJADA", 30).toUpperCase();
    if (!STATUS_LAVOURA.has(status)) throw new AppError(400, "Status da lavoura inválido.");
    const row = await prisma.agroLavoura.create({ data: {
      talhaoId,
      safraId,
      culturaId,
      areaHa,
      status: status as any,
      dataPlantio: parseDate(data.dataPlantio, "a data de plantio", true),
      dataPrevisaoColheita: parseDate(data.dataPrevisaoColheita, "a previsão de colheita", true),
      observacoes: clean(data.observacoes, 2_000),
    }, include: { talhao: { include: { fazenda: true } }, safra: true, cultura: true, _count: { select: { operacoes: true } } } });
    return cropCycleDto(row);
  },

  async updateLavoura(id: string, data: any) {
    const current = await prisma.agroLavoura.findUnique({ where: { id }, include: { talhao: true, _count: { select: { operacoes: true } } } });
    if (!current) throw new AppError(404, "Lavoura não encontrada.");
    if (current._count.operacoes > 0 && ["talhaoId", "safraId", "culturaId"].some((key) => data[key] !== undefined && clean(data[key]) !== (current as any)[key])) {
      throw new AppError(409, "Talhão, safra e cultura não podem ser alterados depois que a lavoura possui operações.");
    }
    const status = data.status === undefined ? current.status : clean(data.status, 30).toUpperCase();
    if (!STATUS_LAVOURA.has(String(status))) throw new AppError(400, "Status da lavoura inválido.");
    const areaHa = data.areaHa === undefined ? number(current.areaHa) : decimal(data.areaHa, "uma área", true);
    if (number(current.talhao.areaHa) > 0 && areaHa > number(current.talhao.areaHa) + 1e-9) throw new AppError(400, "A área da lavoura não pode ser maior que a área do talhão.");
    const row = await prisma.agroLavoura.update({ where: { id }, data: {
      areaHa,
      status: status as any,
      ...(data.dataPlantio !== undefined ? { dataPlantio: parseDate(data.dataPlantio, "a data de plantio", true) } : {}),
      ...(data.dataPrevisaoColheita !== undefined ? { dataPrevisaoColheita: parseDate(data.dataPrevisaoColheita, "a previsão de colheita", true) } : {}),
      ...(data.observacoes !== undefined ? { observacoes: clean(data.observacoes, 2_000) } : {}),
    }, include: { talhao: { include: { fazenda: true } }, safra: true, cultura: true, _count: { select: { operacoes: true } } } });
    return cropCycleDto(row);
  },

  async listOperacoes(query: any) {
    const take = Math.min(500, Math.max(1, Number(query.take) || 200));
    const rows = await prisma.agroOperacao.findMany({
      where: clean(query.lavouraId) ? { lavouraId: clean(query.lavouraId) } : {},
      include: {
        lavoura: { include: { talhao: { include: { fazenda: true } }, safra: true, cultura: true } },
        movimentacoes: { include: { produto: true, lote: true }, orderBy: { createdAt: "asc" } },
        createdBy: { select: { id: true, name: true, username: true } },
      },
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map(operationDto);
  },

  async createOperacao(data: any, createdById?: string) {
    const lavouraId = clean(data.lavouraId, 80);
    const tipo = clean(data.tipo, 30).toUpperCase();
    if (!lavouraId) throw new AppError(400, "Selecione a lavoura.");
    if (!TIPOS_OPERACAO.has(tipo)) throw new AppError(400, "Tipo de operação agrícola inválido.");
    const dataOperacao = parseDate(data.data ?? new Date().toISOString().slice(0, 10), "a data da operação") as Date;
    if (dateIsFuture(dataOperacao)) throw new AppError(400, "A operação agrícola não pode ter data futura.");
    const produtos = normalizeProducts(data.produtos);

    try {
      const result = await prisma.$transaction(async (tx: any) => {
        const lavoura = await tx.agroLavoura.findUnique({
          where: { id: lavouraId },
          include: { talhao: { include: { fazenda: true } }, safra: true, cultura: true },
        });
        if (!lavoura) throw new AppError(404, "Lavoura não encontrada.");
        if (lavoura.status === "CONCLUIDA") throw new AppError(409, "Reabra a lavoura antes de registrar novas operações.");

        const areaHa = data.areaHa === undefined || data.areaHa === "" ? number(lavoura.areaHa) : decimal(data.areaHa, "uma área", true);
        if (number(lavoura.areaHa) > 0 && areaHa > number(lavoura.areaHa) + 1e-9) throw new AppError(400, "A área da operação não pode ser maior que a área da lavoura.");

        const requiredByProduct = new Map<string, number>();
        const requiredByLot = new Map<string, { produtoId: string; quantidade: number }>();
        for (const item of produtos) {
          requiredByProduct.set(item.produtoId, (requiredByProduct.get(item.produtoId) ?? 0) + item.quantidade);
          if (item.loteId) {
            const prev = requiredByLot.get(item.loteId);
            requiredByLot.set(item.loteId, { produtoId: item.produtoId, quantidade: (prev?.quantidade ?? 0) + item.quantidade });
          }
        }

        const productIds = [...requiredByProduct.keys()].sort();
        const productsById = new Map<string, any>();
        for (const produtoId of productIds) {
          await tx.$executeRawUnsafe('SELECT "id" FROM "agro_produtos" WHERE "id" = $1 FOR UPDATE', produtoId);
          const product = await tx.agroProduto.findUnique({ where: { id: produtoId } });
          if (!product) throw new AppError(404, "Um dos produtos selecionados não foi encontrado.");
          if (!product.ativo) throw new AppError(409, `O produto ${product.nome} está inativo.`);
          productsById.set(produtoId, product);
        }

        const lotsById = new Map<string, any>();
        for (const item of produtos) {
          const product = productsById.get(item.produtoId);
          if (item.loteId && !lotsById.has(item.loteId)) {
            const lot = await tx.agroLote.findUnique({ where: { id: item.loteId } });
            if (!lot || lot.produtoId !== item.produtoId) throw new AppError(400, `O lote informado não pertence ao produto ${product?.nome ?? "selecionado"}.`);
            if (!lot.ativo) throw new AppError(409, `O lote ${lot.codigo} está inativo.`);
            lotsById.set(item.loteId, lot);
          }
          if (product?.controlaLote && !item.loteId) throw new AppError(400, `Selecione o lote do produto ${product.nome}.`);
        }

        for (const [produtoId, quantidade] of requiredByProduct) {
          const product = productsById.get(produtoId);
          const saldo = await currentBalance(tx, produtoId);
          if (saldo + 1e-9 < quantidade) throw new AppError(409, `Saldo insuficiente de ${product.nome}. Disponível: ${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${product.unidadeMedida}.`);
        }
        for (const [loteId, required] of requiredByLot) {
          const lot = lotsById.get(loteId);
          const product = productsById.get(required.produtoId);
          const saldo = await currentBalance(tx, required.produtoId, loteId);
          if (saldo + 1e-9 < required.quantidade) throw new AppError(409, `Saldo insuficiente no lote ${lot.codigo} de ${product.nome}. Disponível: ${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${product.unidadeMedida}.`);
        }

        const operation = await tx.agroOperacao.create({ data: {
          lavouraId,
          tipo: tipo as any,
          data: dataOperacao,
          areaHa,
          responsavel: clean(data.responsavel, 160),
          documento: clean(data.documento, 120),
          observacoes: clean(data.observacoes, 2_000),
          createdById: createdById || null,
        } });

        const destino = `${lavoura.talhao.fazenda.nome} · ${lavoura.talhao.nome} · ${lavoura.cultura.nome} · ${lavoura.safra.nome}`.slice(0, 220);
        for (const item of produtos) {
          await tx.agroMovimentacao.create({ data: {
            produtoId: item.produtoId,
            loteId: item.loteId,
            tipo: "SAIDA",
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            data: dataOperacao,
            responsavel: clean(data.responsavel, 160),
            destino,
            documento: clean(data.documento, 120),
            observacoes: `Consumo automático na operação ${tipo}. ${clean(data.observacoes, 1_700)}`.trim(),
            createdById: createdById || null,
            agroOperacaoId: operation.id,
          } });
        }

        if (tipo === "PLANTIO" && lavoura.status === "PLANEJADA") {
          await tx.agroLavoura.update({ where: { id: lavouraId }, data: { status: "EM_ANDAMENTO", ...(lavoura.dataPlantio ? {} : { dataPlantio: dataOperacao }) } });
        }

        return tx.agroOperacao.findUnique({
          where: { id: operation.id },
          include: {
            lavoura: { include: { talhao: { include: { fazenda: true } }, safra: true, cultura: true } },
            movimentacoes: { include: { produto: true, lote: true }, orderBy: { createdAt: "asc" } },
            createdBy: { select: { id: true, name: true, username: true } },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
      return operationDto(result);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === "P2034") throw new AppError(409, "O estoque ou a lavoura foi alterado por outra operação. Tente novamente.");
      throw error;
    }
  },
};
