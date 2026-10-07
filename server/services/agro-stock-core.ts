import { number } from "../utils/serialize.js";

export const AGRO_MOVIMENTOS_ENTRADA = new Set([
  "ENTRADA",
  "AJUSTE_ENTRADA",
  "TRANSFERENCIA_ENTRADA",
  "INVENTARIO_ENTRADA",
]);

export const AGRO_MOVIMENTOS_SAIDA = new Set([
  "SAIDA",
  "AJUSTE_SAIDA",
  "TRANSFERENCIA_SAIDA",
  "INVENTARIO_SAIDA",
]);

export const AGRO_TIPOS_MOVIMENTO = new Set([...AGRO_MOVIMENTOS_ENTRADA, ...AGRO_MOVIMENTOS_SAIDA]);

export function agroMovementDelta(tipo: string, quantidade: unknown) {
  const qty = number(quantidade);
  return AGRO_MOVIMENTOS_ENTRADA.has(tipo) ? qty : -qty;
}

export async function currentAgroBalance(tx: any, produtoId: string, loteId?: string | null, localId?: string | null) {
  const rows = await tx.agroMovimentacao.groupBy({
    by: ["tipo"],
    where: {
      produtoId,
      ...(loteId ? { loteId } : {}),
      ...(localId ? { localId } : {}),
    },
    _sum: { quantidade: true },
  });
  return rows.reduce((total: number, row: any) => total + agroMovementDelta(String(row.tipo), row._sum.quantidade ?? 0), 0);
}

export async function getDefaultAgroLocation(tx: any) {
  let local = await tx.agroEstoqueLocal.findFirst({ where: { ativo: true, principal: true }, orderBy: { createdAt: "asc" } });
  if (!local) local = await tx.agroEstoqueLocal.findFirst({ where: { ativo: true }, orderBy: [{ nome: "asc" }] });
  if (!local) {
    local = await tx.agroEstoqueLocal.create({
      data: { codigo: "BAR-001", nome: "Barracão Principal", descricao: "Local padrão", ativo: true, principal: true },
    });
  }
  return local;
}

export async function calculateAgroAverageCosts(tx: any, productIds?: string[]) {
  const rows = await tx.agroMovimentacao.findMany({
    where: productIds?.length ? { produtoId: { in: productIds } } : {},
    select: { id: true, produtoId: true, tipo: true, quantidade: true, valorUnitario: true, data: true, createdAt: true },
    orderBy: [{ produtoId: "asc" }, { data: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const states = new Map<string, { qty: number; value: number; avg: number }>();
  for (const row of rows) {
    const id = String(row.produtoId);
    const state = states.get(id) ?? { qty: 0, value: 0, avg: 0 };
    const qty = Math.max(0, number(row.quantidade));
    if (AGRO_MOVIMENTOS_ENTRADA.has(String(row.tipo))) {
      const informed = Math.max(0, number(row.valorUnitario));
      const unit = informed > 0 ? informed : state.avg;
      state.qty += qty;
      state.value += qty * unit;
      state.avg = state.qty > 1e-9 ? state.value / state.qty : 0;
    } else {
      const remove = Math.min(qty, Math.max(0, state.qty));
      state.value = Math.max(0, state.value - remove * state.avg);
      state.qty = Math.max(0, state.qty - remove);
      if (state.qty <= 1e-9) { state.qty = 0; state.value = 0; }
      state.avg = state.qty > 1e-9 ? state.value / state.qty : state.avg;
    }
    states.set(id, state);
  }
  const result = new Map<string, number>();
  for (const [id, state] of states) result.set(id, Number.isFinite(state.avg) ? state.avg : 0);
  return result;
}

export async function currentAgroAverageCost(tx: any, produtoId: string) {
  return (await calculateAgroAverageCosts(tx, [produtoId])).get(produtoId) ?? 0;
}
