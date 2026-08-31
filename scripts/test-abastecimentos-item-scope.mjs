import fs from 'node:fs';

const file = new URL('../client/src/pages/Abastecimentos.tsx', import.meta.url);
const source = fs.readFileSync(file, 'utf8');

const failures = [];

const totalsBlock = source.match(/const totals = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[filteredItems, produtos\]\);/m)?.[0] ?? '';
if (/valorUnitarioDieselComDesconto\(item,/.test(totalsBlock)) {
  failures.push('totals usa `item` fora do escopo');
}

const optionsBlock = source.match(/if \(key === "valorUnitario"\)[\s\S]*?if \(key === "valorDesconto"\)/m)?.[0] ?? '';
if (/\.map\(\(combustiveis\)[\s\S]*?valorUnitarioDieselComDesconto\(item,/.test(optionsBlock)) {
  failures.push('filtro de valor unitário usa `item` fora do escopo');
}

if (failures.length) {
  console.error('REGRESSAO ENCONTRADA:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('OK: não há uso de `item` fora do escopo nos cálculos de valor unitário.');
