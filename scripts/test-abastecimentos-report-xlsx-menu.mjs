import fs from 'node:fs';

const path = new URL('../client/src/pages/Abastecimentos.tsx', import.meta.url);
const source = fs.readFileSync(path, 'utf8');

const menuBlockStart = source.indexOf('<DropdownMenuContent align="end" className="w-64">');
const menuBlockEnd = source.indexOf('</DropdownMenuContent>', menuBlockStart);
const menuBlock = menuBlockStart >= 0 && menuBlockEnd > menuBlockStart
  ? source.slice(menuBlockStart, menuBlockEnd)
  : '';

if (!menuBlock.includes('Gerar relatório XLSX')) {
  console.error('FAIL: menu Relatórios não oferece exportação XLSX do relatório principal.');
  process.exit(1);
}

if (!menuBlock.includes('onSelect={() => gerarRelatorioXlsx()}')) {
  console.error('FAIL: item XLSX do relatório principal não chama gerarRelatorioXlsx diretamente.');
  process.exit(1);
}

console.log('PASS: menu Relatórios oferece XLSX do relatório principal.');
