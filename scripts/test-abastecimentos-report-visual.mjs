import fs from 'node:fs';

const path = new URL('../client/src/pages/Abastecimentos.tsx', import.meta.url);
const source = fs.readFileSync(path, 'utf8');

const required = [
  'Resumo de Abastecimentos',
  'RADASA • GESTÃO DE TRANSPORTES',
  'class="hero"',
  'class="summary-grid"',
  'class="report-table diesel-notas"',
  'class="report-table comparativo-table"',
  'class="report-table arla-table"',
  'class="notes"',
  'class="footer"',
  'Salvar como PDF / Imprimir',
  'linear-gradient(120deg, #0c356a 0%, #0f5ca8 62%, #168268 100%)',
  '@page { size: A4 landscape; margin: 10mm; }',
];

const missing = required.filter((marker) => !source.includes(marker));
if (missing.length) {
  console.error('FAIL: relatório de Abastecimentos ainda não segue o visual de Romaneios.');
  for (const marker of missing) console.error(`- ausente: ${marker}`);
  process.exit(1);
}

console.log('PASS: relatório de Abastecimentos segue a identidade visual de Romaneios.');
