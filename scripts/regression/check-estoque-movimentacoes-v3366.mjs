import fs from 'node:fs';
const ui = fs.readFileSync('client/src/pages/Estoque.tsx','utf8');
const service = fs.readFileSync('server/services/estoque.service.ts','utf8');
const checks = [
  ['searchable product selector', ui.includes('function MovementProductSelect') && ui.includes('Pesquisar produto por nome ou código')],
  ['outbound only positive stock', ui.includes('row.estoque > 0') && ui.includes('produtosDisponiveisSaida')],
  ['outbound max quantity', ui.includes('max={form.tipo === \"SAIDA\" && form.produtoId ? saldoProdutoSelecionado : undefined}') && ui.includes('Estoque disponível')],
  ['typeable movement date', ui.includes('type="date"') && ui.includes('Data')],
  ['movement table filters', ui.includes('MovimentacaoFilterKey') && ui.includes('Limpar filtros')],
  ['backend protects negative stock', service.includes('Saldo insuficiente')],
  ['delete entry rollback guard', service.includes('saldoSemEntrada < 0')],
];
let failed = false;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed = true; }
process.exit(failed ? 1 : 0);
