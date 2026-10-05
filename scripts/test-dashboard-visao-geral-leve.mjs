import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboardService = fs.readFileSync('server/services/dashboard.service.ts', 'utf8');
const dashboardPage = fs.readFileSync('client/src/pages/Dashboard.tsx', 'utf8');
const dashboardRoutes = fs.readFileSync('server/routes/dashboard.routes.ts', 'utf8');
const financeiro = fs.readFileSync('server/services/financeiro.service.ts', 'utf8');

const gerencialBlock = dashboardService.split('async gerencial(){')[1]?.split('async financeiro(){')[0] || '';
assert.match(gerencialBlock, /prisma\.viagem\.aggregate/);
assert.match(gerencialBlock, /prisma\.abastecimento\.aggregate/);
assert.match(gerencialBlock, /prisma\.veiculo\.count\(\)/);
assert.match(gerencialBlock, /take:6/);
assert.doesNotMatch(gerencialBlock, /financeiroService\.resumo/);
assert.doesNotMatch(gerencialBlock, /financeiroService\.analise/);
assert.doesNotMatch(gerencialBlock, /buildAlertas\(/);

assert.match(dashboardRoutes, /"\/financeiro"/);
assert.match(dashboardRoutes, /"\/rankings"/);
assert.match(dashboardPage, /api\.get\("\/dashboard\/gerencial"\)/);
assert.match(dashboardPage, /api\.get\("\/dashboard\/financeiro"\)/);
assert.match(dashboardPage, /api\.get\("\/dashboard\/rankings"\)/);
assert.match(dashboardPage, /Carregar rankings/);

assert.match(financeiro, /baixaFinanceira\.groupBy\(\{by:\["lancamentoId"\],where:\{lancamentoId:\{in:manualIds\}\}/);
assert.doesNotMatch(financeiro.split('async resumo(')[1]?.split('async analiseOperacional(')[0] || '', /baixaFinanceira\.findMany\(\)/);

console.log('dashboard visao geral leve regression: ok');
