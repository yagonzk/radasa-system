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
  'exportFreteUnitXlsx', 'exportFreteXlsx', 'BiConsultation',
  'testId="consulta-mini-dashboard"', 'testId="placas-mini-dashboard"',
  'testId="clientes-mini-dashboard"', 'testId="produtos-mini-dashboard"',
  'formatDateBR(row.data)', 'setColumnFilters', 'tableQuery',
]) assert.ok(bi.includes(token), `Falta capacidade ou ajuste de BI: ${token}`);

const biView = fs.readFileSync('client/src/components/bi/BiPresentation.tsx', 'utf8');
const biStyles = fs.readFileSync('client/src/pages/bi-gerencial.css', 'utf8');
for (const token of ['BiColumnFilter', 'BiMetrics', 'BiRanking', 'columnWidths', 'compactColumnKeys', 'rows.slice']) {
  assert.ok(biView.includes(token), `Apresentação do BI sem recurso ${token}`);
}
assert.ok(biStyles.includes('container: bi-dashboard / inline-size'), 'BI deve reagir à largura disponível, não somente ao viewport.');
assert.ok(biStyles.includes('.bi-v3__table-scroll'), 'Consulta deve rolar sem compactar valores.');
assert.ok(biStyles.includes('.bi-v3__mobile-rows'), 'Consulta deve usar cartões em espaços pequenos.');
assert.ok(css.includes('--background: #eef2ff;') && css.includes('--background: #111827;'), 'Fundos aprovados devem ser mantidos.');
console.log('OK: Manutenção preservada e BI reconstruído com filtros, exportações, legibilidade e fundos originais.');
