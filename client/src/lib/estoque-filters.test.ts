import { describe, expect, it } from "vitest";
import { matchesEstoqueGlobalSearch } from "./estoque-filters";

describe("matchesEstoqueGlobalSearch", () => {
  const produto = { nome: "Lente Vidro Farol Iveco Stralis", codigoInterno: "RAD-00001" };

  it("encontra produto pelo nome ignorando maiúsculas e acentos", () => {
    expect(matchesEstoqueGlobalSearch(produto, "iveco stralis")).toBe(true);
  });

  it("encontra produto pelo código", () => {
    expect(matchesEstoqueGlobalSearch(produto, "rad-00001")).toBe(true);
  });

  it("não encontra texto inexistente", () => {
    expect(matchesEstoqueGlobalSearch(produto, "filtro de óleo")).toBe(false);
  });
});
