import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync('server/services/financeiro.service.ts','utf8');
assert.doesNotMatch(src, /\["Custo Extra",v\.valorCustoExtra\]/, 'DRE resumo ainda soma Custo Extra');
assert.doesNotMatch(src, /despesa=number\(v\.valorPedagio\)\+number\(v\.valorDiaria\)\+number\(v\.valorChapa\)\+number\(v\.valorMulta\)\+number\(v\.valorCustoExtra\)/, 'DRE análise ainda soma Custo Extra');
assert.doesNotMatch(src, /addCusto\(vk,placa,"Custo Extra",v\.valorCustoExtra\)/, 'DRE por veículo ainda categoriza Custo Extra');
console.log('DRE sem custo extra regression: OK');
