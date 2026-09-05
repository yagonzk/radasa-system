import { describe, expect, it } from "vitest";
import { selectableMaintenanceIds, toggleAllMaintenanceSelection } from "./manutencao-selection";

describe("seleção em lote de OS", () => {
  const rows = [
    { id: "aberta", status: "ABERTA" },
    { id: "andamento", status: "EM_ANDAMENTO" },
    { id: "concluida", status: "CONCLUIDA" },
    { id: "cancelada", status: "CANCELADA" },
  ];

  it("permite selecionar somente OS ainda ativas", () => {
    expect(selectableMaintenanceIds(rows)).toEqual(["aberta", "andamento"]);
  });

  it("seleciona e desmarca todas as OS ativas visíveis", () => {
    const selecionadas = toggleAllMaintenanceSelection(new Set(), rows);
    expect([...selecionadas].sort()).toEqual(["aberta", "andamento"]);
    expect([...toggleAllMaintenanceSelection(selecionadas, rows)]).toEqual([]);
  });
});
