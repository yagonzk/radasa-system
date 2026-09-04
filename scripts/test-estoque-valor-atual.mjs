import assert from 'node:assert/strict';
import { calcularValorAtualEstoque } from '../server/services/estoque-valuation.ts';

const casoSimples = calcularValorAtualEstoque([
  { tipo: 'ENTRADA', quantidade: 2, valorUnitario: 100 },
]);
assert.equal(casoSimples.estoque, 2);
assert.equal(casoSimples.custoMedio, 100);
assert.equal(casoSimples.valorEstoque, 200);

const casoCustoMedio = calcularValorAtualEstoque([
  { tipo: 'ENTRADA', quantidade: 1, valorUnitario: 100 },
  { tipo: 'ENTRADA', quantidade: 1, valorUnitario: 120 },
]);
assert.equal(casoCustoMedio.estoque, 2);
assert.equal(casoCustoMedio.custoMedio, 110);
assert.equal(casoCustoMedio.valorEstoque, 220);

const casoComSaida = calcularValorAtualEstoque([
  { tipo: 'ENTRADA', quantidade: 1, valorUnitario: 100 },
  { tipo: 'ENTRADA', quantidade: 1, valorUnitario: 120 },
  { tipo: 'SAIDA', quantidade: 1, valorUnitario: 999 },
]);
assert.equal(casoComSaida.estoque, 1);
assert.equal(casoComSaida.custoMedio, 110);
assert.equal(casoComSaida.valorEstoque, 110);

const semEntrada = calcularValorAtualEstoque([
  { tipo: 'SAIDA', quantidade: 1, valorUnitario: 50 },
]);
assert.equal(semEntrada.custoMedio, 0);
assert.equal(semEntrada.valorEstoque, 0);

console.log('OK: cálculo do valor atual do estoque validado.');
