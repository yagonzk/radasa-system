import { describe, expect, it } from "vitest";
import { MANUTENCAO_CATEGORIAS, maintenanceCategoryExamples, isMaintenanceCategory } from "./manutencao-categorias";

describe("categorias dos itens de manutenção", () => {
  it("mantém exatamente as 17 categorias definidas para a OS", () => {
    expect(MANUTENCAO_CATEGORIAS).toHaveLength(17);
    expect(MANUTENCAO_CATEGORIAS[0].label).toBe("Motor e Sistema de Combustão");
    expect(MANUTENCAO_CATEGORIAS[16].label).toBe("Segurança e Equipamentos Obrigatórios");
  });

  it("fornece exemplos explicativos para todas as categorias", () => {
    for (const category of MANUTENCAO_CATEGORIAS) {
      expect(maintenanceCategoryExamples(category.value).length).toBeGreaterThan(10);
      expect(isMaintenanceCategory(category.value)).toBe(true);
    }
  });

  it("não aceita categorias arbitrárias", () => {
    expect(isMaintenanceCategory("QUALQUER_COISA")).toBe(false);
  });
});
