type MovimentoValorEstoque = {
  tipo: string;
  quantidade: unknown;
  valorUnitario?: unknown;
  valorTotal?: unknown;
};

const asNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calcularValorAtualEstoque(rows: MovimentoValorEstoque[]) {
  let entradas = 0;
  let saidas = 0;
  let valorEntradas = 0;

  for (const row of rows) {
    const quantidade = asNumber(row.quantidade);
    if (row.tipo === "ENTRADA") {
      entradas += quantidade;
      const valorTotal = asNumber(row.valorTotal);
      valorEntradas += valorTotal || quantidade * asNumber(row.valorUnitario);
    } else if (row.tipo === "SAIDA") {
      saidas += quantidade;
    }
  }

  const estoque = entradas - saidas;
  const custoMedio = entradas > 0 ? valorEntradas / entradas : 0;
  const valorEstoque = Math.max(0, estoque) * custoMedio;

  return {
    entradas,
    saidas,
    estoque,
    custoMedio,
    valorEstoque,
  };
}
