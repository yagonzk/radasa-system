import { describe, expect, it } from "vitest";
import { buildStockBalanceMap, maintenanceCostFromAggregate } from "./manutencao-performance.js";

describe("maintenance performance helpers", () => {
  it("aggregates stock movements in one balance map", () => {
    const result = buildStockBalanceMap([
      { produtoId: "p1", tipo: "ENTRADA", _sum: { quantidade: 10 } },
      { produtoId: "p1", tipo: "SAIDA", _sum: { quantidade: 3 } },
      { produtoId: "p2", tipo: "ENTRADA", _sum: { quantidade: 2.5 } },
    ]);
    expect(result.get("p1")).toBe(7);
    expect(result.get("p2")).toBe(2.5);
  });

  it("computes concluded maintenance cost from database aggregates", () => {
    expect(maintenanceCostFromAggregate({ _sum: { valorPecas: 100, valorMaoObra: 50, valorOutros: 20, desconto: 10 } })).toBe(160);
  });
});
