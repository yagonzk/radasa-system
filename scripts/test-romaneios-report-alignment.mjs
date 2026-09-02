import fs from 'node:fs';

const file = fs.readFileSync('client/src/pages/Romaneios.tsx', 'utf8');

const checks = [
  ['table usa layout fixo', /table\s*\{[^}]*table-layout:\s*fixed;/s],
  ['relatório define colgroup', /<colgroup>[\s\S]*?<col class="col-placa"\s*\/>[\s\S]*?<col class="col-tipo"\s*\/>[\s\S]*?<col class="col-primeira"\s*\/>[\s\S]*?<col class="col-segunda"\s*\/>[\s\S]*?<col class="col-total"\s*\/>[\s\S]*?<\/colgroup>/],
  ['largura da placa definida', /\.col-placa\s*\{\s*width:\s*9%;\s*\}/],
  ['largura do tipo definida', /\.col-tipo\s*\{\s*width:\s*29%;\s*\}/],
  ['largura da primeira quinzena definida', /\.col-primeira\s*\{\s*width:\s*20%;\s*\}/],
  ['largura da segunda quinzena definida', /\.col-segunda\s*\{\s*width:\s*20%;\s*\}/],
  ['largura do total definida', /\.col-total\s*\{\s*width:\s*22%;\s*\}/],

  ['células monetárias usam classe lógica, não nth-child', /<td class="amount-cell">\$\{money\(values\.lebrinhaPrimeira\)\}<\/td>/],
  ['linha cliente mantém 1ª quinzena na coluna monetária', /<td class="amount-cell">\$\{money\(values\.clientePrimeira\)\}<\/td>/],
  ['linha total mantém 1ª quinzena na coluna monetária', /<td class="amount-cell">\$\{money\(primeiraTotal\)\}<\/td>/],
  ['classe monetária é alinhada à direita', /\.amount-cell\s*\{[^}]*text-align:\s*right/s],
];

const failed = checks.filter(([, regex]) => !regex.test(file));
if (failed.length) {
  console.error('FAIL:', failed.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log('PASS: relatório de Romaneios usa grade fixa e alinhada.');
