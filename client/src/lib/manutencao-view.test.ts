import { describe, expect, it } from "vitest";
import { filterMaintenanceOrders, maintenanceOrderToForm } from "./manutencao-view";

const rows = [
  {
    id: "1",
    numero: "OS-00001",
    numeroFornecedor: "77",
    veiculoId: "v1",
    tipo: "CORRETIVA",
    status: "CONCLUIDA",
    descricao: "Troca de pneu",
    responsavel: "Adriano",
    fornecedor: "Baixinho",
    dataAbertura: "2026-09-03",
    valorTotal: 100,
  },
  {
    id: "2",
    numero: "OS-00002",
    veiculoId: "v2",
    tipo: "PREVENTIVA",
    status: "ABERTA",
    descricao: "Troca de óleo",
    responsavel: "Darci",
    fornecedor: "Oficina Norte",
    dataAbertura: "2026-09-04",
    valorTotal: 450,
  },
] as any[];

const plates = (id: string) => ({ v1: "RAQ-5F96", v2: "RAT-8F79" } as Record<string, string>)[id] ?? "—";

describe("maintenance table filters", () => {
  it("combines global search with per-column filters", () => {
    const result = filterMaintenanceOrders(rows, plates, "pneu", {
      veiculo: "RAQ-5F96",
      fornecedor: "Baixinho",
      tipo: "Corretiva",
      status: "Concluída",
      dataInicio: "2026-09-01",
      dataFim: "2026-09-03",
    });
    expect(result.map((row) => row.id)).toEqual(["1"]);
  });

  it("filters by a date range", () => {
    const result = filterMaintenanceOrders(rows, plates, "", { dataInicio: "2026-09-04", dataFim: "2026-09-04" });
    expect(result.map((row) => row.id)).toEqual(["2"]);
  });
});

describe("maintenance edit form", () => {
  it("converts an existing OS into the editable form without losing its items", () => {
    const form = maintenanceOrderToForm({
      ...rows[0],
      fornecedorId: "f1",
      kmAbertura: 123456,
      desconto: 10,
      servicoRealizado: "Pneu substituído",
      observacoes: "ok",
      itens: [{ id: "i1", tipo: "SERVICO", descricao: "Troca", quantidade: 1, valorUnitario: 100 }],
    } as any);
    expect(form.fornecedorId).toBe("f1");
    expect(form.kmAbertura).toBe("123456");
    expect(form.desconto).toBe("10");
    expect(form.itens).toHaveLength(1);
  });
});
