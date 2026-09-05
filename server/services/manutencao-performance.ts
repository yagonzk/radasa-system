type StockAggregateRow = {
  produtoId: string;
  tipo: string;
  _sum: { quantidade: unknown };
};

type MaintenanceAggregate = {
  _sum: {
    valorPecas: unknown;
    valorMaoObra: unknown;
    valorOutros: unknown;
    desconto: unknown;
  };
};

const numeric = (value: unknown) => Number(value ?? 0) || 0;

export function buildStockBalanceMap(rows: StockAggregateRow[]) {
  const balances = new Map<string, number>();
  for (const row of rows) {
    const delta = row.tipo === "ENTRADA" ? numeric(row._sum.quantidade) : -numeric(row._sum.quantidade);
    balances.set(row.produtoId, (balances.get(row.produtoId) ?? 0) + delta);
  }
  return balances;
}

export function maintenanceCostFromAggregate(aggregate: MaintenanceAggregate) {
  return Math.max(0,
    numeric(aggregate._sum.valorPecas)
      + numeric(aggregate._sum.valorMaoObra)
      + numeric(aggregate._sum.valorOutros)
      - numeric(aggregate._sum.desconto),
  );
}
