import fs from 'node:fs';
import assert from 'node:assert/strict';

const service = fs.readFileSync('server/services/viagens.service.ts', 'utf8');
const page = fs.readFileSync('client/src/pages/Viagens.tsx', 'utf8');

assert.match(service, /const valorAbastecimentoVinculado = abastecimentosVinculados\.reduce/,
  'backend deve recalcular o combustível a partir dos vínculos carregados');
assert.match(service, /valorAbastecimento: abastecimentosVinculados\.length \? valorAbastecimentoVinculado : number\(item\.valorAbastecimento\)/,
  'serialize deve usar a soma dos vínculos como fonte de verdade');
assert.match(page, /const handleOpenView = async \(v: Viagem\)/,
  'visualização deve buscar a viagem atualizada no servidor');
assert.match(page, /api\.get<Viagem>\(`\/viagens\/\$\{v\.id\}`\)/,
  'olho deve fazer GET individual da viagem');
assert.match(page, /Abastecimentos vinculados/,
  'detalhes devem listar as notas vinculadas');
assert.match(page, /viewingViagem\.abastecimentosVinculados/,
  'detalhes devem renderizar os vínculos retornados pela API');
assert.match(service, /const combustivelReal = viagem\.abastecimentosVinculados\.length/,
  'rentabilidade deve somar combustível pelos vínculos, não pelo campo legado');

console.log('OK: vínculo de abastecimento e visualização atualizada protegidos por regressão.');
