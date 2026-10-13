import fs from 'node:fs';
import assert from 'node:assert/strict';

const maintenance = fs.readFileSync('client/src/pages/Manutencao.tsx', 'utf8');
const bi = fs.readFileSync('client/src/pages/BIGerencial.tsx', 'utf8');
const css = fs.readFileSync('client/src/index.css', 'utf8');

for (const token of [
  'Ordens de serviço', 'OS pendentes', 'Custos de manutenção',
  'Manutenções preventivas', 'Documentos da frota',
  'Selecionar pendentes', 'Concluir selecionadas',
  'Nova manutenção', 'Programar preventiva',
  'Excluir plano', 'Excluir documento',
]) assert.ok(maintenance.includes(token), `Falta funcionalidade de Manutenção: ${token}`);

assert.ok(!maintenance.includes('setTab('), 'Manutenção não deve usar miniabas para separar indicadores do trabalho.');
assert.ok(maintenance.includes('max-h-96 overflow-auto'), 'Tabelas secundárias precisam de área com scroll.');
assert.ok(maintenance.includes('grid min-w-0 gap-4 xl:grid-cols-2'), 'Planejamento e documentos devem adaptar largura.');

for (const token of [
  'matchNfeForManifesto', 'mergeStagingBiFacts', 'exportFaturamentoXlsx',
  'exportFreteUnitXlsx', 'exportFreteXlsx', 'HeaderFilter',
  'data-testid="consulta-mini-dashboard"', 'data-testid="placas-mini-dashboard"',
  'data-testid="clientes-mini-dashboard"', 'data-testid="produtos-mini-dashboard"',
  'formatDateBR(x.data)', 'ref={biContentRef}',
  'min-w-[1720px]', 'overflow-auto overscroll-contain',
  'ResizeObserver', 'compactCharts',
]) assert.ok(bi.includes(token), `Falta capacidade ou ajuste de BI: ${token}`);

assert.equal((bi.match(/bi-chart-scroll max-h-\[620px\]/g) || []).length, 3, 'Gráficos categorizados devem ter scroll vertical adaptável.');
assert.ok(bi.includes('aria-label="Áreas do BI Gerencial"'), 'Navegação original do BI deve ser mantida.');
assert.ok(css.includes('--background: #eef2ff;') && css.includes('--background: #111827;'), 'Fundos aprovados devem ser mantidos.');
console.log('OK: Manutenção integrada e BI responsivo, preservando navegação, operações, exportações e fundos.');
