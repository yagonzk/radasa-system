import fs from 'node:fs';
import assert from 'node:assert/strict';

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const service = fs.readFileSync('server/services/viagens.service.ts', 'utf8');
const financeiro = fs.readFileSync('server/services/financeiro.service.ts', 'utf8');
const page = fs.readFileSync('client/src/pages/Viagens.tsx', 'utf8');
const store = fs.readFileSync('client/src/lib/store.ts', 'utf8');
const validators = fs.readFileSync('server/validators/schemas.ts', 'utf8');

assert.match(schema, /abastecimentoId\s+String\?/);
assert.match(schema, /valorComissao\s+Decimal/);
assert.match(service, /resolverCustosAutomaticosViagem/);
assert.match(service, /abastecimentoId/);
assert.match(service, /valorComissao/);
assert.match(page, /Selecionar abastecimento/);
assert.match(page, /Comissão automática/);
assert.match(store, /abastecimentoId\?: string \| null/);
assert.match(store, /valorComissao\?: number/);
assert.match(validators, /abastecimentoId: id\.optional\(\)\.nullable/);
assert.match(validators, /valorComissao: money\.optional/);
assert.doesNotMatch(financeiro, /prisma\.fechamento\.findMany/);
assert.doesNotMatch(financeiro, /add\("Comissões"/);
console.log('viagem abastecimento/comissao regression: PASS');
