import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { dateOnly, number } from "../utils/serialize.js";
import { agroEstoqueService } from "./agro-estoque.service.js";
import { calculateAgroAverageCosts } from "./agro-stock-core.js";

function clean(value: unknown, max = 160) { return String(value ?? "").trim().slice(0, max); }
function parseDate(value: unknown, field: string) {
  const raw = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new AppError(400, `Informe ${field} válida.`);
  const parsed = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, `Informe ${field} válida.`);
  return parsed;
}
function monthKey(date: Date) { return date.toISOString().slice(0, 7); }
function addGroup(map: Map<string, any>, key: string, label: string, cost: number, qty: number, areaHa = 0) {
  const row = map.get(key) ?? { id: key, label, custo: 0, quantidade: 0, areaHa: 0, custoPorHa: 0 };
  row.custo += cost; row.quantidade += qty; row.areaHa = Math.max(row.areaHa, areaHa); row.custoPorHa = row.areaHa > 0 ? row.custo / row.areaHa : 0; map.set(key, row);
}

export const agroRelatoriosService = {
  async report(query: any) {
    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from = query.from ? parseDate(query.from, "a data inicial") : defaultFrom;
    const to = query.to ? parseDate(query.to, "a data final") : defaultTo;
    if (from > to) throw new AppError(400, "A data inicial não pode ser maior que a data final.");
    if ((to.getTime() - from.getTime()) / 86_400_000 > 366) throw new AppError(400, "Consulte no máximo 366 dias por vez.");
    const localId = clean(query.localId, 80), produtoId = clean(query.produtoId, 80), fazendaId = clean(query.fazendaId, 80), safraId = clean(query.safraId, 80), culturaId = clean(query.culturaId, 80);
    const operationWhere: any = {};
    if (fazendaId) operationWhere.lavoura = { ...(operationWhere.lavoura || {}), talhao: { fazendaId } };
    if (safraId) operationWhere.lavoura = { ...(operationWhere.lavoura || {}), safraId };
    if (culturaId) operationWhere.lavoura = { ...(operationWhere.lavoura || {}), culturaId };
    const relationFilter = (fazendaId || safraId || culturaId) ? { agroOperacao: operationWhere } : {};

    const [movements, stock, averageCosts, operations] = await Promise.all([
      prisma.agroMovimentacao.findMany({
        where: {
          data: { gte: from, lte: to },
          ...(localId ? { localId } : {}),
          ...(produtoId ? { produtoId } : {}),
          ...relationFilter,
        },
        select: {
          id: true, tipo: true, quantidade: true, valorUnitario: true, data: true, documento: true, responsavel: true, destino: true,
          produto: { select: { id: true, codigo: true, nome: true, unidadeMedida: true, categoria: true } },
          lote: { select: { id: true, codigo: true } },
          local: { select: { id: true, nome: true } },
          agroOperacao: { select: { id: true, tipo: true, areaHa: true, lavoura: { select: { id: true, areaHa: true, safra: { select: { id: true, nome: true } }, cultura: { select: { id: true, nome: true } }, talhao: { select: { id: true, nome: true, fazenda: { select: { id: true, nome: true } } } } } } } },
        },
        orderBy: [{ data: "desc" }, { createdAt: "desc" }],
        take: 5000,
      }),
      agroEstoqueService.listEstoque(localId || undefined),
      calculateAgroAverageCosts(prisma),
      prisma.agroOperacao.findMany({
        where: {
          data: { gte: from, lte: to },
          ...(fazendaId || safraId || culturaId ? operationWhere : {}),
          ...(localId || produtoId ? { movimentacoes: { some: { tipo: "SAIDA", ...(localId ? { localId } : {}), ...(produtoId ? { produtoId } : {}) } } } : {}),
        },
        select: {
          id: true,
          tipo: true,
          areaHa: true,
          data: true,
          lavoura: {
            select: {
              id: true,
              areaHa: true,
              safra: { select: { id: true, nome: true } },
              cultura: { select: { id: true, nome: true } },
              talhao: { select: { id: true, nome: true, fazenda: { select: { id: true, nome: true } } } },
            },
          },
        },
        orderBy: { data: "asc" },
      }),
    ]);

    const byProduct = new Map<string, any>(), byFarm = new Map<string, any>(), byPlot = new Map<string, any>(), bySeason = new Map<string, any>(), byCrop = new Map<string, any>(), byOperation = new Map<string, any>(), monthly = new Map<string, any>();
    let entradasValor = 0, consumoValor = 0, ajustesValor = 0;
    const consumptionRows: any[] = [];
    for (const m of movements) {
      const qty = number(m.quantidade);
      const fallback = averageCosts.get(m.produto.id) ?? 0;
      const unit = number(m.valorUnitario) > 0 ? number(m.valorUnitario) : fallback;
      const value = qty * unit;
      const type = String(m.tipo);
      const month = monthKey(m.data);
      const monthRow = monthly.get(month) ?? { mes: month, entradas: 0, consumo: 0, ajustes: 0 };
      if (type === "ENTRADA") { entradasValor += value; monthRow.entradas += value; }
      else if (type === "SAIDA") { consumoValor += value; monthRow.consumo += value; }
      else if (type === "AJUSTE_ENTRADA" || type === "AJUSTE_SAIDA" || type === "INVENTARIO_ENTRADA" || type === "INVENTARIO_SAIDA") { const signed = type.endsWith("ENTRADA") ? value : -value; ajustesValor += signed; monthRow.ajustes += signed; }
      monthly.set(month, monthRow);
      if (type !== "SAIDA") continue;
      const op = m.agroOperacao;
      const lav = op?.lavoura;
      addGroup(byProduct, m.produto.id, `${m.produto.codigo} · ${m.produto.nome}`, value, qty);
      if (lav?.talhao?.fazenda) addGroup(byFarm, lav.talhao.fazenda.id, lav.talhao.fazenda.nome, value, qty, number(lav.areaHa));
      if (lav?.talhao) addGroup(byPlot, lav.talhao.id, `${lav.talhao.fazenda?.nome || ""} · ${lav.talhao.nome}`, value, qty, number(lav.areaHa));
      if (lav?.safra) addGroup(bySeason, lav.safra.id, lav.safra.nome, value, qty, number(lav.areaHa));
      if (lav?.cultura) addGroup(byCrop, lav.cultura.id, lav.cultura.nome, value, qty, number(lav.areaHa));
      if (op) addGroup(byOperation, String(op.tipo), String(op.tipo), value, qty, number(op.areaHa));
      consumptionRows.push({ id: m.id, data: dateOnly(m.data), produto: m.produto, lote: m.lote, local: m.local, quantidade: qty, custoUnitario: unit, custoTotal: value, operacao: op ? { id: op.id, tipo: op.tipo, areaHa: number(op.areaHa), lavoura: lav } : null, responsavel: m.responsavel, documento: m.documento, destino: m.destino });
    }

    const areaMap = new Map<string, number>();
    const areaByFarm = new Map<string, Map<string, number>>(), areaByPlot = new Map<string, Map<string, number>>(), areaBySeason = new Map<string, Map<string, number>>(), areaByCrop = new Map<string, Map<string, number>>();
    const areaByOperation = new Map<string, number>();
    const putArea = (target: Map<string, Map<string, number>>, key: string | undefined, lavouraId: string, area: number) => { if (!key) return; const entries = target.get(key) ?? new Map<string, number>(); entries.set(lavouraId, area); target.set(key, entries); };
    for (const op of operations) {
      const cropArea = number(op.lavoura.areaHa);
      const workedArea = number(op.areaHa) || cropArea;
      if (!areaMap.has(op.lavoura.id)) areaMap.set(op.lavoura.id, cropArea);
      putArea(areaByFarm, op.lavoura.talhao.fazenda?.id, op.lavoura.id, cropArea);
      putArea(areaByPlot, op.lavoura.talhao.id, op.lavoura.id, cropArea);
      putArea(areaBySeason, op.lavoura.safra.id, op.lavoura.id, cropArea);
      putArea(areaByCrop, op.lavoura.cultura.id, op.lavoura.id, cropArea);
      areaByOperation.set(String(op.tipo), (areaByOperation.get(String(op.tipo)) ?? 0) + workedArea);
    }
    const applyArea = (groups: Map<string, any>, areas: Map<string, Map<string, number>>) => { for (const [key, row] of groups) { const total = [...(areas.get(key)?.values() ?? [])].reduce((a, b) => a + b, 0); row.areaHa = total; row.custoPorHa = total > 0 ? row.custo / total : 0; } };
    applyArea(byFarm, areaByFarm); applyArea(byPlot, areaByPlot); applyArea(bySeason, areaBySeason); applyArea(byCrop, areaByCrop);
    for (const [key, row] of byOperation) { const total = areaByOperation.get(key) ?? 0; row.areaHa = total; row.custoPorHa = total > 0 ? row.custo / total : 0; }
    const areaHa = [...areaMap.values()].reduce((a, b) => a + b, 0);
    const valorEstoqueAtual = stock.reduce((sum: number, row: any) => sum + number(row.valorEstoque), 0);
    const stockRows = stock.filter((row: any) => row.produto.ativo || row.estoque !== 0).map((row: any) => ({ produto: row.produto, estoque: row.estoque, custoMedio: row.custoMedio, valorEstoque: row.valorEstoque, abaixoMinimo: row.abaixoMinimo, proximaValidade: row.proximaValidade }));
    const sortCost = (map: Map<string, any>) => [...map.values()].sort((a, b) => b.custo - a.custo);

    return {
      periodo: { from: dateOnly(from), to: dateOnly(to) },
      resumo: { valorEstoqueAtual, entradasValor, consumoValor, ajustesValor, custoPorHa: areaHa > 0 ? consumoValor / areaHa : 0, areaHa, movimentacoes: movements.length, operacoes: operations.length },
      estoque: stockRows,
      consumoPorProduto: sortCost(byProduct), consumoPorFazenda: sortCost(byFarm), consumoPorTalhao: sortCost(byPlot), consumoPorSafra: sortCost(bySeason), consumoPorCultura: sortCost(byCrop), consumoPorOperacao: sortCost(byOperation),
      mensal: [...monthly.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
      consumos: consumptionRows.slice(0, 1000),
    };
  },
};
