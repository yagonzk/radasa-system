import assert from "node:assert/strict";
import { buildDreOperacional } from "../client/src/pages/financeiro-dre-operacional.js";

const dre = buildDreOperacional({
  resumo: { receita: 3000, despesa: 2175, resultado: 825, margem: 27.5, viagens: 3 },
  porCliente: [],
  porViagem: [],
  porVeiculo: [
    {
      id: "RAX6E36",
      nome: "RAX6E36",
      receita: 1000,
      despesa: 725,
      resultado: 275,
      margem: 27.5,
      viagens: 1,
      distanciaKm: 100,
      custoKm: 7.25,
      lucroKm: 2.75,
    },
    {
      id: "RAT8F79",
      nome: "RAT8F79",
      receita: 2000,
      despesa: 1450,
      resultado: 550,
      margem: 27.5,
      viagens: 2,
      distanciaKm: 200,
      custoKm: 7.25,
      lucroKm: 2.75,
    },
    {
      id: "RRP0000",
      nome: "RRP0000",
      receita: 0,
      despesa: 0,
      resultado: 0,
      margem: 0,
      viagens: 1,
      distanciaKm: 12,
      custoKm: 0,
      lucroKm: 0,
    },
  ],
  custosPorVeiculo: [
    {
      id: "RAX6E36",
      placa: "RAX6E36",
      total: 725,
      categorias: [
        { categoria: "Diárias", valor: 100 },
        { categoria: "Chapas", valor: 50 },
        { categoria: "Pedágios", valor: 150 },
        { categoria: "Diesel", valor: 200 },
        { categoria: "ARLA", valor: 25 },
        { categoria: "Manutenção", valor: 120 },
        { categoria: "Comissão", valor: 80 },
      ],
    },
    {
      id: "RAT8F79",
      placa: "RAT8F79",
      total: 1450,
      categorias: [
        { categoria: "Diárias", valor: 200 },
        { categoria: "Chapas", valor: 100 },
        { categoria: "Pedágios", valor: 300 },
        { categoria: "Diesel", valor: 400 },
        { categoria: "ARLA", valor: 50 },
        { categoria: "Manutenção", valor: 250 },
        { categoria: "Comissão", valor: 150 },
      ],
    },
  ],
});

assert.deepEqual(
  dre.placas.map((placa) => placa.nome),
  ["RAT8F79", "RAX6E36"],
);

assert.deepEqual(
  dre.linhas.map((linha) => linha.label),
  ["Receita", "Diária", "Chapa", "Pedágio", "Diesel", "Manutenção", "Comissão", "Custo total"],
);

const diesel = dre.linhas.find((linha) => linha.id === "diesel");
assert.equal(diesel?.valores.get("RAT8F79"), 450);
assert.equal(diesel?.valores.get("RAX6E36"), 225);

const custoTotal = dre.linhas.find((linha) => linha.id === "custo-total");
assert.equal(custoTotal?.valores.get("RAT8F79"), 1450);
assert.equal(custoTotal?.valores.get("RAX6E36"), 725);

assert.equal(dre.linhas.some((linha) => linha.label === "ARLA"), false);
assert.equal(dre.linhas.some((linha) => ["Resultado", "Margem", "Viagens", "KM rodado"].includes(linha.label)), false);

console.log("OK");
