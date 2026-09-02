import fs from 'node:fs';

const source = fs.readFileSync('client/src/pages/Estoque.tsx', 'utf8');

const checks = [
  ['botão Relatório', /<Button[^>]*onClick=\{\(\) => setReportOpen\(true\)\}[^>]*>[\s\S]*?Relatório[\s\S]*?<\/Button>/],
  ['popup de relatório', /<Dialog open=\{reportOpen\}/],
  ['opção CSV dentro do popup', /onClick=\{\(\) => \{\s*setReportOpen\(false\);\s*exportCsv\(\);\s*\}\}[\s\S]*?Exportar CSV/],
  ['opção PDF dentro do popup', /onClick=\{\(\) => \{\s*setReportOpen\(false\);\s*exportPdf\(\);\s*\}\}[\s\S]*?Exportar PDF/],
  ['nova movimentação no grupo superior', /Relatório[\s\S]{0,900}Nova movimentação/],
];

let failed = false;
for (const [name, pattern] of checks) {
  if (!pattern.test(source)) {
    console.error(`FALHOU: ${name}`);
    failed = true;
  }
}

if (/Exportar CSV<\/Button>[\s\S]{0,300}Exportar PDF<\/Button>/.test(source)) {
  console.error('FALHOU: botões diretos Exportar CSV/PDF ainda estão no cabeçalho');
  failed = true;
}

if (failed) process.exit(1);
console.log('OK: layout de relatório do Almoxarifado validado.');
